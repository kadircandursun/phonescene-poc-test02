# DEVELOPMENT_PLAN

> **Ürün yönü (2026-11-12):** Asıl hedef matte lab değil — kullanıcı odası tarama → kes → kayıtlı 3D mekâna eşzamanlı yerleştir.  
> Detaylı analiz & teknoloji: [`PRODUCT_VISION_PLAN.md`](./PRODUCT_VISION_PLAN.md)

## Aktif fazlar (vizyon L1)

| Faz | Hedef | Durum |
| --- | --- | --- |
| F1 | Vision alpha IPA + Receiver phone path | Kod hazır · cihaz build bekliyor |
| F2 | **2D oda foto** kütüphane + PC BG + composite | **Kod tamam** (TestFlight ile doğrula) |
| F3 | 360 / hafif parallax polish (L2) | Sonra |
| F4 | Matte polish (L3) | Bilinçli sonra |

## Eski PoC fazları (omurga — çoğunlukla ✅)

### PHASE 0 — Audit ✅
### PHASE 1 — Windows Companion ✅ (Tauri deferred)
### PHASE 2–4 — Native iOS + LAN WebRTC + 6DoF ✅ (cihazda doğrulandı)
### PHASE 5 — Composite + OBS ✅ (PoC kalite)
### PHASE 6 — Matte lab ⏸ dondur (Vision primary; RVM sessiz fallback)

## Bilinçli erteleme

- Android, RTX zorunluluğu, empty-bg BGM ürün default, Gaussian splat V1, custom VC driver
