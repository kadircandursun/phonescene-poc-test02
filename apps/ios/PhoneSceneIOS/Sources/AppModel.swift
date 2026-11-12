import Foundation
import SwiftUI

#if canImport(ARKit)
import ARKit
#endif

/// Shared app state for the PhoneScene iOS PoC (ARKit + LAN WebRTC).
@MainActor
final class AppModel: ObservableObject {
    enum TrackingMode: String {
        case sixDof = "6DoF"
        case threeDofFallback = "3DoF fallback"
        case unsupported = "unsupported"
    }

    @Published var trackingMode: TrackingMode = .unsupported
    @Published var statusText: String = "Idle"
    @Published var pairCode: String = ""
    @Published var serverHost: String = "192.168.1.103"
    @Published var serverPort: String = "8787"
    @Published var poseLine: String = "pose: —"
    @Published var sessionRunning = false
    @Published var signalState: String = "Sinyal: kapalı"
    @Published var webrtcState: String = "WebRTC: —"
    @Published var dataState: String = "DataChannel: kapalı"
    @Published var faceSupported = false
    @Published var worldTrackingSupported = false
    @Published var connecting = false
    @Published var roomUploadStatus: String = ""

    private let ar = ARSessionManager()
    private let signaling = SignalingClient()
    private let personMatte = PersonMatteEngine()
    private var peer: WebRTCPeer?

    init() {
        ar.onStatus = { [weak self] text in
            Task { @MainActor in
                self?.statusText = text
            }
        }
        ar.onPose = { [weak self] sample in
            Task { @MainActor in
                self?.handlePose(sample)
            }
        }
        signaling.onState = { [weak self] text in
            Task { @MainActor in
                self?.signalState = "Sinyal: \(text)"
            }
        }
        signaling.onMessage = { [weak self] msg in
            Task { @MainActor in
                self?.handleSignal(msg)
            }
        }
    }

    func refreshCapabilities() {
        #if canImport(ARKit)
        faceSupported = ARFaceTrackingConfiguration.isSupported
        worldTrackingSupported = ARFaceTrackingConfiguration.supportsWorldTracking
        if !faceSupported {
            trackingMode = .unsupported
            statusText = "ARFaceTrackingConfiguration unsupported on this device"
            return
        }
        if worldTrackingSupported {
            trackingMode = .sixDof
            statusText = "Face + world tracking available (6DoF candidate)"
        } else {
            trackingMode = .threeDofFallback
            statusText = "Face tracking only — expect 3DoF fallback"
        }
        #else
        trackingMode = .unsupported
        statusText = "ARKit not linked in this build"
        #endif
    }

    func startSession() {
        refreshCapabilities()
        statusText = "Kamera izni isteniyor…"
        ar.start()
        sessionRunning = true
    }

    func stopSession() {
        ar.stop()
        sessionRunning = false
        statusText = "Session stopped"
    }

    func connectCompanion() {
        let code = pairCode.filter(\.isNumber)
        pairCode = String(code.prefix(6))
        guard pairCode.count == 6 else {
            statusText = "6 haneli eşleştirme kodu gir"
            return
        }
        guard let port = Int(serverPort), (1 ... 65535).contains(port) else {
            statusText = "Geçersiz port"
            return
        }
        let host = serverHost.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty else {
            statusText = "Windows host IP gir"
            return
        }

        if !sessionRunning {
            startSession()
        }

        connecting = true
        statusText = "Sinyale bağlanıyor…"
        signaling.connect(host: host, port: port, pairCode: pairCode)
    }

    func disconnectCompanion() {
        signaling.send(["type": "bye"])
        signaling.close()
        peer?.close()
        peer = nil
        connecting = false
        webrtcState = "WebRTC: —"
        dataState = "DataChannel: kapalı"
        signalState = "Sinyal: kapalı"
        statusText = "Companion bağlantısı kesildi"
    }

