# DEVELOPMENT_PLAN

## PHASE 0 — Audit ✅

## PHASE 1 — Windows Desktop Companion 🔄

- [x] Network discovery API
- [x] Status/pair API
- [x] Companion UI
- [x] Launcher script
- [ ] Tauri shell (blocked: Rust)
- [ ] Firewall helper with explicit user consent (later)

## PHASE 2 — Native iOS ARKit feasibility

- [x] Swift scaffold
- [ ] Xcode project + signing (Mac)
- [ ] Device capability probes
- [ ] 6DoF vs 3DoF test matrix on hardware

## PHASE 3 — iOS → Windows networking

- Reuse `/signal` + WebRTC where possible
- Prefer LAN; tunnel optional for web only

## PHASE 4 — Windows 6DoF in Three.js

- Keep 3DoF path
- Position + quaternion + recenter

## PHASE 5 — E2E native sender test

- Hardware required; cannot PASS from source alone

## PoC exit → wait for user before productization
