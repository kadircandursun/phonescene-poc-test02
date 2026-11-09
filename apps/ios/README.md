# PhoneScene iOS (Phase 2)

Native Swift + ARKit feasibility scaffold.

## Build durumu

**BLOCKED / NOT VERIFIED on this Windows machine** — Xcode / macOS required.

## Hedef

- AVFoundation front camera
- ARFaceTrackingConfiguration + world tracking when supported
- Real camera transform (6DoF), not face-pose-as-world
- 3DoF fallback
- LAN signaling compatible with existing `/signal` protocol

Kaynak iskeleti: `PhoneSceneIOS/` (Swift dosyaları). Fiziksel cihaz testi Mac’te yapılacak.

## Kaynak dosyalar

- `ARSessionManager.swift` — face + world tracking; camera.transform only
- `PoseWireEncoder.swift` — DataChannel `pose` JSON (docs/PROTOCOL.md)
- `SignalingClient.swift` — `/signal` join (WebRTC media TBD on Mac)
- `AppModel.swift` / `ContentView.swift` — UI shell

## Mac checklist (kullanıcı)

1. Xcode 15+ ile yeni iOS App projesi oluştur; bu Sources’ı ekle.
2. Capabilities: Camera, Motion (gerekirse Local Network).
3. Gerçek iPhone’da capability probe + 6DoF test matrisi.
4. WebRTC framework bağlanınca LAN üzerinden mevcut Windows Receiver’a bağlan.

**Derleme / cihaz sonucu burada PASS yazılamaz.**
