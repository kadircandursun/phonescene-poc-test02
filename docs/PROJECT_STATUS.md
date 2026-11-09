# PROJECT_STATUS

**Updated:** 2026-11-09  
**Current phase:** TestFlight build **4** uploaded · native WebRTC LAN test · **Mervelere**

## Completed

- ARKit 6DoF device PASS (build 3)
- Native WebRTC (AR video + pose DC) CI PASS  
  https://github.com/kadircandursun/phonescene-poc-test02/actions/runs/42637222861

## In progress / blocked

- Device LAN WebRTC (video + pose → Companion) — **NOT TESTED**

## Next action (kullanıcı)

1. TestFlight → **1.0.2 (4)** güncelle  
2. PC aynı Wi‑Fi: `npm run companion` → Receiver → pair kodu kopyala  
3. iPhone: Companion’daki LAN IP + `8787` + kod → Start AR → **Connect PC**  
4. Receiver’da video + oda hareketi / poseHz bildir  

## User actions required

- Build 4 kur + LAN WebRTC sonucu
