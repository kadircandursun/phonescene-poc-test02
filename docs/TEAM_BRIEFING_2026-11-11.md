# PhoneScene — Ekip Brifingi

**Tarih:** 11 Kasım 2026  
**Amaç:** Proje + son durum özeti; kalitenin neden hedefte olmadığına dair ortak analiz; karar seçenekleri.  
**Kapsam:** PoC (ürünleştirme kapısı henüz açık değil).  
**Güncelleme (12 Kasım):** Ürün cümlesi sadeleştirildi — oda tarama + kes + yerleştir. Bakınız [`PRODUCT_VISION_PLAN.md`](./PRODUCT_VISION_PLAN.md).

---

## 1. Ürün ne?

Telefon kamerası + ARKit pose ile kişiyi Windows’ta sanal 3D odaya yerleştirip OBS üzerinden yayına vermek.

```text
iPhone (Mervelere)
  ön kamera + 6DoF pose (+ hedeflenen: Vision person alpha)
        │  LAN WebRTC
        ▼
Windows Receiver / Companion
  matting → soft alpha → Three.js oda → OBS Virtual Cam
```

**Kısıtlar (bilinçli):** Android yok · RTX zorunlu değil · her Windows PC · kullanıcı hareket edecek (boş arka plan plakası ürün UX’i değil).

---

## 2. Ne çalışıyor? (PoC omurgası)

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Native iOS (Mervelere) TestFlight | Çalışıyor | Build 4+; kamera + ARKit 6DoF |
| LAN WebRTC video + pose | **PASS** | Kullanıcı doğruladı |
| 6DoF eksen map (selfie) | **PASS** | Dönüş + yürüyüş OK |
| Three.js oda composite | **PASS (PoC)** | Görsel var; kalite ayrı konu |
| OBS / yayın yolu | **PASS (PoC)** | 9:16 720×1280 |
| Windows Companion + signaling | **PASS** | `npm run app` |
| TEST 01–04 web stack | Korunuyor | Bilinçli rewrite yok |

**Özet:** “Telefon → PC → 3D oda → yayın” boru hattı ayakta. Eksik olan kısım **broadcast kalitesinde kişi kesimi (matte)**.

---

## 3. Son durum (matte) — dürüst tablo

| Denenen yol | Sonuç | Neden |
| --- | --- | --- |
| Browser MediaPipe | PoC görünür, kenar zayıf | Makas / beyaz fringe |
| Browser WASM MODNet | **FAIL** | Hayalet matte + lag |
| Native RVM (DirectML) | Ara kalite | Saç daha iyi; **sandalye subject** kalabiliyor |
| RVM ∩ MediaPipe person gate | Ara | Sandalyeyi azaltır; soft/halo kalır |
| BGMv2 + boş arka plan yakala | **Reddedildi** | En iyi açık kalite ama **sabit kamera** ister; kullanıcı hareket edince plaka bozulur |
| iOS Vision person alpha | **Kod yazıldı, cihazda yok** | Primary ürün yolu; Mac/Xcode veya yeni TestFlight build şart |

**Kullanıcı değerlendirmesi:** “Hâlâ istediğim düzeyde değil.”  
Bu, PoC exit kriterleriyle çelişmiyor: exit’te **photoreal matting zorunlu değil**. Ama **ürün hedefi** (“çok iyi / yayın kalitesi”) şu anki runtime ile karşılanmıyor.

---

## 4. Genel analiz — neden hedefte değiliz?

### 4.1 Mimari gerilim

PhoneScene’in kamera kaynağı **elden tutulan, hareket eden iPhone**.  
Zoom/Meet tarzı “çok iyi” cutout’ların çoğu ya:

- sabit / yarı-sabit webcam + isteğe bağlı empty-bg, ya da  
- cihazda native, aynı process içinde yüksek kaliteli person matte  

üzerine kurulu.

Bizde şu an pratikte:

```text
[hareketli telefon RGB]
    → WebRTC (sıkıştırma)
    → tarayıcı Receiver
    → localhost WS ile RVM (düşük çözünürlük)
    → MediaPipe gate
    → canvas composite
```

Bu zincir **PoC demosu** için uygun; **ürün matte** için değil. Her hop kenar, gecikme ve tutarsızlık ekliyor.

### 4.2 Empty-bg BGM neden rafa kalktı?

BGMv2 (src + boş oda referansı) açık kaynakta en güçlü realtime adaylardan biri.  
Ama PhoneScene’de kullanıcı **hareket edecek** → referans plaka ile canlı kare hizasız → ghost / sandalye / halo.  
Karar: **ürün UX’i empty-bg’ye bağlanamaz.**

### 4.3 Neden hâlâ RVM/MediaPipe görünüyor?

iOS tarafında Vision soft-alpha (`PersonMatteEngine` + `personAlpha` track) **repoda var**, fakat:

