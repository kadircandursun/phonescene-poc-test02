# PhoneScene — Ürün Vizyonu & Teknoloji Planı

**Tarih:** 12 Kasım 2026  
**Amaç:** Karmaşıklaşan matte/backend tartışmasını bırakıp ürünün asıl cümlesine dönmek; ekiple ortak plan.  
**Ton:** Önce doğru iskelet, sonra kalite.

---

## 1. Ürün tek cümlede

> Kullanıcı kendi mekânını kaydeder; başka bir yerdeyken kamerada **o mekândaymış gibi** görünür. Gerçek yerden kesilir, kayıtlı mekânın üzerine konur.

Üç iş — fazlası değil:

| # | İş | Kullanıcı dili |
| --- | --- | --- |
| 1 | Mekân kütüphanesi | “Odamın fotoğrafını / 360’ını saklarım” |
| 2 | Kişi kesimi | “Olduğum yerden beni ayırırsın” |
| 3 | Yerleştirme | “Arka plan benim odam; dönünce de düzgün dursun” |

**V1 karar (2026-11-12):** Full **3D mesh / RoomPlan şart değil**. Kullanıcı çok hareket etmeyecek; dönüşte kabul edilebilir görünüm yeterli.  
**Kalite (saç, sandalye)** → sonra.

---

## 2. Bugünkü PoC ile vizyonun çakışması

### Ne doğru kurulmuş? (koru)

| Parça | Durum | Vizyondaki rolü |
| --- | --- | --- |
| iPhone native (Mervelere) + ARKit 6DoF | Çalışıyor | Hareket kaynağı |
| LAN WebRTC video + pose | Çalışıyor | Canlı akış |
| Receiver’da kişi + 3D sahne composite | Çalışıyor (PoC) | “mekâna koyma” iskeleti |
| OBS / yayın çıkışı | Çalışıyor (PoC) | İlk tüketim yüzeyi (Zoom vb.) |

### Ne eksik / yanlış odak?

| Vizyon ihtiyacı | Bugün | Sorun |
| --- | --- | --- |
| Kullanıcı odası taraması + saklama | Yok | Sadece procedural `loft` / `studio` (Three.js kutuları) |
| Oda seçip yükleme | Sahte scene select | Kullanıcı içeriği yok |
| “Olduğu yerden kes” | RVM / MediaPipe / BGM denemeleri | Çok backend, az ürün; Vision cihaz build’inde değil |
| “Oradaymış gibi” | Pose → sanal kamera | Mekân fotogerçek / kullanıcı odası değil |
| Basitlik | 5+ matte yolu | Odak dağılmış |

**Teşhis:** PoC omurgası (telefon → PC → composite → OBS) vizyonun **%40’ı**. Eksik olan asıl ürün değeri **kullanıcı mekân kütüphanesi**. Matte’yi “çok iyi” yapmak için harcanan enerji, oda tarama / yükleme / yerleştirme iskeletinden önde koştu.

---

## 3. Zihinsel model (basit boru hattı)

```text
                    ┌─────────────────────────┐
                    │  MEKÂN KÜTÜPHANESİ      │
                    │  (bir kez tara / sakla) │
                    └───────────┬─────────────┘
                                │ seçili oda (USDZ / mesh)
                                ▼
[Şu anki gerçek dünya]          [Kayıtlı 3D mekân]
  ön kamera RGB          +      duvar / mobilya / ışık proxy
  ARKit pose             +      sanal kamera = telefon pose
  kişi soft-alpha   ──────────► composite = “orada gibi”
                                │
                                ▼
                         yayın / kayıt / önizleme
```

İki zaman dilimi:

1. **Authoring (seyrek):** odayı tara → kaydet → isteğe bağlı düzenle  
2. **Presence (sık):** başka mekânda aç → odayı seç → kes + yerleştir + hareket et

Bunları aynı sprint’te “perfect matte + gaussian + native shell + Maxine” ile karıştırmayın.

---

## 4. “Oradaymış gibi” ne demek? (seviyeler)

Ekip net kabul kriteri koymadan “iyi değil” tartışması bitmez. Önerilen seviye merdiveni:

| Seviye | Anlam | Yeterlilik |
| --- | --- | --- |
| **L0** | Procedural / hazır BG + kaba kesim | Bugünkü PoC’ye yakın |
| **L1** | Kullanıcı **oda fotoğrafı (veya 360)** + Vision kesim + üzerine composite | **İlk ürün demo** |
| **L2** | 360 yaw/pitch veya hafif parallax; framing rehberi | “Dönünce de tamam” |
| **L3** | Saç kenarı, sandalye yok, ışık uyumu | Yayın kalitesi |
| **L4** | İsteğe bağlı 3D RoomPlan / splat | Sadece ihtiyaç çıkarsa |

**Öneri:** Önümüzdeki iş paketi **L1 (2D mekân)**. RoomPlan kodu opsiyonel yan yol; primary değil.

---

## 5. Teknoloji seçimleri (ne kullanmalı?)

### 5.1 Mekân saklama (iş #1) — V1 = 2D

