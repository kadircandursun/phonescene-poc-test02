# PhoneScene iOS (ARKit PoC)

Native SwiftUI + ARKit fizibilite uygulaması.

Windows’ta kaynak yazılır; **derleme GitHub Actions (ücretsiz macOS)** ile yapılır; **iPhone’a kurulum Sideloadly** ile yapılır.

## Ücretsiz test zinciri (Mac yok)

### 0) Gerekenler
- GitHub hesabı (repo **public** → Actions macOS dakikası bedava)
- iPhone (TrueDepth / Face ID cihazları face tracking için)
- Ücretsiz Apple ID
- Windows: [Sideloadly](https://sideloadly.io/) + Apple cihaz sürücüleri / iTunes veya Apple Devices
- USB kablo

### 1) Repoyu GitHub’a push et
Bu klasör henüz remote’suz olabilir. Örnek:

```powershell
gh repo create phonescene-poc --public --source=. --remote=origin --push
```

veya GitHub web’den repo açıp `git remote add origin ...` + `git push -u origin master`.

### 2) IPA derle
1. GitHub → **Actions** → **iOS Sideload IPA** → **Run workflow**
2. Bitince artifact: `PhoneSceneIOS-sideload` → `.ipa` indir

### 3) iPhone’a yükle (Sideloadly)
1. iPhone USB ile bağla, bilgisayarı güven
2. Sideloadly’yi aç → IPA sürükle
3. Apple ID gir (ücretsiz olur)
4. Start
5. iPhone: **Ayarlar → Genel → VPN ve Cihaz Yönetimi** → geliştiriciye **Güven**
6. PhoneScene’i aç → kamera izni ver → **Start AR**

### Sınırlar
- Ücretsiz Apple ID: uygulama ~**7 günde** düşer → Sideloadly ile yenile
- Aynı anda ~3 sideload app
- Bu build **WebRTC yok** — önce ARKit 6DoF/3DoF kanıtı
- Simülatör ARFaceTracking için yeterli değil; **gerçek cihaz** şart
- Sonuçları `docs/TEST_REPORT.md` içine PASS yazmadan önce sen doğrula

## Yerel Xcode (Mac olursa)
```bash
cd apps/ios
brew install xcodegen
xcodegen generate
open PhoneSceneIOS.xcodeproj
```

## Kaynaklar
- `PhoneSceneApp.swift` — giriş
- `ARSessionManager.swift` — `frame.camera.transform` (face anchor değil)
- `PoseWireEncoder.swift` / `SignalingClient.swift` — sonraki networking için hazır
- `project.yml` — XcodeGen
- `../../.github/workflows/ios-sideload.yml` — CI