- Bu Windows geliştirme host’unda **Xcode yok**
- Cihazdaki TestFlight IPA **henüz bu Vision kodunu içermiyor** (rebuild / yeni upload şart)

Dolayısıyla Receiver bugün **fallback**: RVM + person gate → kalite tavanı düşük.

### 4.4 Kalite boşluğunun kök nedenleri (öncelik sırası)

1. **Person matte doğru yerde değil** — Neural Engine’de Vision alpha henüz canlı değil  
2. **Windows matte tarayıcı + WS üzerinden** — native app / aynı process değil  
3. **RVM mobilyayı subject sayabiliyor** — empty-bg yokken yapısal risk  
4. **Kenar / temporal / lighting match** — henüz ürün pipeline’ında yok  
5. **Beklenti kayması** — PoC exit ≠ yayın kalitesi cutout

---

## 5. Karar özeti (kilit)

| Konu | Karar |
| --- | --- |
| TEST 01–04 rewrite | Hayır (PoC riski) |
| RTX / Maxine zorunlu | Hayır (opsiyonel) |
| Empty-bg BGM ürün default | **Hayır** (hareket) |
| Primary cutout | **iPhone Vision person alpha** |
| Windows fallback | RVM + MediaPipe gate (DirectML→CPU) |
| Android | Onay gelene kadar yok |
| Tauri native shell | Rust yok → Companion web + Node launcher |

Detay: `docs/DECISIONS.md`, `docs/PRODUCT_MATTING.md`

---

## 6. Hedef mimari (ürün)

```text
[iPhone]
  RGB + Vision soft-alpha (Neural Engine)
       │ WebRTC: arCam + personAlpha (+ pose DC)
       ▼
[Windows native app — henüz PoC’ta browser]
  alpha varsa → doğrudan composite
  yoksa → RVM∩gate fallback
  edge refine → 3D oda → virtual cam
```

**PoC bugün:** sağ kolon (RVM fallback) canlı.  
**Ürün “çok iyi”:** sol kolon (Vision) + native Windows host.

---

## 7. Ekibe sorulacak kararlar

1. **Vision IPA’yı ne zaman ship ederiz?** (TestFlight CI / Mac) — kalite sıçramasının #1 kapısı  
2. **“Yeterli kalite” tanımı nedir?** (PoC exit mi, yayın/demo mı, store mı?)  
3. **Kısa vadede framing kuralı kabul mü?** (sandalyeden uzak / sade fon) — ML’siz garanti  
4. **Windows native shell** (Electron/WebView2) ne zaman? — matte’i tarayıcıdan çıkarma  
5. **Lisans:** RVM / BGM ağırlıkları ticari kullanım öncesi netleştirilsin  

---

## 8. Önerilen yol haritası (öncelik)

| Öncelik | İş | Etki | Bağımlılık |
| --- | --- | --- | --- |
| P0 | Mervelere’yi Vision alpha ile yeniden build + TestFlight | Cutout kalitesinde asıl sıçrama | Mac / GHA secrets |
| P0 | Receiver’da `phone:ready` doğrula (2. video track) | Kod hazır; cihaz build şart | P0 IPA |
| P1 | Edge refine + temporal smooth (Vision alpha üzerinde) | Saç / titreşim | P0 |
| P1 | Kalite kabul kriteri yaz (ekran görüntüsü checklist) | “oldu/olmadı” netliği | Ürün |
| P2 | Windows native shell | Latency + pipeline bütünlüğü | Ürün kararı |
| P2 | OBS / VC ürün yolu | Yayın operasyonu | PoC sonrası |
| — | Empty-bg BGM | Sadece sabit kamera senaryosu | Ürün tercihi |

---

## 9. Bilinen limitler (paylaşılabilir)

- Empty-bg BGM = sabit kamera; PhoneScene default değil  
- Vision alpha = kod var, **cihaz build yok** → şu an RVM görünür  
- RVM + sandalye riski devam edebilir  
- Tarayıcı Receiver = ürün matte host’u değil  
- Bu host’ta local Xcode yok; iOS derleme CI / Mac  

---

## 10. Tek cümlelik durum

**Omurga (pose + video + 3D + OBS) PoC olarak ayakta; yayın kalitesinde kişi kesimi henüz yok — çünkü hareket eden telefonda empty-bg BGM elendi ve asıl çözüm olan iOS Vision alpha henüz cihaz build’ine binmedi; bugünkü RVM/MediaPipe tavanı bilerek “yeterli değil”.**

---

## Referanslar

- `docs/PROJECT_STATUS.md`  
- `docs/PRODUCT_MATTING.md`  
- `docs/DECISIONS.md`  
- `docs/TEST_REPORT.md`  
- `docs/POC_EXIT_CRITERIA.md`  
- `docs/ARCHITECTURE.md`  
- `apps/ios/README.md`  