| Seçenek | Artı | Eksi | Tavsiye |
| --- | --- | --- | --- |
| **Oda fotoğrafı (JPEG/HEIC)** | Her cihazda var, photoreal, basit | Dönüşte parallax yok / az | **V1 primary** |
| **360° equirect foto** | Yaw/pitch ile “dönünce düzgün” | Çekim biraz zahmetli | **V1+ / L2** |
| RoomPlan USDZ | Gerçek 3D yapı | LiDAR, kutu görünüm, fazla karmaşık | Opsiyonel sonra |
| Gaussian splat | Max fotogerçek 3D | Aşırı ağır | Hayır (şimdi) |

**Karar:** V1 kütüphane = **foto (ve isteğe bağlı 360)**. 3D dönüşüm yok.

### 5.2 Kişi kesimi (iş #2)

| Seçenek | Tavsiye |
| --- | --- |
| **iOS Vision `VNGeneratePersonSegmentationRequest`** | **Tek primary.** Neural Engine, hareket OK, empty-bg yok |
| Windows RVM / MediaPipe / BGM | Sadece fallback veya lab; ürün hikâyesinin merkezinde olmasın |
| Green screen | Demo garantisi; ürün default değil |

**Karar önerisi:** Matte lab’ını dondur. Vision IPA’yı ship et. “Sandalye / fringe” L3 backlog.

Kodda zaten `PersonMatteEngine` + `personAlpha` track taslağı var — **cihaz build’i eksik**, yeni backend değil.

### 5.3 Yerleştirme + hareket (iş #3)

| Parça | Teknoloji | Not |
| --- | --- | --- |
| Pose | ARKit `frame.camera.transform` (mevcut) | Koru; face-anchor kullanma |
| Mekân render | **Three.js + USDZ/GLTF loader** (Windows Receiver) *veya* RealityKit (iPhone) | L1 için mevcut Three.js’e USDZ/GLB yüklemek en az churn |
| Composite | Soft alpha × person over room render | Mevcut compositor iskeleti |
| Sync | Pose DataChannel + video (mevcut) | Recenter = “odadaki başlangıç noktası” |
| Çıktı | OBS Window Capture → VC (PoC) | Ürün VC driver sonra |

**Ölçek / ayak:** L1’de kaba: kişi billboard veya sabit yükseklik düzlemi. L2’de: tahmini ayak yeri + oda zemin düzlemi (RoomPlan floor).

### 5.4 Nerede composite edilsin? (kritik sadeleştirme)

İki mimari — birini seçin, ikisini birden mükemmelleştirmeyin:

#### A) **PC composite** (bugünkü PoC’nin uzantısı) — L1 için önerilen

```text
iPhone: RGB + Vision alpha + pose
Windows: USDZ odayı yükle → render → kişi composite → OBS
```

- Artı: Ağır oda PC’de; Companion ile oda seçimi kolay; mevcut kod  
- Eksi: Alpha track / WebRTC bandwidth; tarayıcı limitleri

#### B) **iPhone’da full composite** — daha basit “ürün hissi”, daha büyük iOS işi

```text
iPhone: Vision matte + RealityKit oda + pose → tek composed video
Windows: sadece al / göster / OBS
```

- Artı: Windows’ta matte yok; tek video track; Neural Engine  
- Eksi: RoomPlan render + matte + encode telefonda; PC oda kütüphanesi UX ayrı düşünülmeli

**Öneri:** L1 = **A (PC composite)** çünkü zaten var. L2/L3’te B’yi değerlendir (özellikle mobil-first ürün olursa).

### 5.5 Bilinçli olarak şimdi yapmayın

- Yeni matte modeli denemeleri (MODNet / BGM / Maxine)  
- Android  
- Custom virtual cam driver  
- Gaussian splat realtime telepresence  
- Tam photoreal ışık simülasyonu  
- Hesap / store / multiplayer  

Bunlar vizyonu öldürmez ama **L1’i geciktirir**.

---

## 6. Önerilen faz planı

### Faz 0 — Vizyon kilidi ✅ (kullanıcı 2026-11-12)

- [x] 3 iş kabul  
- [x] L1 = **2D oda foto + kes + koy** (3D şart değil)  
- [x] Matte = Vision primary  
- [x] Az hareket; dönüşte düzgün yeter  

### Faz 1 — “Kes + koy” + foto mekân

1. Vision alpha IPA (TestFlight)  
2. iOS: oda **fotoğrafı çek / galeriden seç** → yerel kütüphane  
3. Seçili fotoğrafa PC’ye gönder (LAN upload)  
4. Receiver: Three.js zorunlu değil — **foto BG + kişi composite** (mevcut 3D oda opsiyonel/kapatılabilir)  
5. Dönüş: sabit BG OK; sonra hafif parallax veya 360  

### Faz 2 — Dönünce daha iyi (L2)

1. Opsiyonel 360 BG + yaw/pitch  
2. Framing rehberi  
3. RoomPlan yalnız “gelişmiş 3D” olarak, default değil

### Faz 3 — “Oradaymış gibi” L2

