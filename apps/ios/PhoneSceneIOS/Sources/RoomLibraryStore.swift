import Foundation
import UIKit

enum RoomAssetKind: String, Codable {
    case photo
    case usdz
}

/// Local library entry — V1 = photo; USDZ optional later.
struct SavedRoom: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var createdAt: Date
    var kind: RoomAssetKind
    /// Relative file name inside room folder (e.g. cover.jpg / room.usdz)
    var fileName: String
    var wallCount: Int
    var objectCount: Int
    var jsonFileName: String?

    var folderURL: URL {
        RoomLibraryStore.roomsRoot.appendingPathComponent(id, isDirectory: true)
    }

    var assetURL: URL {
        folderURL.appendingPathComponent(fileName)
    }
}

@MainActor
final class RoomLibraryStore: ObservableObject {
    static let roomsRoot: URL = {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("Rooms", isDirectory: true)
    }()

    @Published private(set) var rooms: [SavedRoom] = []
    @Published var selectedRoomId: String? {
        didSet { UserDefaults.standard.set(selectedRoomId, forKey: "selectedRoomId") }
    }

    private let indexURL = RoomLibraryStore.roomsRoot.appendingPathComponent("index.json")

    init() {
        try? FileManager.default.createDirectory(at: Self.roomsRoot, withIntermediateDirectories: true)
        selectedRoomId = UserDefaults.standard.string(forKey: "selectedRoomId")
        reload()
    }

    func reload() {
        guard let data = try? Data(contentsOf: indexURL),
              let decoded = try? JSONDecoder().decode([SavedRoom].self, from: data)
        else {
            rooms = []
            return
        }
        rooms = decoded.sorted { $0.createdAt > $1.createdAt }
        if let id = selectedRoomId, !rooms.contains(where: { $0.id == id }) {
            selectedRoomId = rooms.first?.id
        }
    }

    var selectedRoom: SavedRoom? {
        rooms.first { $0.id == selectedRoomId }
    }

    @discardableResult
    func savePhoto(name: String, image: UIImage, maxSide: CGFloat = 1920) throws -> SavedRoom {
        let id = UUID().uuidString
        let folder = Self.roomsRoot.appendingPathComponent(id, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        let resized = Self.resize(image, maxSide: maxSide)
        guard let data = resized.jpegData(compressionQuality: 0.88) else {
            throw NSError(domain: "RoomLibrary", code: 10, userInfo: [
                NSLocalizedDescriptionKey: "JPEG yazılamadı",
            ])
        }
        let fileName = "cover.jpg"
        try data.write(to: folder.appendingPathComponent(fileName), options: .atomic)

        let room = SavedRoom(
            id: id,
            name: Self.displayName(name),
            createdAt: Date(),
            kind: .photo,
            fileName: fileName,
            wallCount: 0,
            objectCount: 0,
            jsonFileName: nil
        )
        var next = rooms
        next.insert(room, at: 0)
        try writeIndex(next)
        rooms = next
        selectedRoomId = id
        return room
    }

    @discardableResult
    func saveUsdzRoom(
        name: String,
        usdzData: Data,
        jsonData: Data?,
        wallCount: Int,
        objectCount: Int
    ) throws -> SavedRoom {
        let id = UUID().uuidString
        let folder = Self.roomsRoot.appendingPathComponent(id, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        let fileName = "room.usdz"
        try usdzData.write(to: folder.appendingPathComponent(fileName), options: .atomic)

        var jsonName: String?
        if let jsonData {
            jsonName = "room.json"
            try jsonData.write(to: folder.appendingPathComponent(jsonName!), options: .atomic)
        }

        let room = SavedRoom(
            id: id,
            name: Self.displayName(name),
            createdAt: Date(),
            kind: .usdz,
            fileName: fileName,
            wallCount: wallCount,
            objectCount: objectCount,
            jsonFileName: jsonName
        )
        var next = rooms
        next.insert(room, at: 0)
        try writeIndex(next)
        rooms = next
        selectedRoomId = id
        return room
    }

    func rename(_ id: String, to name: String) throws {
        guard let idx = rooms.firstIndex(where: { $0.id == id }) else { return }
        var next = rooms
        next[idx].name = Self.displayName(name)
        try writeIndex(next)
        rooms = next
    }

    func delete(_ id: String) throws {
        let folder = Self.roomsRoot.appendingPathComponent(id, isDirectory: true)
        try? FileManager.default.removeItem(at: folder)
        var next = rooms.filter { $0.id != id }
        try writeIndex(next)
        rooms = next
        if selectedRoomId == id {
            selectedRoomId = next.first?.id
        }
    }

    func select(_ id: String) {
        selectedRoomId = id
    }

    private func writeIndex(_ rooms: [SavedRoom]) throws {
        let data = try JSONEncoder().encode(rooms)
        try data.write(to: indexURL, options: .atomic)
    }

    private static func displayName(_ name: String) -> String {
        let t = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty {
            return "Oda \(DateFormatter.localizedString(from: Date(), dateStyle: .short, timeStyle: .short))"
        }
        return t
    }

    private static func resize(_ image: UIImage, maxSide: CGFloat) -> UIImage {
        let w = image.size.width
        let h = image.size.height
        let longest = max(w, h)
        guard longest > maxSide, longest > 0 else { return image }
        let scale = maxSide / longest
        let size = CGSize(width: w * scale, height: h * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}
