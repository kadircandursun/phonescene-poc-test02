# PROJECT_STATUS

**Updated:** 2026-11-09  
**Current phase:** TestFlight pipeline hazır · **kullanıcı: ASC + GitHub secrets**

## Completed

- TEST 01–04 web PoC + Companion
- Swift/ARKit + XcodeGen + sideload IPA CI PASS
- **iOS TestFlight workflow** + `apps/ios/TESTFLIGHT.md`
- Repo: https://github.com/kadircandursun/phonescene-poc-test02

## In progress / blocked

- App Store Connect app + Distribution cert/profile + API key secrets
- TestFlight device install — **NOT TESTED**
- Kablo yok → Sideload şimdilik pratik değil; TestFlight tercih

## Next action (kullanıcı)

1. `apps/ios/TESTFLIGHT.md` adımlarını uygula  
2. GitHub Secrets’ı doldur  
3. Actions → **iOS TestFlight** çalıştır  
4. TestFlight’tan iPhone’a kur → Start AR  

## User actions required

- Apple Developer portal: App ID `com.phonescene.poc`, Distribution .p12, App Store profile, ASC API key  
- Secrets’ı **chate yapıştırma** — sadece GitHub Secrets  
- Sonuçları bildir
