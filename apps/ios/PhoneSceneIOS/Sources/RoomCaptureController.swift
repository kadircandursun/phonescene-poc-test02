import Foundation
import SwiftUI

#if canImport(RoomPlan)
import RoomPlan
#endif

/// Bridges RoomPlan `RoomCaptureView` into SwiftUI and exports USDZ + JSON.
/// Optional advanced path — V1 product uses photo rooms.
@MainActor
final class RoomCaptureController: ObservableObject {
    @Published var isScanning = false
    @Published var isProcessing = false
    @Published var statusMessage = "Odayı yavaşça tara — duvarlar ve mobilyalar çıksın."
    @Published var lastError: String?
    @Published var canSave = false

    #if canImport(RoomPlan)
    let captureView = RoomCaptureView(frame: .zero)
    private var finalRoom: CapturedRoom?
    private let sessionConfig = RoomCaptureSession.Configuration()
    private lazy var delegateProxy = RoomCaptureDelegateProxy(owner: self)
    #endif

    static var isDeviceSupported: Bool {
        #if canImport(RoomPlan)
        if #available(iOS 16.0, *) {
            return RoomCaptureSession.isSupported
        }
        #endif
        return false
    }

    init() {
        #if canImport(RoomPlan)
        captureView.delegate = delegateProxy
        #endif
    }

    func start() {
        lastError = nil
        canSave = false
        #if canImport(RoomPlan)
        finalRoom = nil
        isScanning = true
        isProcessing = false
        statusMessage = "Tarıyorsun — bitince Durdur’a bas."
        captureView.captureSession.run(configuration: sessionConfig)
        #else
        lastError = "RoomPlan bu derlemede yok"
        #endif
    }

    func stop() {
        #if canImport(RoomPlan)
        guard isScanning else { return }
        isScanning = false
        isProcessing = true
        statusMessage = "Oda işleniyor…"
        captureView.captureSession.stop()
        #endif
    }

    func exportToLibrary(name: String, store: RoomLibraryStore) throws -> SavedRoom {
        #if canImport(RoomPlan)
        guard let room = finalRoom else {
            throw NSError(domain: "RoomCapture", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Kaydedilecek oda yok — taramayı bitir.",
            ])
        }

        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).usdz")
        try room.export(to: tmp)
        let usdzData = try Data(contentsOf: tmp)
        try? FileManager.default.removeItem(at: tmp)

        let jsonData = try? JSONEncoder().encode(room)

        return try store.saveUsdzRoom(
            name: name,
            usdzData: usdzData,
            jsonData: jsonData,
            wallCount: room.walls.count,
            objectCount: room.objects.count
        )
        #else
        throw NSError(domain: "RoomCapture", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "RoomPlan desteklenmiyor",
        ])
        #endif
    }

    #if canImport(RoomPlan)
    fileprivate func handleProcessed(_ room: CapturedRoom?, error: Error?) {
        isProcessing = false
        if let error {
            lastError = error.localizedDescription
            statusMessage = "İşleme hatası"
            canSave = false
            return
        }
        guard let room else {
            canSave = false
            statusMessage = "Sonuç yok"
            return
        }
        finalRoom = room
        canSave = true
        statusMessage = "Hazır — \(room.walls.count) duvar, \(room.objects.count) nesne. Kaydet."
    }
    #endif
}

#if canImport(RoomPlan)
/// Separate NSObject proxy — RoomCaptureViewDelegate inherits NSObjectProtocol/NSCoding requirements.
private final class RoomCaptureDelegateProxy: NSObject, RoomCaptureViewDelegate {
    weak var owner: RoomCaptureController?

    init(owner: RoomCaptureController) {
        self.owner = owner
        super.init()
    }

    func captureView(
        shouldPresent roomDataForProcessing: CapturedRoomData,
        error: Error?
    ) -> Bool {
        true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        Task { @MainActor in
            self.owner?.handleProcessed(processedResult, error: error)
        }
    }
}

struct RoomCaptureViewRepresentable: UIViewRepresentable {
    let controller: RoomCaptureController

    func makeUIView(context: Context) -> RoomCaptureView {
        controller.captureView
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}
}
#endif
