import SwiftUI
import PhotosUI
import UIKit

struct RoomLibraryView: View {
    @ObservedObject var store: RoomLibraryStore
    var onWillCapture: (() -> Void)? = nil
    @State private var showCamera = false
    @State private var pickerItem: PhotosPickerItem?
    @State private var renameTarget: SavedRoom?
    @State private var renameText = ""
    @State private var pendingName = ""
    @State private var pendingImage: UIImage?
    @State private var askName = false
    @State private var errorText: String?

    var body: some View {
        List {
            Section {
                Button {
                    onWillCapture?()
                    showCamera = true
                } label: {
                    Label("Fotoğraf çek", systemImage: "camera.fill")
                }

                PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label("Galeriden seç", systemImage: "photo.on.rectangle")
                }
            } header: {
                Text("Oda ekle")
            } footer: {
                Text("V1: oda fotoğrafı çek veya galeriden seç. 3D tarama sonra.")
            }

            Section {
                if store.rooms.isEmpty {
                    Text("Henüz oda yok. Oturduğun yerin fotoğrafını ekle.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(store.rooms) { room in
                        Button {
                            store.select(room.id)
                        } label: {
                            HStack(spacing: 12) {
                                roomThumb(room)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(room.name)
                                        .font(.headline)
                                        .foregroundStyle(.primary)
                                    Text(room.kind == .photo ? "Fotoğraf" : "3D USDZ · \(room.wallCount) duvar")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(room.createdAt.formatted(date: .abbreviated, time: .shortened))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if store.selectedRoomId == room.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                try? store.delete(room.id)
                            } label: {
                                Label("Sil", systemImage: "trash")
                            }
                            Button {
                                renameTarget = room
                                renameText = room.name
                            } label: {
                                Label("Ad", systemImage: "pencil")
                            }
                            .tint(.indigo)
                        }
                        .contextMenu {
                            Button("Seç") { store.select(room.id) }
                        }
                    }
                }
            } header: {
                Text("Kayıtlı odalar")
            }

            if let err = errorText {
                Section { Text(err).foregroundStyle(.red).font(.footnote) }
            }
        }
        .navigationTitle("Odalarım")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in
                pendingImage = image
                pendingName = ""
                askName = true
            }
            .ignoresSafeArea()
        }
        .onChange(of: pickerItem) { item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data)
                {
                    pendingImage = image
                    pendingName = ""
                    askName = true
                } else {
                    errorText = "Görsel yüklenemedi"
                }
                pickerItem = nil
            }
        }
        .alert("Oda adı", isPresented: $askName) {
            TextField("Örn. Ev ofis", text: $pendingName)
            Button("Kaydet") {
                guard let image = pendingImage else { return }
                do {
                    _ = try store.savePhoto(name: pendingName, image: image)
                    pendingImage = nil
                } catch {
                    errorText = error.localizedDescription
                }
            }
            Button("İptal", role: .cancel) { pendingImage = nil }
        } message: {
            Text("Bu fotoğraf arka planın olacak.")
        }
        .alert("Oda adı", isPresented: Binding(
            get: { renameTarget != nil },
            set: { if !$0 { renameTarget = nil } }
        )) {
            TextField("Ad", text: $renameText)
            Button("Kaydet") {
                if let id = renameTarget?.id {
                    try? store.rename(id, to: renameText)
                }
                renameTarget = nil
            }
            Button("İptal", role: .cancel) { renameTarget = nil }
        }
    }

    @ViewBuilder
    private func roomThumb(_ room: SavedRoom) -> some View {
        if room.kind == .photo, let ui = UIImage(contentsOfFile: room.assetURL.path) {
            Image(uiImage: ui)
                .resizable()
                .scaledToFill()
                .frame(width: 56, height: 56)
                .clipped()
                .cornerRadius(8)
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.secondary.opacity(0.15))
                .frame(width: 56, height: 56)
                .overlay {
                    Image(systemName: room.kind == .photo ? "photo" : "cube")
                        .foregroundStyle(.secondary)
                }
        }
    }
}

/// Simple UIKit camera wrapper (rear camera for room photo).
struct CameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
            picker.cameraCaptureMode = .photo
        } else {
            picker.sourceType = .photoLibrary
        }
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(parent: CameraPicker) { self.parent = parent }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImage(image)
            }
            parent.dismiss()
        }
    }
}
