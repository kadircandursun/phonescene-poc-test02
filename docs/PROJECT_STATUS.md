# PROJECT_STATUS

**Updated:** 2026-11-09  
**Current phase:** iOS sideload build path hazır · GitHub’a push + Sideloadly ile cihaz testi **kullanıcıda**

## Completed

- TEST 01–04 web PoC + Companion
- Swift/ARKit kaynak + XcodeGen `project.yml`
- GitHub Actions: `.github/workflows/ios-sideload.yml` (unsigned IPA)
- Sideload kurulum dokümanı: `apps/ios/README.md`
- Windows 6DoF plumbing + `pose` protokolü (donanımda henüz yok)

## In progress / blocked

- Repo GitHub remote’a push (Actions için şart)
- IPA artifact + Sideloadly ile gerçek iPhone — **NOT TESTED**
- Native WebRTC (Phase 3) — sonra

## Next action (kullanıcı)

1. Repoyu **public** GitHub’a push et  
2. Actions → **iOS Sideload IPA** çalıştır  
3. IPA’yı Sideloadly ile iPhone’a yükle  
4. Start AR → Face/World destek + poz satırını not et  

## User actions required

- GitHub push (veya `gh repo create ... --push`)
- Sideloadly + USB iPhone
- Sonuçları bildir (PASS iddiası yok; sen doğrula)
