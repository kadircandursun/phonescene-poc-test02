# ARCHITECTURE (PoC)

```text
[iPhone Safari web] --HTTPS tunnel--> cloudflared --HTTP--> Node server
[Future iOS native] --LAN WebRTC----> Node server / Companion
                                              |
                              +---------------+---------------+
                              |                               |
                         /signal (ws)                   static dist/
                              |                         companion/
                         WebRTC P2P                     desktop/ (receiver)
                         video+pose                     mobile/
                              |
                         MediaPipe + Three.js composite
                              |
                         Broadcast Mode canvas
                              |
                         OBS Window Capture → Virtual Camera
```

Windows Companion (Phase 1) is a control surface on the same Node process — not a second media pipeline.
