# DEVELOPMENT_PLAN

## PHASE 0 — Audit ✅

## PHASE 1 — Windows Desktop Companion ✅ (Tauri deferred)

- [x] Network discovery API
- [x] Status/pair API
- [x] Companion UI
- [x] Launcher script
- [x] Smoke coverage
- [ ] Tauri shell (blocked: Rust)
- [ ] Firewall helper with explicit user consent (later)

## PHASE 2 — Native iOS ARKit feasibility 🔄

- [x] Swift scaffold + capability hooks
- [x] PoseWireEncoder / SignalingClient stubs
- [x] XcodeGen `project.yml` + Info.plist + App icon
- [x] GitHub Actions unsigned IPA (Sideloadly) workflow
- [ ] Push to GitHub + first IPA artifact
- [ ] Sideload on physical iPhone
- [ ] Device capability probes + 6DoF matrix (user evidence)


## PHASE 3 — iOS → Windows networking 🔄 (protocol ✅ · media BLOCKED)

- [x] Document DataChannel `sensor` + `pose` (docs/PROTOCOL.md)
- [x] Receiver accepts both payloads
- [ ] Native WebRTC on iOS (Mac)
- [ ] LAN discovery / QR pairing UX
- Prefer LAN; tunnel optional for web Safari only

## PHASE 4 — Windows 6DoF in Three.js 🔄 (code ✅ · hardware NOT TESTED)

- [x] Keep 3DoF OrientationTracker path
- [x] SixDofTracker + ARKit axis map + recenter
- [x] Unit tests for axis mapping
- [ ] Live iPhone 6DoF validation

## PHASE 5 — E2E native sender test ⏳

- Hardware required; cannot PASS from source alone

## PoC exit → wait for user before productization
