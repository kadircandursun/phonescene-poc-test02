# PhoneScene Project Audit

**Date:** 2026-03-09 (session)  
**Workspace:** `C:\Users\PC\Downloads\phonescene-poc-test02`

## Layout

```text
client/desktop|mobile|companion|shared
server/index.ts, signaling.ts, network.ts
scripts/smoke-test.mjs, start-tunnel.ps1, start-companion.mjs
apps/windows (Tauri deferred — no Rust)
apps/ios (Swift ARKit scaffold — needs Xcode)
docs/
legacy nested copy: phonescene-poc-test02/ (ignore; do not edit)
```

## Stack

- Node.js HTTP + `ws` signaling (`/signal`)
- Vite multi-page client (companion / desktop / mobile)
- WebRTC video + DataChannel sensors
- Three.js room + MediaPipe selfie segmenter
- Broadcast Mode → OBS Window Capture (manual)

## Verified in prior sessions (do not regress)

| Test | Result |
| --- | --- |
| TEST 01 OBS Virtual Camera path | PASS (prior) |
| TEST 02 iPhone WebRTC | PASS (device) |
| TEST 03 3D+seg composite | PASS (PoC) |
| TEST 04 Broadcast 9:16 | PASS (PoC) |

## Not verified / blocked

- Android: out of PoC scope for now
- Native iOS build: **BLOCKED** (no macOS/Xcode on this host)
- Tauri desktop binary: **BLOCKED** (no Rust/cargo)
- Production matting quality: not a PoC gate
- True 6DoF: not yet proven (Phase 2–4)

## Risks

- Cloudflare Quick Tunnel temporary URLs
- Multi-NIC Windows (Hyper-V / ZeroTier / 192.168.x) — now dynamic via `/api/network`
- Safari secure-context still needs HTTPS for web mobile sender
- Nested legacy folder may confuse humans; leave untouched
