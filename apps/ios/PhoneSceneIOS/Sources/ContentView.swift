import SwiftUI

struct ContentView: View {
    @StateObject private var model = AppModel()
    @StateObject private var roomStore = RoomLibraryStore()
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case pairCode, host, port
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Mervelere")
                            .font(.title.bold())
                        Text("Kendi mekânına yerleş · PhoneScene PoC")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(Color.clear)
                }

                Section("Odalarım") {
                    NavigationLink {
                        RoomLibraryView(store: roomStore) {
                            if model.sessionRunning { model.stopSession() }
                        }
                    } label: {
                        HStack {
                            Label("Oda kütüphanesi", systemImage: "building.2.fill")
                            Spacer()
                            Text(roomStore.selectedRoom?.name ?? "Seçilmedi")
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }

                    if let selected = roomStore.selectedRoom {
                        Text(selected.kind == .photo
                            ? "Seçili: fotoğraf arka plan"
                            : "Seçili: 3D USDZ (\(selected.wallCount) duvar)")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if selected.kind == .photo {
                            Button {
                                dismissKeyboard()
                                Task { await model.uploadRoomPhoto(selected) }
                            } label: {
                                Label("Seçili odayı PC’ye gönder", systemImage: "square.and.arrow.up")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    } else {
                        Text("Odanın fotoğrafını ekle — başka yerdeyken arka planın o olsun.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if !model.roomUploadStatus.isEmpty {
                        Text(model.roomUploadStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Bağlantı") {
                    TextField("Eşleştirme kodu (6 hane)", text: $model.pairCode)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .focused($focusedField, equals: .pairCode)
                        .onChange(of: model.pairCode) { newValue in
                            let digits = newValue.filter(\.isNumber)
                            if digits != newValue || digits.count > 6 {
                                model.pairCode = String(digits.prefix(6))
                            }
                        }

                    TextField("Windows IP", text: $model.serverHost)
                        .keyboardType(.decimalPad)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .host)

                    TextField("Port", text: $model.serverPort)
                        .keyboardType(.numberPad)
                        .focused($focusedField, equals: .port)

                    Button {
                        dismissKeyboard()
                        model.connectCompanion()
                    } label: {
                        Label(
                            model.connecting ? "Bağlanıyor…" : "PC’ye bağlan",
                            systemImage: "link"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.connecting)

                    Button(role: .destructive) {
                        dismissKeyboard()
                        model.disconnectCompanion()
                    } label: {
                        Label("Bağlantıyı kes", systemImage: "xmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                }

                Section("AR oturumu") {
                    Button {
                        dismissKeyboard()
                        if model.sessionRunning { model.stopSession() }
                        else { model.startSession() }
                    } label: {
                        Label(
                            model.sessionRunning ? "AR’ı durdur" : "AR’ı başlat",
                            systemImage: model.sessionRunning ? "stop.circle.fill" : "play.circle.fill"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(model.sessionRunning ? .orange : .green)

                    Button {
                        dismissKeyboard()
                        model.refreshCapabilities()
                    } label: {
                        Label("Yetenekleri yenile", systemImage: "arrow.clockwise")
                    }
                }

                Section("Durum") {
                    statusRow("Face tracking", model.faceSupported ? "Evet" : "Hayır")
                    statusRow("World tracking", model.worldTrackingSupported ? "Evet" : "Hayır")
                    statusRow("Mod", model.trackingMode.rawValue)
                    statusRow("Sinyal", model.signalState.replacingOccurrences(of: "Sinyal: ", with: ""))
                    statusRow("WebRTC", model.webrtcState.replacingOccurrences(of: "WebRTC: ", with: ""))
                    statusRow("DataChannel", model.dataState.replacingOccurrences(of: "DataChannel: ", with: ""))

                    VStack(alignment: .leading, spacing: 6) {
                        Text(model.statusText)
                            .font(.callout)
                        Text(model.poseLine)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                    .padding(.vertical, 2)
                }

                Section("Nasıl kullanılır") {
                    Text("""
                    1. Odalarım → fotoğraf çek veya galeriden seç.
                    2. PC’de Companion + kod → bağlan.
                    3. AR’ı başlat (selfie).
                    4. Sonra: foto PC’de arka plan, sen kesilip üzerine konacaksın.
                    """)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Mervelere")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Tamam") { dismissKeyboard() }
                        .fontWeight(.semibold)
                }
            }
            .onAppear { model.refreshCapabilities() }
        }
    }

    private func statusRow(_ title: String, _ value: String) -> some View {
        LabeledContent(title) {
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }

    private func dismissKeyboard() {
        focusedField = nil
    }
}

#Preview {
    ContentView()
}
