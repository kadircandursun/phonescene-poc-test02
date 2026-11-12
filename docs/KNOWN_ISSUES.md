# KNOWN_ISSUES

## P1 — Host tooling gaps

- No Rust → Tauri Windows app binary blocked
- No macOS/Xcode → iOS build/device tests blocked

## P1 — TestFlight build 1 crash on Start AR (fixed in build 2)

- Symptom: Start AR → no camera prompt → app killed
- Cause: shipped IPA Info.plist lacked `NSCameraUsageDescription` (`GENERATE_INFOPLIST_FILE` not forced `NO`)
- Fix: explicit Info.plist + CI PlistBuddy gate + AVCapture permission request

## P1 — UI letterbox / “ekran kesik” (fixed in build 7)

- Symptom: Form floats as a cut card on black; top/bottom (and side) bars; content clipped mid-row
- Cause: shipped IPA **missing `UILaunchScreen`** — XcodeGen regenerated Info.plist from `project.yml` `info.properties` and stripped the key; `INFOPLIST_KEY_UILaunchScreen_Generation` is ignored when `GENERATE_INFOPLIST_FILE=NO`
- Evidence: build 6 IPA Info.plist keys had no `UILaunchScreen` / no storyboard
- Effect: iOS compatibility letterboxing (non-fullscreen window)
- Fix: keep `UILaunchScreen: {}` in `project.yml` + CI refuse export/upload if missing

## P2 — Web mobile networking

- Safari camera still needs HTTPS secure context (tunnel) for web sender
- Native iOS will remove this constraint later

## P3 — Multi-homed Windows NICs

- Hyper-V / ZeroTier / APIPA present; mitigated by adapter scoring
- This host may lack a physical Wi‑Fi NIC entry; recommended address can be bridged Hyper‑V (Anka2-External). Confirm phone reachability manually.

## P4 — PoC quality (non-blocking)

- Empty-bg BGM abandoned for moving PhoneScene (plate breaks when phone/user moves)
- Vision soft-alpha in TestFlight build 6 — device E2E pending; until then RVM+gate (chair risk)
- RVM alone can keep gaming chair; person gate helps but imperfect
- RoomPlan deferred post-V1 (NSCoding/RoomCaptureViewDelegate archive issues)
- NVIDIA RTX matting SDK not linked (stub only)
- OBS Window Capture can fail if browser minimized

## P5 — Smoke flake

- `peer-ready` smoke can timeout if a live desktop/mobile already occupies roles
