import Foundation

/// Minimal WebSocket join client matching existing `/signal` protocol.
/// Full WebRTC media path lands on Mac with a WebRTC pod / framework — NOT verified here.
final class SignalingClient: NSObject {
    enum Role: String {
        case mobile
    }

    var onMessage: (([String: Any]) -> Void)?
    var onState: ((String) -> Void)?

    private var task: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .default)

    func connect(host: String, port: Int, pairCode: String) {
        guard pairCode.count == 6, pairCode.allSatisfy(\.isNumber) else {
            onState?("invalid pair code")
            return
        }
        var components = URLComponents()
        components.scheme = "ws"
        components.host = host
        components.port = port
        components.path = "/signal"
        guard let url = components.url else {
            onState?("bad url")
            return
        }

        task = session.webSocketTask(with: url)
        task?.resume()
        onState?("connecting")
        receiveLoop()
        send(["type": "join", "code": pairCode, "role": Role.mobile.rawValue])
    }

    func send(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object),
              let text = String(data: data, encoding: .utf8)
        else { return }
        task?.send(.string(text)) { [weak self] error in
            if let error {
                self?.onState?("send error: \(error.localizedDescription)")
            }
        }
    }

    func close() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        onState?("closed")
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                self.onState?("recv error: \(error.localizedDescription)")
            case .success(let message):
                if case let .string(text) = message,
                   let data = text.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                {
                    self.onMessage?(json)
                }
                self.receiveLoop()
            }
        }
    }
}
