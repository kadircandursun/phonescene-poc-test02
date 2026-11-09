import SwiftUI

struct ContentView: View {
    @StateObject private var model = AppModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("PhoneScene iOS PoC")
                .font(.largeTitle.bold())
            Text(model.statusText)
                .foregroundStyle(.secondary)
            Text("Tracking: \(model.trackingMode.rawValue)")
            TextField("Pair code", text: $model.pairCode)
                .textFieldStyle(.roundedBorder)
            TextField("Windows host", text: $model.serverHost)
                .textFieldStyle(.roundedBorder)
            Button("Probe ARKit capabilities") {
                model.refreshCapabilities()
            }
            .buttonStyle(.borderedProminent)
            Spacer()
            Text("Build/run requires macOS + Xcode. Windows host cannot compile this target.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
        .onAppear { model.refreshCapabilities() }
    }
}
