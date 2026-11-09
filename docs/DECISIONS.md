# DECISIONS

## 2026-11-09 — Keep web media pipeline; add Companion without rewrite

**Decision:** Do not rewrite TEST 01–04 WebRTC/MediaPipe/Three.js stack.  
**Why:** Working PoC; risk of regression.  
**Alt:** Full native Windows engine now — rejected for PoC scope.

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

## 2026-11-09 — ARKit→Three axis map `(x,y,-z)`

**Decision:** Map relative ARKit camera translation/rotation with Z flip into VirtualRoom.  
**Why:** Align phone forward motion with room look-into (-Z).  
**Note:** Final validation requires hardware; map may be tuned after Phase 5.
