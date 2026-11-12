# PhoneScene Windows App

## Pipeline (şimdi)

1. iPhone Mervelere → LAN WebRTC  
2. **Matting Engine** — MODNet/ONNX (standart GPU); RTX SDK hook (ürün) → `matting/`  
3. Soft alpha + edge refinement  
4. Three.js 3D compositor (Receiver `/desktop/`)  
5. Virtual cam — OBS (PoC) / native (ürün)

## Companion shell

**PoC:** `/companion/` + `npm run companion` (Rust/Tauri yok bu host’ta).  
Tauri sonra WebView ile aynı Receiver URL’ini açar; medya sözleşmesi değişmez.

Receiver: `http://127.0.0.1:8787/desktop/`  
Companion: `http://127.0.0.1:8787/companion/`
