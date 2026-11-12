# ARCHITECTURE

```text
[iPhone Mervelere]
  Camera + ARKit · Video + 3DoF/6DoF
  Vision person soft-alpha (Neural Engine)  ← no empty-bg plate
        │  LAN WebRTC (RGB + alpha tracks)
        ▼
[Windows Desktop App]
  ├─ WebRTC receive (video + optional phone alpha + pose)
  ├─ Matting
  │    primary: phone Vision alpha (when track present)
  │    fallback: RVM ONNX + MediaPipe person gate
  │    EP: DirectML → CPU (no RTX required)
  ├─ Soft alpha composite
  ├─ 3D Scene Compositor
  └─ Virtual Camera (PoC: OBS Window Capture)
```

## Universal Windows rule

| Layer | Choice | Why |
| --- | --- | --- |
| Cutout | **Phone Vision α** → RVM+gate | User/phone move; empty-bg BGM rejected |
| GPU | **DirectML** then **CPU** | All PCs; no RTX lock-in |
| Host | Native app later; PoC = browser Receiver + Node | Tauri blocked without Rust |

## Non-goals

- Empty-background capture as product UX  
- RTX-only path  
- Android (until approved)
