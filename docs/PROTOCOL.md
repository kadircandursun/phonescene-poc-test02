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
- Windows maps portrait selfie local deltas `(y,-x,z)` and relative quat `(qy,qx,-qz,qw)` on top of room rest pose after recenter.

## Room background (V1 — 2D photo)

HTTP on same server (LAN):

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/room/background` | raw `image/*` bytes; header `X-Room-Name` |
| `GET` | `/api/room/background` | image bytes |
| `DELETE` | `/api/room/background` | clear |
| `GET` | `/api/room/status` | `{ hasBackground, name, updatedAt, bytes }` |

iOS: selected photo room → `AppModel.uploadRoomPhoto`.  
Receiver polls status and draws photo BG under person matte.

## Compatibility

Receiver accepts both `sensor` and `pose` without breaking TEST 02–04 Safari senders.
