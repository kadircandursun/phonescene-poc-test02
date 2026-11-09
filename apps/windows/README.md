# PhoneScene Windows App

## Karar (DECISIONS.md ile uyumlu)

**PoC Phase 1:** Tauri 2 hedeflenir, ancak bu makinede **Rust/cargo yok**.

Bu yüzden çalışan Companion şimdilik:

- Web kontrol paneli: `/companion/`
- Launcher: `npm run companion` (`scripts/start-companion.mjs`)
- Mevcut Node signaling + Receiver korunur

Tauri kabuğu Rust kurulunca `apps/windows` altına eklenecek; medya pipeline yeniden yazılmayacak (WebView Receiver’ı açacak).

## Rust kurulunca

```powershell
winget install Rustlang.Rustup
# yeni shell
npm create tauri-app@latest
```

Receiver URL: `http://127.0.0.1:8787/desktop/`  
Companion URL: `http://127.0.0.1:8787/companion/`
