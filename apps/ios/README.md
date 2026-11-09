# PhoneScene iOS (ARKit PoC)

Native SwiftUI + ARKit. Windows’ta kaynak; derleme GitHub Actions.

## Kurulum yolları

| Yol | Kablo | Ücret | Doküman |
| --- | --- | --- | --- |
| **TestFlight** (önerilen — Developer’ın var) | Hayır | Apple Developer (zaten var) | [TESTFLIGHT.md](./TESTFLIGHT.md) |
| Sideloadly | İlk sefer evet | $0 | Aşağıda |

## TestFlight (kablosuz)

1. `TESTFLIGHT.md` adımları → secrets  
2. Actions → **iOS TestFlight**  
3. iPhone’da TestFlight’tan yükle  

## Sideloadly (yedek)

1. Actions → **iOS Sideload IPA** (veya `apps/ios/dist/*.ipa`)  
2. USB + Sideloadly + Apple ID  
3. Ayarlar → VPN ve Cihaz Yönetimi → Güven  

## LAN WebRTC (build 4+)

1. PC: `npm run companion` → Receiver açık, pair kodu görünür  
2. iPhone Mervelere: Windows LAN IP + port `8787` + kod  
3. **Start AR** → **Connect PC**  
4. Receiver’da video + `pose` / oda kamerası  

## Kaynaklar

- Bundle ID: `com.mervelere.app`
- `ARSessionManager.swift` — `frame.camera.transform` (face anchor değil)
- `WebRTCPeer.swift` — stasel WebRTC + `sensors` DataChannel
- `project.yml` — XcodeGen + SPM
- Workflows: `ios-testflight.yml`, `ios-sideload.yml`
