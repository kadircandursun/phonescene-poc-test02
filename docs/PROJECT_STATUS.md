# PROJECT_STATUS

**Updated:** 2026-11-09  
**Current phase:** PHASE 1 (Windows Companion) in progress → PHASE 2 scaffold started

## Completed

- TEST 01–04 PoC web pipeline
- PHASE 0 repository audit + docs + Cursor rules
- Git repository initialized
- `/companion/` control panel + `/api/network` + `/api/status`
- Dynamic NIC discovery (no hardcoded IP)
- `npm run companion` launcher
- iOS ARKit source scaffold (not compiled)

## In progress

- Stabilize Companion UX / smoke coverage
- Prepare Phase 2 ARKit feasibility for Mac build host

## Pending

- PHASE 2 device tests (need Mac + iPhone)
- PHASE 3 native iOS ↔ Windows networking
- PHASE 4 Windows 6DoF camera
- PHASE 5 end-to-end native sender

## Last successful build

- `npm run build` (Vite) — after Companion addition
- `npm run smoke` — health/pages/signaling (peer-ready may flake if live Receiver holds role)

## Known problems

- Rust/Tauri unavailable on this PC
- iOS cannot be compiled here
- Web mobile still tunnel-dependent for Safari camera

## Next action

1. Validate Companion APIs + build
2. Expand smoke for `/companion/` + `/api/network`
3. Document user Mac setup for iOS Phase 2

## User actions required

- Optional: install Rust later for Tauri shell
- Required for Phase 2+: macOS/Xcode + physical iPhone
- OBS Virtual Camera remains manual (already OK’d)
