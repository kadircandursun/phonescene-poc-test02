import Foundation
import WebRTC

/// Native mirror of `client/shared/webrtc.ts` PhoneScenePeer (mobile role).
final class WebRTCPeer: NSObject {
    private static let iceServers: [RTCIceServer] = [
        RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
        RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"]),
    ]

    private static let sharedFactory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        let encoder = RTCDefaultVideoEncoderFactory()
        let decoder = RTCDefaultVideoDecoderFactory()
        return RTCPeerConnectionFactory(encoderFactory: encoder, decoderFactory: decoder)
    }()

    var onConnectionState: ((String) -> Void)?
    var onLocalIce: (([String: Any]) -> Void)?
    var onDataOpen: (() -> Void)?
    var onDataClose: (() -> Void)?

    private let pc: RTCPeerConnection
    private var dataChannel: RTCDataChannel?
    private var pendingIce: [[String: Any]] = []
    private var makingOffer = false
    private let videoSource: RTCVideoSource
    private let videoCapturer: RTCVideoCapturer
    let videoTrack: RTCVideoTrack
    private let alphaSource: RTCVideoSource
    private let alphaCapturer: RTCVideoCapturer
    let alphaTrack: RTCVideoTrack
    private var lastVideoPushNs: Int64 = 0
    private var lastAlphaPushNs: Int64 = 0

    override init() {
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: [
            "DtlsSrtpKeyAgreement": "true",
        ])
        let config = RTCConfiguration()
        config.iceServers = Self.iceServers
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually

        let connection = Self.sharedFactory.peerConnection(
            with: config,
            constraints: constraints,
            delegate: nil
        )!
        pc = connection
        videoSource = Self.sharedFactory.videoSource()
        videoCapturer = RTCVideoCapturer(delegate: videoSource)
        videoTrack = Self.sharedFactory.videoTrack(with: videoSource, trackId: "arCam")
        alphaSource = Self.sharedFactory.videoSource()
        alphaCapturer = RTCVideoCapturer(delegate: alphaSource)
        alphaTrack = Self.sharedFactory.videoTrack(with: alphaSource, trackId: "personAlpha")
        super.init()
        pc.delegate = self
        // RGB first, alpha second — Receiver uses track order.
        _ = pc.add(videoTrack, streamIds: ["phonescene"])
        _ = pc.add(alphaTrack, streamIds: ["phonescene-alpha"])
        ensureOutgoingDataChannel()
    }

    func ensureOutgoingDataChannel() {
        guard dataChannel == nil else { return }
        let config = RTCDataChannelConfiguration()
        config.isOrdered = true
        guard let channel = pc.dataChannel(forLabel: "sensors", configuration: config) else { return }
        bindDataChannel(channel)
    }

    func pushVideoPixelBuffer(_ pixelBuffer: CVPixelBuffer, timestamp: TimeInterval) {
        let tsNs = Int64(timestamp * 1_000_000_000.0)
        if lastVideoPushNs != 0, tsNs - lastVideoPushNs < 50_000_000 {
            return
        }
        lastVideoPushNs = tsNs
        let buffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer)
        let frame = RTCVideoFrame(buffer: buffer, rotation: ._90, timeStampNs: tsNs)
        videoSource.capturer(videoCapturer, didCapture: frame)
    }

    /// Soft person alpha (BGRA luma=alpha). Same rotation as RGB track.
    func pushAlphaPixelBuffer(_ pixelBuffer: CVPixelBuffer, timestamp: TimeInterval) {
        let tsNs = Int64(timestamp * 1_000_000_000.0)
        if lastAlphaPushNs != 0, tsNs - lastAlphaPushNs < 66_000_000 {
            return
        }
        lastAlphaPushNs = tsNs
        let buffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer)
        let frame = RTCVideoFrame(buffer: buffer, rotation: ._90, timeStampNs: tsNs)
        alphaSource.capturer(alphaCapturer, didCapture: frame)
    }

    func sendDataString(_ text: String) {
        guard let dataChannel, dataChannel.readyState == .open else { return }
        dataChannel.sendData(RTCDataBuffer(data: Data(text.utf8), isBinary: false))
    }

    var isDataOpen: Bool {
        dataChannel?.readyState == .open
    }

    func createAndSendOffer(send: @escaping ([String: Any]) -> Void) {
        guard !makingOffer else { return }
        makingOffer = true
        ensureOutgoingDataChannel()
        let constraints = RTCMediaConstraints(
            mandatoryConstraints: [
                "OfferToReceiveAudio": "false",
                "OfferToReceiveVideo": "false",
            ],
            optionalConstraints: nil
        )
        pc.offer(for: constraints) { [weak self] sdp, error in
            guard let self else { return }
            defer { self.makingOffer = false }
            if let error {
                self.onConnectionState?("offer-failed: \(error.localizedDescription)")
                return
            }
            guard let sdp else { return }
            self.pc.setLocalDescription(sdp) { err in
                if let err {
                    self.onConnectionState?("setLocal-failed: \(err.localizedDescription)")
                    return
                }
                guard let local = self.pc.localDescription else { return }
                send([
                    "type": "offer",
                    "sdp": [
                        "type": local.type.sdpRaw,
                        "sdp": local.sdp,
                    ] as [String: String],
                ])
            }
        }
    }

    func handleAnswer(_ sdpObj: [String: Any]) {
        guard let type = sdpObj["type"] as? String,
              let sdp = sdpObj["sdp"] as? String
        else { return }
        let rd = RTCSessionDescription(type: .type(from: type), sdp: sdp)
        pc.setRemoteDescription(rd) { [weak self] error in
            if let error {
                self?.onConnectionState?("setRemote-failed: \(error.localizedDescription)")
                return
            }
            self?.flushIce()
        }
    }

    func handleIce(_ candidateObj: [String: Any]) {
        if pc.remoteDescription == nil {
            pendingIce.append(candidateObj)
            return
        }
        addIce(candidateObj)
    }

    func close() {
        dataChannel?.close()
        dataChannel = nil
        pc.close()
        pendingIce.removeAll()
    }

    private func bindDataChannel(_ channel: RTCDataChannel) {
        dataChannel = channel
        channel.delegate = self
    }

    private func addIce(_ candidateObj: [String: Any]) {
        guard let candidate = candidateObj["candidate"] as? String else { return }
        let mid = candidateObj["sdpMid"] as? String
        let index = (candidateObj["sdpMLineIndex"] as? NSNumber)?.int32Value
            ?? Int32(candidateObj["sdpMLineIndex"] as? Int ?? 0)
        let ice = RTCIceCandidate(sdp: candidate, sdpMLineIndex: index, sdpMid: mid)
        pc.add(ice) { _ in }
    }

    private func flushIce() {
        let queued = pendingIce
        pendingIce.removeAll()
        for c in queued {
            addIce(c)
        }
    }
}

