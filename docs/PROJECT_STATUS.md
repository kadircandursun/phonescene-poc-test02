# PROJECT_STATUS

**Updated:** 2026-11-12  
**Current phase:** L1 complete in code — **oda foto + kes + koy** (PC composite)  
**Vizyon:** [`PRODUCT_VISION_PLAN.md`](./PRODUCT_VISION_PLAN.md)

## Done (this pass)

- Server `POST/GET/DELETE /api/room/background` + `/api/room/status`
- Receiver: foto BG default (3D off), local upload, poll refresh, hafif parallax
- iOS: oda foto kütüphane + **Seçili odayı PC’ye gönder**
- Vision / RoomPlan kodu repoda (cihaz build ayrı)

## Needs device / TestFlight

- Build **5+** IPA (UI + foto oda + Vision + upload)
- LiDAR şart değil (foto yolu)

## Run (Windows)

```powershell
npm run app
# Receiver: http://127.0.0.1:8787/desktop/
# Oda:     POST /api/room/background  (image/* + X-Room-Name)
```
