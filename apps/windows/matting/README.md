# Windows Matting Engine (universal)

**Requirement:** Her PC’de çalışır — RTX zorunlu değil.

## Seçim

| | |
| --- | --- |
| Model | **Robust Video Matting (RVM)** ONNX — soft alpha, zamansal stabil |
| Runtime | `onnxruntime-node` |
| GPU | **DirectML** (NVIDIA / AMD / Intel DX12) |
| Fallback | **CPU** (yavaş ama çalışır) |
| Host | Native Windows app (tarayıcı WASM değil) |
| RTX Maxine | İsteğe bağlı hızlandırıcı — asla zorunlu bağımlılık değil |

## Neden browser değil?

Browser MODNet/WASM: hayalet matte + ağır kasılma (cihazda görüldü).  
MediaPipe: görünür ama kenar “makas” — “çok iyi” değil.

## Klasör planı

```text
apps/windows/matting-native/   ← Node RVM motor (DirectML→CPU)
models/rvm/                    ← indirilen ONNX
client/desktop/…               ← geçici MediaPipe; app’e taşınınca matte native’den gelir
```

## Sözleşme

- In: BGR/RGB frame (phone decode)
- Out: soft alpha `Float32` / `Uint8` aynı çözünürlük
- Sonraki: edge refine → 3D composite → OBS / native VC