extension WebRTCPeer: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        var payload: [String: Any] = [
            "candidate": candidate.sdp,
            "sdpMLineIndex": candidate.sdpMLineIndex,
        ]
        if let mid = candidate.sdpMid {
            payload["sdpMid"] = mid
        }
        onLocalIce?(payload)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
        bindDataChannel(dataChannel)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState) {
        let label: String
        switch newState {
        case .new: label = "new"
        case .connecting: label = "connecting"
        case .connected: label = "connected"
        case .disconnected: label = "disconnected"
        case .failed: label = "failed"
        case .closed: label = "closed"
        @unknown default: label = "unknown"
        }
        onConnectionState?(label)
    }
}

extension WebRTCPeer: RTCDataChannelDelegate {
    func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
        switch dataChannel.readyState {
        case .open: onDataOpen?()
        case .closing, .closed: onDataClose?()
        default: break
        }
    }

    func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {}
}

private extension RTCSdpType {
    var sdpRaw: String {
        switch self {
        case .offer: return "offer"
        case .prAnswer: return "pranswer"
        case .answer: return "answer"
        case .rollback: return "rollback"
        @unknown default: return "offer"
        }
    }

    static func type(from raw: String) -> RTCSdpType {
        switch raw.lowercased() {
        case "answer": return .answer
        case "pranswer": return .prAnswer
        case "rollback": return .rollback
        default: return .offer
        }
    }
}
