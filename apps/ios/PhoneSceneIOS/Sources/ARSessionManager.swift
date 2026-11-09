import Foundation
import CoreGraphics

#if canImport(ARKit)
import ARKit
#endif


/// Captures front-camera frames + camera transform when world tracking is supported.
/// IMPORTANT: Face anchor pose ≠ phone world pose. Use frame.camera.transform only.
final class ARSessionManager: NSObject {
    struct PoseSample {
        var timestamp: TimeInterval
        var position: SIMD3<Float>
        var rotation: simd_quatf
        var trackingState: String
        var intrinsics: simd_float3x3?
    }

    var onPose: ((PoseSample) -> Void)?
    var onStatus: ((String) -> Void)?

    #if canImport(ARKit)
    private let session = ARSession()
    #endif

    func start() {
        #if canImport(ARKit)
        guard ARFaceTrackingConfiguration.isSupported else {
            onStatus?("ARFaceTrackingConfiguration unsupported — use 3DoF fallback")
            return
        }

        let config = ARFaceTrackingConfiguration()
        if ARFaceTrackingConfiguration.supportsWorldTracking {
            config.isWorldTrackingEnabled = true
            onStatus?("Face + world tracking enabled (6DoF candidate)")
        } else {
            onStatus?("Face tracking only — 3DoF fallback")
        }

        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        #else
        onStatus?("ARKit unavailable on this host")
        #endif
    }

    func stop() {
        #if canImport(ARKit)
        session.pause()
        #endif
    }
}

#if canImport(ARKit)
extension ARSessionManager: ARSessionDelegate {
    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let t = frame.camera.transform
        let position = SIMD3<Float>(t.columns.3.x, t.columns.3.y, t.columns.3.z)
        let rotation = simd_quatf(t)
        let state: String
        switch frame.camera.trackingState {
        case .normal: state = "normal"
        case .limited(let reason): state = "limited:\(String(describing: reason))"
        case .notAvailable: state = "notAvailable"
        @unknown default: state = "unknown"
        }

        onPose?(
            PoseSample(
                timestamp: frame.timestamp,
                position: position,
                rotation: rotation,
                trackingState: state,
                intrinsics: frame.camera.intrinsics
            )
        )
    }
}
#endif