1. Zemin hizası / kişi ölçeği (boy tahmini veya kalibrasyon)  
2. RoomPlan duvarlarına göre kamera clamp (duvardan geçme)  
3. Kaba occlusion: oda depth vs kişi (opsiyonel)  
4. Basit ışık: oda hemispheric / window direction  
5. Framing rehberi: “üst gövde / sade arka plan” (ML’siz kazanım)

### Faz 4 — Kalite L3 (şimdi konuşulan fringe/sandalye burada)

1. Vision `.accurate` veya temporal refine  
2. Edge despill  
3. İsteğe bağlı Windows native shell (Electron) — tarayıcıyı çıkar  
4. Licensing check (modeller)

### Faz 5 — Photoreal mekân (opsiyonel v2)

- Splat / Polycam import / HDRI hybrid  
- Ayrı epic; L1–L3’ü bloklamaz

---

## 7. İş paketleri (ekip board’a yapıştır)

| ID | Paket | Owner ipucu | Çıktı |
| --- | --- | --- | --- |
| P1 | Vision IPA ship | iOS | TestFlight; alpha track canlı |
| P2 | Receiver phone-alpha only path | Windows | `phone:ready`; lab kapalı |
| P3 | RoomPlan capture + local library | iOS | USDZ listesi |
| P4 | USDZ→GLB + Three loader | Windows/Tooling | Kullanıcı odası sahnede |
| P5 | Oda transfer protokolü | Fullstack | LAN upload API |
| P6 | Spawn / scale / floor align | 3D | L2 presence |
| P7 | Matte polish | iOS/Win | L3 |

---

## 8. Riskler & dürüst limitler

| Risk | Etki | Mitigasyon |
| --- | --- | --- |
| RoomPlan “kutu oda” fotogerçek değil | “Orası gibi” beklentisi şişer | L1’de beklentiyi “3D plan + varlık” diye konumla; splat’i sonra sat |
| LiDAR’sız cihaz | Tarama yok | Şablon odalar + import |
| Vision IPA gecikmesi | Kesim kalitesi düşük kalır | RVM fallback; framing rehberi |
| USDZ Three.js uyumu | Oda yüklenemez | Erken GLB convert spike |
| Kullanıcı hareket + el oynaması | Composite bozulur | Recenter UX; selfie stick / sabit tutuş opsiyonel — empty-bg zorunlu değil |
| Over-engineering matte | Vizyon kayması | Bu doküman = öncelik kilidi |

---

## 9. Mevcut repoya map

| Vizyon parçası | Repo konumu | Durum |
| --- | --- | --- |
| Pose + WebRTC | `apps/ios/...`, `client/shared/webrtc.ts` | Var |
| Procedural oda | `client/desktop/scene/room.ts` | Var (geçici) |
| Composite | `client/desktop/scene/compositor.ts` | Var |
| Vision matte kod | `PersonMatteEngine.swift`, `phoneAlphaBackend.ts` | Kod var, cihaz build yok |
| RVM fallback | `apps/windows/matting-native/` | Var (L1’de sessiz yedek) |
| Foto oda kütüphanesi | `RoomLibraryStore` (photo primary) | **Kod hazır** · TestFlight ile cihazda |
| PC oda BG API | `/api/room/background` | **Hazır** |
| Receiver foto composite | `compositor` photo BG | **Hazır** |
| RoomPlan / USDZ | opsiyonel yan yol | Primary değil |
| BGM empty-bg | Kodda | Ürün dışı; lab |

---

## 10. Ekip toplantısı için gündem (30 dk)

1. Bu 3 iş doğru mu? (evet/hayır)  
2. L1 tanımı onay  
3. Composite A mı B mi?  
4. RoomPlan V1 kabul mü, yoksa photoreal şart mı? (şartsa timeline x3)  
5. Önümüzdeki 2 hafta: sadece **P1 + P2**, sonra **P3 spike**  
6. “Matte lab” dondurma kararı  

---

## 11. Tek paragraf özet

PhoneScene’in olması gereken şey karmaşık bir matte laboratuvarı değil; **kullanıcının tarayıp sakladığı 3D mekâna, bulunduğu yerden kesilerek eşzamanlı yerleştirilmesidir**. PoC omurgası (ARKit + WebRTC + composite + OBS) bunun taşıyıcısı. Sıradaki doğru sıra: Vision ile kesimi cihazda aç → RoomPlan ile oda kütüphanesi → USDZ’yi Receiver’da yükle → spawn/ölçek ile “orada gibi”yi güçlendir → ancak ondan sonra kenar/sandalye/photoreal. Gaussian splat ve çoklu Windows matte backend’leri L1’i geciktiren lüksler.

---

## Referanslar

- Apple RoomPlan: https://developer.apple.com/augmented-reality/roomplan/  
- Vision person matte: WWDC21 “Detect people, faces, and poses using Vision”  
- Mevcut durum: `docs/TEAM_BRIEFING_2026-11-11.md`  
- Matte araştırma (dar kapsam): `docs/PRODUCT_MATTING.md`  
- Kararlar: `docs/DECISIONS.md`  
