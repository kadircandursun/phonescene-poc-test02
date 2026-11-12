# Product-grade person cutout (research)

**Goal:** Broadcast-credible person in 3D room on **every Windows PC** (no RTX requirement).

## Verdict

PoC Receiver matting (MediaPipe / browser MODNet / WS-RVM hybrids) **cannot** reach product quality. Stop patching it for “çok iyi”.

## What products actually do

| Layer | Zoom / Meet / Teams pattern |
| --- | --- |
| Where | **Local client**, same process as capture/composite |
| Model | Proprietary or MediaPipe/RVM-class CNN, often with **temporal** state |
| Resolution | Infer on scaled frame; refine / blend at full res |
| Output | Soft mask → GPU composite → encoder |
| Optional HQ | **Background matting**: capture empty scene once, then strand-level matte |

## Recommended PhoneScene product stack

```text
[iPhone]
  RGB (+ optional Vision person alpha)
       │ WebRTC
       ▼
[Windows native app]          ← not browser tab as matte host
  1. Optional: capture empty bg (user steps out 1s)
  2. Background Matting network (primary)  OR  Vision alpha if present
  3. Fallback: RVM (no bg ref) — accept chair risk / guide user framing
  4. Edge refine (guided filter / small refine net)
  5. Three.js / native composite
  6. Virtual camera
EP: DirectML → CPU (all PCs). Maxine optional.
```

## Path ranking

| # | Approach | Quality | “Every PC” | Notes |
|---|---|---|---|---|
| 1 | **BGMv2-style + empty bg shot** | Highest open realtime | Yes (DML/CPU) | Best match to “çok iyi” without green screen |
| 2 | **iOS Vision matte on phone** | High person-only | Yes (PC only composites) | Chair less; needs alpha channel / second track |
| 3 | Chroma / plain wall | Broadcast | Yes | Ops constraint, not ML |
| 4 | RVM alone full-res native | Good hair, chair risk | Yes | Framing guide: distance from furniture |
| — | Browser / WS 256px mash | Fail | — | Abandoned for product |

## Licensing note

Confirm commercial license before shipping weights (RVM/MODNet/BGM variants differ). Prefer Apache/MIT exports or licensed packs for store builds.

## Implemented

1. **Decision:** no empty-bg plate (user moves)  
2. iOS: `PersonMatteEngine` + WebRTC `personAlpha` track (needs Mac/Xcode rebuild)  
3. Windows: RVM service + Receiver prefers phone alpha when present; else RVM∩MediaPipe gate  
4. BGM empty-bg kept in code but **not** product default  

## Still open

1. Ship TestFlight / device build with Vision alpha  
2. Wrap as **native app shell** (Electron/WebView2)  
3. Edge refine / temporal consistency polish
