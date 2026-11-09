# KNOWN_ISSUES

## P1 — Host tooling gaps

- No Rust → Tauri Windows app binary blocked
- No macOS/Xcode → iOS build/device tests blocked

## P2 — Web mobile networking

- Safari camera still needs HTTPS secure context (tunnel) for web sender
- Native iOS will remove this constraint later

## P3 — Multi-homed Windows NICs

- Hyper-V / ZeroTier / APIPA present; mitigated by adapter scoring
- This host may lack a physical Wi‑Fi NIC entry; recommended address can be bridged Hyper‑V (Anka2-External). Confirm phone reachability manually.

## P4 — PoC quality (non-blocking)

- Segmentation edges not broadcast-invisible
- OBS Window Capture can fail if browser minimized

## P5 — Smoke flake

- `peer-ready` smoke can timeout if a live desktop/mobile already occupies roles
