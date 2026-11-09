import Foundation

/// Shared app state for the PhoneScene iOS PoC.
/// Build/run requires Xcode on macOS — not verified on Windows.
@MainActor
final class AppModel: ObservableObject {
    enum TrackingMode: String {
        case sixDof
        case threeDofFallback
        case unsupported
    }

    @Published var trackingMode: TrackingMode = .unsupported
    @Published var statusText: String = "Idle"
    @Published var pairCode: String = ""
    @Published var serverHost: String = ""

    /// Placeholder — ARKit capability probe runs only on device/simulator with ARKit.
    func refreshCapabilities() {
        #if canImport(ARKit)
        // Real checks land in ARSessionManager once built with Xcode:
        // ARFaceTrackingConfiguration.isSupported
        // ARFaceTrackingConfiguration.supportsWorldTracking
        statusText = "ARKit import available — device probe pending"
        #else
        statusText = "ARKit not available in this build host"
        trackingMode = .unsupported
        #endif
    }
}
