# PhoneScene PoC

iPhone (ARKit) → LAN WebRTC → Windows MODNet/ONNX matting → soft alpha → Three.js room → OBS Virtual Cam.

## Quick start

```powershell
npm install
npm run app         # RVM matting (DirectML/CPU) + server + Companion & Receiver
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

## iOS (Mac yok → Sideload)

```text
GitHub Actions (ücretsiz macOS) → IPA → Sideloadly → iPhone
```

Ayrıntı: `apps/ios/README.md` · workflow: `.github/workflows/ios-sideload.yml`

## Scope

PoC only. Android deferred. Tauri blocked without Rust. Native iOS compile via GitHub Actions + Sideloadly (not local Xcode).

## Smoke

```powershell
$env:PAIR_CODE='482915'
npm run smoke
```
