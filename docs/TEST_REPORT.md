# TEST_REPORT

## TEST 01 — Virtual Camera

- Result: **PASS** (prior session / user)
- Method: OBS Virtual Camera path

## TEST 02 — Mobile WebRTC

- Device: iPhone Safari
- Result: **PASS**
- Notes: Cloudflare Quick Tunnel HTTPS

## TEST 03 — 3D Composite

- Result: **PASS (PoC)**
- Notes: MediaPipe quality not product-grade; **MODNet/ONNX soft-alpha path added 2026-11-09** (device re-verify pending)

## TEST 04 — Broadcast / OBS

- Result: **PASS (PoC)** per user confirmation
- Output: 9:16 720×1280
- Orientation pitch fix verified by user

## Companion APIs (Phase 1)

- Method: automated smoke after build
- Result: **PASS** for `/companion/`, `/api/network`, `/api/status` (this session)
- Note: `peer-ready` may FAIL if a live browser already occupies mobile/desktop roles

## Pose axis unit tests

- Method: `npm run test:pose`
- Result: **PASS** (pure mapping; no device)

## Windows 6DoF plumbing

- Code present in Receiver (`SixDofTracker`)
- Hardware parallax / axes: **PASS** (user 2026-11-09; turns + walk after portrait map `(y,-x,z)` / quat `(qy,qx,-qz,qw)`)

## iOS ARKit (sideload path)

- Method: GitHub Actions unsigned IPA → Sideloadly → physical iPhone
- Workflow: `.github/workflows/ios-sideload.yml`
- CI build run `42623051575` (macos-latest): **PASS** (IPA artifact produced)
- Device install / ARKit on iPhone: **NOT TESTED** (kablo yok; TestFlight tercih)

## iOS TestFlight (signed)

- App: **Mervelere** (`com.mervelere.app`)
- Workflow: `.github/workflows/ios-testflight.yml`
- CI run `42630713672`: **PASS** (archive + IPA + ASC upload + artifact)
- TestFlight device install: **PASS** (user report 2026-11-09; Internal group + kadircandursun@icloud.com)
- Start AR / ARKit on device (build 1): **FAIL** — crash, no camera prompt; IPA missing `NSCameraUsageDescription`
- Build 2 upload: **FAIL** — CFBundleVersion stuck at 1
- Build 3 upload (run `42634991920`): **PASS** — camera plist + CFBundleVersion 3
- Start AR (build 3): **PASS** (user report 2026-11-09; camera prompt + session runs)
- ARKit device evidence (build 3): **PASS**
  - Face tracking: yes · World tracking: yes · Mode: **6DoF**
  - Status: Face + world enabled (6DoF candidate)
  - Pose `p=` changes with translation; `t` monotonically increases

## Native LAN WebRTC

- Implementation (build 4+): stasel WebRTC SPM + ARFrame video + `pose` on `sensors` DC
- CI upload build 4 (run `42637222861`): **PASS**
- Device LAN WebRTC (video + pose → Receiver): **PASS** (user 2026-11-09; 6DoF axes OK)

