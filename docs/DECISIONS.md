# DECISIONS

## 2026-11-09 — Keep web media pipeline; add Companion without rewrite

**Decision:** Do not rewrite TEST 01–04 WebRTC/MediaPipe/Three.js stack.  
**Why:** Working PoC; risk of regression.  
**Alt:** Full native Windows engine now — rejected for PoC scope.

## 2026-11-09 — Windows Matting Engine (MODNet/ONNX; RTX hook)

**Decision:** Architecture keeps a Windows **matting** stage. **PoC runtime default = MediaPipe** after browser MODNet produced ghost mattes + lag.  
**Why:** Visibility for ongoing native phone tests.

## 2026-11-10 — Universal native matting (no RTX lock-in)

**Decision (interim engine):** Native RVM + DirectML→CPU scaffolding exists; **not** the product cutout path by itself.

## 2026-11-10 — Product-grade cutout (research lock)

**Decision:** Do **not** chase “çok iyi” by patching browser MediaPipe / WASM MODNet / downscaled WS-RVM hybrids. Those are PoC demos only.  
**Product cutout = one of these (priority order):**

1. **Background Matting (BGMv2-style)** on Windows native app: one empty-background reference frame + realtime alpha (CVPR’21 Lin et al.; Zoom-plugin proven). Best open quality without RTX lock-in; works Intel/AMD/NVIDIA via DirectML/CPU.  
2. **iPhone Vision person segmentation** (`VNGeneratePersonSegmentationRequest`, balanced/accurate) → send soft alpha with video. Neural Engine; person-only (chair less often); Windows only composites.  
3. **Optional chroma / plain backdrop** for broadcast-tier PoC filming.  
4. NVIDIA Maxine = optional accelerator only, never required.

**Why current looks bad:** RVM alone treats chair as subject; browser/WS downscale + double-model mash destroys opacity/edges. Zoom/Meet product stacks run **local native** pipeline: capture → (optional bg ref) → matting → GPU composite → encode — not a tab + localhost frame shuttle.  
**Not chosen:** More feather/threshold hacks on the PoC Receiver.

## 2026-11-10 — Ship BGMv2 as PoC primary matte

**Decision (superseded same day):** BGM empty-bg briefly wired; **rejected for PhoneScene** because user/phone move — plate alignment breaks.

## 2026-11-10 — No empty-bg dependency (moving capture)

**Decision:** Cutout must work while the user moves. **Primary = iPhone Vision person segmentation** (`VNGeneratePersonSegmentationRequest`) → second WebRTC video track. **Windows fallback = RVM + MediaPipe person gate** (no plate). BGM empty-bg is fixed-camera only, not product default.  
**Why:** Handheld ARKit + walking user invalidates empty-room reference.

## 2026-11-12 — Product = room library + cut + place (not matte lab)

**Decision:** Core product is (1) user-scanned rooms stored in-app, (2) person cut from current place, (3) live placement into saved room with synced motion. Target demo level **L1** (RoomPlan USDZ + Vision + existing PC composite). Freeze multi-backend matte experiments; photoreal Gaussian splat is v2.  
**Why:** Team focus drifted into cutout polish before the actual value loop (own room → appear there) existed. Procedural loft/studio is a placeholder, not the product.  
**Doc:** `docs/PRODUCT_VISION_PLAN.md`

## 2026-11-12 — No full 3D room required (V1)

**Decision (supersedes RoomPlan-as-primary):** V1 mekân = **2D oda fotoğrafı** (opsiyonel 360). Kişi Vision ile kesilir, fotoğrafın üzerine konur. Kullanıcı az hareket eder; dönüşte düzgün dursun yeter (sabit BG veya hafif parallax / 360 yaw-pitch). **RoomPlan / mesh 3D zorunlu değil** — gelişmiş / sonra.  
**Why:** “Oradaymış gibi” görüntülü konuşma için Zoom-tarzı virtual background yeterli; full 3D parallax ürünü şişiriyor.  
**Doc:** `docs/PRODUCT_VISION_PLAN.md`

