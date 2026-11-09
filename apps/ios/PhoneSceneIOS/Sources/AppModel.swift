import Foundation
import SwiftUI

#if canImport(ARKit)
import ARKit
#endif

/// Shared app state for the PhoneScene iOS PoC feasibility build.
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
    @Published var poseLine: String = "pose: —"
    @Published var sessionRunning = false
    @Published var faceSupported = false
    @Published var worldTrackingSupported = false

    private let ar = ARSessionManager()

    init() {
        ar.onStatus = { [weak self] text in
            Task { @MainActor in
                self?.statusText = text
            }
        }
        ar.onPose = { [weak self] sample in
            Task { @MainActor in
                self?.poseLine = String(
                    format: "t=%.3f  p=(%.3f, %.3f, %.3f)  %@",
                    sample.timestamp,
                    sample.position.x,
                    sample.position.y,
                    sample.position.z,
                    sample.trackingState
                )
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
}
