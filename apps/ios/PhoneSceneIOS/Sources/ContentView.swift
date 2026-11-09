import SwiftUI

struct ContentView: View {
    @StateObject private var model = AppModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Mervelere")
                    .font(.largeTitle.bold())
                Text("PhoneScene ARKit + WebRTC PoC")
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

                Text(model.signalState).font(.footnote)
                Text(model.webrtcState).font(.footnote)
                Text(model.dataState).font(.footnote)

                TextField("Pair code (6 hane)", text: $model.pairCode)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                TextField("Windows host IP", text: $model.serverHost)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                TextField("Port", text: $model.serverPort)
                    .keyboardType(.numberPad)
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

                HStack {
                    Button("Connect PC") { model.connectCompanion() }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.connecting && model.webrtcState.contains("connecting"))
                    Button("Disconnect") { model.disconnectCompanion() }
                        .buttonStyle(.bordered)
                }

                Text(
                    """
                    Akış:
                    1) PC’de npm run companion → Receiver aç → pair kodunu al
                    2) Buraya host IP + kod → Start AR → Connect PC
                    3) Receiver’da video + poseHz / oda kamerası hareketi
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
