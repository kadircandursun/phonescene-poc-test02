# PhoneScene PoC Media / Pose Protocol

Shared contract between Safari mobile, future native iOS, and Windows Receiver.

## Signaling (`ws://HOST:PORT/signal`)

1. Client connects WebSocket.
2. `{ "type":"join", "code":"######", "role":"mobile"|"desktop" }`
3. Server → `{ "type":"joined", ... }` then `{ "type":"peer-ready" }` when both roles present.
4. WebRTC SDP/ICE relayed as `{ type:"offer"|"answer"|"ice", ... }` (existing TEST 02 path).
5. `{ "type":"bye" }` ends role.

Pair code is required. Prefer LAN for native iOS; Cloudflare tunnel remains optional for Safari HTTPS only.

## DataChannel name

`sensors` (ordered). Carries JSON text frames.

## Payload: `sensor` (legacy 3DoF)

```json
{ "type":"sensor", "alpha":120.1, "beta":65.2, "gamma":-3.4, "t":1730000000000 }
```

Used by Safari DeviceOrientation. Receiver drives `OrientationTracker` only.

## Payload: `pose` (native 6DoF / 3DoF)

```json
{
  "type": "pose",
  "mode": "6dof",
  "t": 12345.6,
  "px": 0.01, "py": 0.02, "pz": -0.03,
  "qx": 0, "qy": 0, "qz": 0, "qw": 1,
  "trackingState": "normal",
  "fovY": 60
}
```

Rules:

- `mode:"6dof"` requires real camera translation from ARKit `frame.camera.transform` (not face anchor).
- `mode:"3dof"` may omit `px/py/pz`; rotation quaternion and/or euler fields.
- `t` is sender monotonic time in **milliseconds** (ARFrame.timestamp×1000). Do not assume PC wall clock equals phone wall clock.
- Windows maps ARKit → Three with position `(x,y,-z)` and quaternion `(x,y,-z,w)` relative to recenter baseline.

## Compatibility

Receiver accepts both `sensor` and `pose` without breaking TEST 02–04 Safari senders.
