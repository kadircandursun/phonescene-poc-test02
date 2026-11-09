import Foundation
import simd

/// Encodes ARKit camera pose into the PhoneScene DataChannel JSON schema.
/// Must use frame.camera.transform — never face-anchor pose as world pose.
enum PoseWireEncoder {
    struct PoseJSON: Encodable {
        let type = "pose"
        let mode: String
        let t: Double
        let px: Float?
        let py: Float?
        let pz: Float?
        let qx: Float
        let qy: Float
        let qz: Float
        let qw: Float
        let trackingState: String
        let fovY: Float?
    }

    static func encode6DoF(
        timestamp: TimeInterval,
        position: SIMD3<Float>,
        rotation: simd_quatf,
        trackingState: String,
        fovYDegrees: Float? = nil
    ) throws -> Data {
        let body = PoseJSON(
            mode: "6dof",
            t: timestamp * 1000.0,
            px: position.x,
            py: position.y,
            pz: position.z,
            qx: rotation.vector.x,
            qy: rotation.vector.y,
            qz: rotation.vector.z,
            qw: rotation.vector.w,
            trackingState: trackingState,
            fovY: fovYDegrees
        )
        return try JSONEncoder().encode(body)
    }

    static func encode3DoFFallback(
        timestamp: TimeInterval,
        rotation: simd_quatf,
        trackingState: String = "3dof-fallback"
    ) throws -> Data {
        let body = PoseJSON(
            mode: "3dof",
            t: timestamp * 1000.0,
            px: nil,
            py: nil,
            pz: nil,
            qx: rotation.vector.x,
            qy: rotation.vector.y,
            qz: rotation.vector.z,
            qw: rotation.vector.w,
            trackingState: trackingState,
            fovY: nil
        )
        return try JSONEncoder().encode(body)
    }
}