## 2026-11-09 — Windows Companion = web panel + Node launcher (Tauri deferred)

**Decision:** Ship `/companion/` + `npm run companion` first.  
**Why:** No Rust/cargo on host; Tauri blocked.  
**Alt:** Install Rust immediately — optional later, non-blocking.  
**Result:** Same server process manages signaling + receiver + companion UI.

## 2026-11-09 — Dynamic NIC selection

**Decision:** `/api/network` scores adapters; prefer private Wi‑Fi/Ethernet over Hyper‑V/WSL/ZeroTier.  
**Why:** Hardcoded `192.168.1.103` is invalid across networks.  

## 2026-11-09 — iOS scaffold without claiming PASS

**Decision:** Commit Swift/ARKit source; mark build BLOCKED without Xcode.  
**Why:** Windows host cannot compile iOS.  
**Rule:** Never mark ARKit/device tests PASS without hardware evidence.

## 2026-11-09 — Android deferred

**Decision:** No Android app work in current PoC.  
**Why:** Master prompt: Android last; after iOS+Windows proven.

## 2026-11-09 — Extend DataChannel with `pose` without breaking `sensor`

**Decision:** Add optional `type:"pose"` JSON; keep Safari `sensor` path unchanged.  
**Why:** Native 6DoF needs position + quat; TEST 02–04 must not regress.  
**Result:** Receiver branches on payload type; 3DoF OrientationTracker remains default.

## 2026-11-09 — Selfie 6DoF axis contract

**Decision:** Portrait face-tracking: quat `(qy, qx, −qz, qw)`; position `(y, −x, z)`. Rest camera looks into room with window behind.  
**Why:** ARKit portrait axes rolled ~90° vs phone body. Rotation and translation signs tuned separately from device (turns OK first; walk X/Z then flipped).  
**Also fixed:** Absolute 180° yaw left-multiply on relative quat (identity→(0,1,0,0)).  
**Start pose:** upright selfie, back to window, then Recenter after tracking normal.

## 2026-11-09 — No local Mac: native iOS via rented Cloud Mac (not Expo-only)

**Decision:** Keep Swift/ARKit as the real native path. Without buying a Mac, use short-term **Cloud Mac + Xcode** (or CI for compile-only).  
**Why:** True front-camera 6DoF needs ARKit; Expo-alone cannot.  
**Workflow:** Windows/Cursor edits Swift → git push → Cloud Mac Xcode build → install on physical iPhone.  
**Not chosen now:** Hackintosh / macOS-on-PC VM (Apple license + fragile).  
**Cost ballpark (2026 research):** ~$10–15/day or ~$80–160/month cloud Mac; Apple Developer ~$99/year still required for device install.  
**Until rental:** Safari web sender remains the working PoC path.

## 2026-11-09 — Free device install path: Actions IPA + Sideloadly

**Decision:** First native binary via GitHub Actions unsigned IPA + Sideloadly + free Apple ID.  
**Why:** User has iPhone, no Mac; initial path without paid portal setup.  
**Limits:** ~7-day cert; USB usually required first time.  

## 2026-11-09 — Prefer TestFlight (user has Apple Developer)

**Decision:** Primary wireless install path = signed CI build → TestFlight.  
**Why:** User already has Apple Developer; no cable; better for ARKit device testing.  
**Keep:** Sideload workflow as fallback.  
**Secrets:** Distribution p12 + App Store profile + ASC API key in GitHub Actions only.

## 2026-11-09 — Native iOS WebRTC via stasel binary SPM

**Decision:** Link `stasel/WebRTC` XCFramework; feed `ARFrame.capturedImage` into `RTCVideoSource`; pose on `sensors` DataChannel.  
**Why:** Same `/signal` + offer/answer/ICE + `pose` contract as web; no Safari HTTPS tunnel for LAN.  
**Not chosen:** WKWebView wrapper of mobile web client (would bypass ARKit camera.transform path).
