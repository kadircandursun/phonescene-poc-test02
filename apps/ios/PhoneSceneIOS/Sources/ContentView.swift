import SwiftUI

struct ContentView: View {
    @StateObject private var model = AppModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Mervelere")
                    .font(.largeTitle.bold())
                Text("PhoneScene ARKit PoC")
                    .foregroundStyle(.secondary)

                Group {
                    LabeledContent("Face tracking") {
                        Text(model.faceSupported ? "yes" : "no")
                    }
                    LabeledContent("World tracking") {
                        Text(model.worldTrackingSupported ? "yes" : "no")
                    }
                    LabeledContent("Mode") {
                        Text(model.trackingMode.rawValue)
                    }
                }

                Text(model.statusText)
                    .font(.callout)
                Text(model.poseLine)
                    .font(.system(.footnote, design: .monospaced))
                    .textSelection(.enabled)

                TextField("Pair code (ileride)", text: $model.pairCode)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                TextField("Windows host", text: $model.serverHost)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                HStack {
                    Button(model.sessionRunning ? "Stop AR" : "Start AR") {
                        if model.sessionRunning { model.stopSession() }
                        else { model.startSession() }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Probe") { model.refreshCapabilities() }
                        .buttonStyle(.bordered)
                }

                Text(
                    """
                    Notlar:
                    • Face anchor ≠ telefon world pose; sadece camera.transform kullanılır.
                    • 6DoF doğrulama gerçek iPhone ister (simülatör yetersiz).
                    • WebRTC henüz bu build’de yok — önce ARKit kanıtı.
                    """
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
            .padding()
        }
        .onAppear { model.refreshCapabilities() }
    }
}
