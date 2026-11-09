# PROJECT_STATUS

**Updated:** 2026-11-09  
**Current phase:** PHASE 1 done · PHASE 2/3 source ready · **BLOCKED on Mac/iPhone for device proof** · PHASE 4 Windows 6DoF plumbing landed (unverified on hardware)

## Completed

- TEST 01–04 PoC web pipeline
- PHASE 0 audit + docs + Cursor rules
- Git checkpoint `743cd31` (+ follow-up commits)
- Windows Companion (`/companion/`, `/api/network`, `/api/status`, `npm run companion`)
- Expanded smoke: companion + network + status — **PASS**
- iOS Swift scaffold: ARSession, PoseWireEncoder, SignalingClient
- Shared `pose` DataChannel protocol + Windows `SixDofTracker` (3DoF preserved)
- `npm run test:pose` mapping unit tests

## In progress / blocked

- PHASE 2 device ARKit validation — needs Mac + iPhone
- PHASE 3 native WebRTC media — needs iOS WebRTC build on Mac
- PHASE 4 hardware confirmation of 6DoF parallax — needs native sender
- PHASE 5 E2E — hardware

## Pending

- Optional Tauri shell (Rust not installed)
- Firewall helper with explicit consent
- Native virtual camera (post-PoC)

## Last successful build / tests

- `npm run build` / `npm run check` (this session target)
- `npm run smoke` — PASS (peer-ready can flake if live Receiver holds roles)
- `npm run test:pose` — PASS
- Device ARKit / native LAN — **NOT TESTED**

## Known problems

- No physical Wi‑Fi NIC listed on this host; recommended IP is bridged Hyper‑V `192.168.1.103` (Anka2-External) — user must confirm phone reaches that LAN
- Rust/Tauri unavailable
- iOS cannot compile on Windows
- Safari still tunnel-dependent for camera secure context

## Next action

1. Keep Windows Receiver + Companion running for existing Safari path
2. Await Mac/Xcode + iPhone for Phase 2–5
3. Do not start Android or productization

## User actions required

- **Required for Phase 2+:** macOS/Xcode + physical iPhone
- Confirm phone and PC share LAN reachable at Companion-recommended address
- Optional later: install Rust for Tauri shell
