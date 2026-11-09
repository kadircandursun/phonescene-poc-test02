# PhoneScene PoC

Windows Companion + WebRTC Receiver + MediaPipe/Three.js composite + OBS Broadcast path.

## Quick start

```powershell
npm install
npm run companion   # build (if needed) + server + opens Companion & Receiver
# optional phone HTTPS:
npm run tunnel
```

| Surface | URL |
| --- | --- |
| Companion | http://127.0.0.1:8787/companion/ |
| Receiver | http://127.0.0.1:8787/desktop/ |
| Mobile (web) | https://\<tunnel\>/mobile/ |

## Docs

- `docs/PROJECT_STATUS.md` — live status / next action
- `docs/PROJECT_AUDIT.md`
- `docs/DECISIONS.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/TEST_REPORT.md`
- `docs/POC_EXIT_CRITERIA.md`

## Scope

PoC only. Android deferred. Tauri/iOS native builds blocked on this Windows host without Rust/Xcode.

## Smoke

```powershell
$env:PAIR_CODE='482915'
npm run smoke
```
