# Native matting — RVM (no empty background)

**Default:** Robust Video Matting ONNX + MediaPipe person gate on Receiver.  
**EP:** DirectML → CPU. No empty-bg plate — phone/user may move.

## Product primary (moving capture)

**iPhone Vision** `VNGeneratePersonSegmentationRequest` → second WebRTC video track (`personAlpha`).  
Receiver prefers that soft alpha when present; RVM is fallback until iOS rebuild ships Vision.

## Run

```powershell
npm run matting:download   # once
npm run app                # RVM :8791 + Receiver :8787
```

Health: `http://127.0.0.1:8791/health` → `service: rvm-matting`, `emptyBgRequired: false`

## Not used by default

Background Matting V2 (empty plate) — wrong for handheld ARKit motion.