    /// Upload selected room photo to Windows Receiver (`POST /api/room/background`).
    func uploadRoomPhoto(_ room: SavedRoom) async {
        guard room.kind == .photo else {
            roomUploadStatus = "Sadece fotoğraf odaları PC’ye gider (V1)."
            return
        }
        let host = serverHost.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let port = Int(serverPort), !host.isEmpty else {
            roomUploadStatus = "Host / port eksik"
            return
        }
        guard let data = try? Data(contentsOf: room.assetURL), !data.isEmpty else {
            roomUploadStatus = "Fotoğraf okunamadı"
            return
        }

        roomUploadStatus = "Oda PC’ye gönderiliyor…"
        var components = URLComponents()
        components.scheme = "http"
        components.host = host
        components.port = port
        components.path = "/api/room/background"
        guard let url = components.url else {
            roomUploadStatus = "URL hatalı"
            return
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        req.setValue(
            room.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? room.name,
            forHTTPHeaderField: "X-Room-Name"
        )
        req.httpBody = data
        req.timeoutInterval = 60

        do {
            let (_, response) = try await URLSession.shared.data(for: req)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if (200 ... 299).contains(code) {
                roomUploadStatus = "Oda gönderildi — Receiver yenilesin"
                statusText = "Oda fotoğrafı PC’de"
            } else {
                roomUploadStatus = "Upload HTTP \(code)"
            }
        } catch {
            roomUploadStatus = "Upload hata: \(error.localizedDescription)"
        }
    }

    private func handlePose(_ sample: ARSessionManager.PoseSample) {
        poseLine = String(
            format: "t=%.3f  p=(%.3f, %.3f, %.3f)  %@",
            sample.timestamp,
            sample.position.x,
            sample.position.y,
            sample.position.z,
            sample.trackingState
        )

        if let buffer = sample.pixelBuffer {
            peer?.pushVideoPixelBuffer(buffer, timestamp: sample.timestamp)
            // Vision person alpha — no empty-bg plate; OK while moving.
            let ts = sample.timestamp
            personMatte.generateMatte(from: buffer) { [weak self] alphaBGRA in
                guard let alphaBGRA else { return }
                Task { @MainActor in
                    self?.peer?.pushAlphaPixelBuffer(alphaBGRA, timestamp: ts)
                }
            }
        }

        guard let peer, peer.isDataOpen else { return }
        let mode6 = trackingMode == .sixDof
        do {
            let data: Data
            if mode6 {
                data = try PoseWireEncoder.encode6DoF(
                    timestamp: sample.timestamp,
                    position: sample.position,
                    rotation: sample.rotation,
                    trackingState: sample.trackingState
                )
            } else {
                data = try PoseWireEncoder.encode3DoFFallback(
                    timestamp: sample.timestamp,
                    rotation: sample.rotation,
                    trackingState: sample.trackingState
                )
            }
            if let text = String(data: data, encoding: .utf8) {
                peer.sendDataString(text)
            }
        } catch {
            /* ignore encode errors */
        }
    }

    private func handleSignal(_ message: [String: Any]) {
        let type = message["type"] as? String ?? ""
        switch type {
        case "joined":
            statusText = "Eşleşme OK — Windows bekleniyor"
            signalState = "Sinyal: joined"
        case "peer-ready":
            statusText = "PC hazır — WebRTC offer…"
            signalState = "Sinyal: peer-ready"
            startWebRTCOffer()
        case "peer-left":
            peer?.close()
            peer = nil
            webrtcState = "WebRTC: peer-left"
            dataState = "DataChannel: kapalı"
            statusText = "Windows ayrıldı"
        case "answer":
            if let sdp = message["sdp"] as? [String: Any] {
                peer?.handleAnswer(sdp)
            }
        case "ice":
            if let candidate = message["candidate"] as? [String: Any] {
                peer?.handleIce(candidate)
            }
        case "error":
            statusText = "Sunucu: \(message["message"] as? String ?? "hata")"
            connecting = false
        default:
            break
        }
    }

    private func startWebRTCOffer() {
        peer?.close()
        let p = WebRTCPeer()
        p.onConnectionState = { [weak self] state in
            Task { @MainActor in
                self?.webrtcState = "WebRTC: \(state)"
                if state == "connected" {
                    self?.statusText = "WebRTC bağlı"
                    self?.connecting = false
                }
            }
        }
        p.onDataOpen = { [weak self] in
            Task { @MainActor in
                self?.dataState = "DataChannel: açık"
                self?.statusText = "DataChannel açık — pose gidiyor"
            }
        }
        p.onDataClose = { [weak self] in
            Task { @MainActor in
                self?.dataState = "DataChannel: kapalı"
            }
        }
        p.onLocalIce = { [weak self] candidate in
            self?.signaling.send(["type": "ice", "candidate": candidate])
        }
        peer = p
        p.createAndSendOffer { [weak self] msg in
            self?.signaling.send(msg)
        }
    }
}
