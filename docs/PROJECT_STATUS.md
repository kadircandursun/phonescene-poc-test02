# PROJECT_STATUS

**Updated:** 2026-11-12  
**Current phase:** L1 shipped to TestFlight — **oda foto + kes + koy**  
**Vizyon:** [`PRODUCT_VISION_PLAN.md`](./PRODUCT_VISION_PLAN.md)

## Done (this pass)

- Server `POST/GET/DELETE /api/room/background` + `/api/room/status`
- Receiver: foto BG default (3D off), local upload, poll refresh, hafif parallax
- iOS: oda foto kütüphane + **Seçili odayı PC’ye gönder** + Vision soft-alpha
- RoomPlan **çıkarıldı** (V1 photo-only; archive NSCoding unblock)
- TestFlight build **6** (`1.0.3`): run `43237695715` — archive + ASC upload **PASS**

## Needs device (user)

- TestFlight’tan build 6 yükle
- E2E: oda foto → PC gönder → Receiver BG → AR cutout → OBS

## Run (Windows)

```powershell
npm run app
# Receiver: http://127.0.0.1:8787/desktop/
# Oda:     POST /api/room/background  (image/* + X-Room-Name)
```
