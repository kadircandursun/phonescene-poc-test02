# PhoneScene → TestFlight (kablosuz kurulum)

Apple Developer hesabın var; Mac yok. Build GitHub Actions’ta, indirme TestFlight’tan.

Bundle ID: `com.mervelere.app`

## 1) Apple Developer / App Store Connect

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. **Identifiers → +** → App IDs → App  
   - Description: `Mervelere`  
   - Bundle ID: **Explicit** `com.mervelere.app`  
   - Capabilities: gerekirse boş bırak (Camera Info.plist’te)
3. **Certificates → +** → **Apple Distribution**  
   - CSR: Windows’ta OpenSSL ile veya başka Mac’ten; yoksa geçici cloud Mac / arkadaş Mac  
   - Sertifikayı indir → Keychain’den / oluşturduğun yerden **.p12** export et (şifre koy)
4. **Profiles → +** → **App Store Connect**  
   - App ID: `com.mervelere.app`  
   - Distribution cert seç → indir `.mobileprovision`
5. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps → +**  
   - Bundle ID: `com.mervelere.app`  
   - Name: PhoneScene PoC  
   - Skips / metadata: Internal Testing için minimum yeterli
6. **Users and Access → Integrations → App Store Connect API** → **Generate API Key**  
   - Access: **Admin** veya **App Manager**  
   - `.p8` bir kez indirilir — sakla  
   - Not et: **Key ID**, **Issuer ID**

> CSR/.p12 adımı Windows’ta en zor kısım. Sertifika zaten varsa sadece `.p12` + profile yeter.

## 2) Windows’ta base64

PowerShell (dosya yollarını kendine göre değiştir):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\dist.p12")) | Set-Clipboard
# → BUILD_CERTIFICATE_BASE64

[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\PhoneScene.mobileprovision")) | Set-Clipboard
# → BUILD_PROVISION_PROFILE_BASE64
```

`.p8` içeriğini olduğu gibi kopyala (-----BEGIN PRIVATE KEY----- …).

## 3) GitHub Secrets

Repo: https://github.com/kadircandursun/phonescene-poc-test02  
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Değer |
| --- | --- |
| `APPLE_TEAM_ID` | 10 karakter Team ID |
| `BUILD_CERTIFICATE_BASE64` | p12 base64 |
| `P12_PASSWORD` | p12 şifresi |
| `BUILD_PROVISION_PROFILE_BASE64` | mobileprovision base64 |
| `APPLE_API_KEY_ID` | API Key ID |
| `APPLE_API_ISSUER_ID` | Issuer ID |
| `APPLE_API_KEY_P8` | .p8 dosya metni |
| `PROVISIONING_PROFILE_NAME` | (opsiyonel) portaldeki profile adı |

**Chat’e / commit’e secret yapıştırma.**

## 4) Çalıştır

1. Actions → **iOS TestFlight** → **Run workflow**  
2. Yeşil olunca App Store Connect → TestFlight → build gelsin (işleme 5–30 dk)  
3. Internal Testing grubuna kendini ekle  
4. iPhone’da **TestFlight** uygulaması → PhoneScene → **Install** (kablosuz)

## 5) Sonra

- ARKit: Start AR → Face/World + poz satırını not et  
- Sonuç `docs/TEST_REPORT.md` için sen doğrula  

Sideload yolu hâlâ duruyor; TestFlight kalıcı test için daha iyi.
