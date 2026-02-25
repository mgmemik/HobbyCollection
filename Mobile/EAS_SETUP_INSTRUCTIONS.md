# 🚀 EAS Build Setup - Manuel Adımlar

EAS projesi oluşturmak için interaktif komutlar gerekiyor. Şu adımları takip et:

## 1. EAS Projesi Oluştur

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Mobile
eas init
```

**Sorular:**
- "Would you like to automatically create an EAS project for @gmemik/save-all?" → **Y** (Yes)
- Account seçimi → **gmemik** seç

Bu komut `app.json` dosyasına `expo.extra.eas.projectId` ekleyecek.

## 2. Build'i Başlat

```bash
eas build --platform ios --profile production
```

**Sorular:**
- Apple Developer hesabı bağlantısı → EAS otomatik yönetir
- Bundle ID: `com.gmemik.saveall` (app.json'da zaten var)
- Provisioning Profile → EAS otomatik oluşturur

## 3. TestFlight'a Otomatik Yükleme (Opsiyonel)

```bash
eas build --platform ios --profile production --auto-submit
```

Bu komut build'i tamamladıktan sonra otomatik olarak TestFlight'a yükler.

## Alternatif: Xcode ile Manuel Build

EAS kullanmak istemiyorsan:

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Mobile/ios
pod install
open SaveAll.xcworkspace
```

Xcode'da:
1. Product > Archive
2. Distribute App > App Store Connect > Upload

## ⚠️ Önemli Notlar

- **Build Number:** Her build için otomatik artırılacak (`autoIncrement: true`)
- **Version:** 1.0.3 (app.json'da)
- **App Name:** "See All" (güncellendi)
- **Bundle ID:** com.gmemik.saveall

## 🔍 Kontrol Listesi

- [x] App name "See All" olarak güncellendi
- [x] Version 1.0.3 senkronize edildi
- [x] Build number 2 olarak ayarlandı
- [x] eas.json oluşturuldu
- [ ] EAS projesi oluşturuldu (`eas init`)
- [ ] Build başlatıldı
- [ ] TestFlight'a yüklendi

