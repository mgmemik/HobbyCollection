# 🚀 TestFlight Publish Checklist

## ✅ Hazır Olanlar

- ✅ App Name: "See All" (güncellendi)
- ✅ Bundle Identifier: `com.gmemik.saveall`
- ✅ Version: 1.0.3
- ✅ Build Number: 2
- ✅ Logo/Icon: Mevcut (`assets/icon.png`)
- ✅ Splash Screen: Mevcut (`assets/splash-icon.png`)

## 📋 Senden Beklenenler

### 1. App Store Connect Hazırlığı

**App Store Connect'te app oluşturulmuş olmalı:**
- [ ] App Store Connect'e giriş yap: https://appstoreconnect.apple.com
- [ ] "My Apps" > "+" > "New App"
- [ ] App bilgileri:
  - **Name:** See All
  - **Primary Language:** Turkish (veya English)
  - **Bundle ID:** `com.gmemik.saveall` (önceden oluşturulmuş olmalı)
  - **SKU:** Herhangi bir benzersiz ID (örn: `see-all-ios`)

### 2. Apple Developer Hesabı

- [ ] Apple Developer Program üyeliği aktif olmalı ($99/yıl)
- [ ] Bundle ID (`com.gmemik.saveall`) Apple Developer Portal'da kayıtlı olmalı
- [ ] App Store Connect'te bu Bundle ID'ye sahip bir app oluşturulmuş olmalı

### 3. Build Yöntemi Seçimi

#### Seçenek A: EAS Build (Önerilen - Expo)

```bash
# EAS CLI kurulumu
npm install -g eas-cli

# EAS'a login
eas login

# EAS Build konfigürasyonu oluştur
eas build:configure

# iOS build al
eas build --platform ios --profile production
```

**Gereksinimler:**
- [ ] EAS hesabı (ücretsiz plan yeterli)
- [ ] Apple Developer hesabı bağlantısı
- [ ] EAS credentials otomatik yönetilir

#### Seçenek B: Xcode ile Manuel Build

```bash
# iOS klasörüne git
cd ios

# Pod install
pod install

# Xcode'da aç
open SaveAll.xcworkspace
```

**Gereksinimler:**
- [ ] Xcode kurulu (Mac gerekli)
- [ ] Apple Developer hesabı Xcode'a bağlı
- [ ] Provisioning Profile ve Certificate hazır
- [ ] Xcode'da "Product" > "Archive" ile build al

### 4. TestFlight'a Yükleme

**EAS Build kullanıyorsanız:**
```bash
# Build ve otomatik TestFlight'a yükleme
eas build --platform ios --profile production --auto-submit
```

**Xcode kullanıyorsanız:**
1. Xcode'da "Product" > "Archive"
2. Organizer penceresi açılır
3. "Distribute App" butonuna tıkla
4. "App Store Connect" seç
5. "Upload" seç
6. TestFlight'a otomatik yüklenir

### 5. TestFlight Ayarları

App Store Connect'te:
- [ ] TestFlight sekmesine git
- [ ] Build yüklendikten sonra (5-10 dakika sürebilir)
- [ ] Build'i seç ve "Submit for Review" yap (gerekirse)
- [ ] Test kullanıcıları ekle (Internal Testing veya External Testing)

## 🔧 Teknik Detaylar

### Version ve Build Number

- **Version (CFBundleShortVersionString):** 1.0.3
- **Build Number (CFBundleVersion):** 2
- Her yeni build için Build Number artırılmalı (örn: 3, 4, 5...)
- Version numarası sadece önemli güncellemelerde artırılır

### Bundle Identifier

- **Mevcut:** `com.gmemik.saveall`
- Bu ID Apple Developer Portal'da kayıtlı olmalı
- App Store Connect'te bu ID ile app oluşturulmuş olmalı

### App Name

- **Display Name:** "See All"
- **Bundle Name:** SaveAll (değiştirilemez, Xcode proje adı)

## ⚠️ Önemli Notlar

1. **İlk Build:** İlk kez TestFlight'a yüklerken Apple'ın incelemesi gerekebilir (1-2 gün sürebilir)
2. **Build Number:** Her build için mutlaka artırılmalı
3. **Version:** App Store'a yayınlarken version numarası artırılmalı
4. **Test Kullanıcıları:** TestFlight'ta test için kullanıcı eklemeniz gerekir

## 🚀 Hızlı Başlangıç (EAS Build)

```bash
# 1. EAS CLI kur
npm install -g eas-cli

# 2. Login
eas login

# 3. Build konfigürasyonu
eas build:configure

# 4. iOS build al ve TestFlight'a yükle
eas build --platform ios --profile production --auto-submit
```

## 📱 TestFlight Link'i

Build yüklendikten sonra:
- App Store Connect > TestFlight > App Information
- "Public Link" oluşturulabilir
- Test kullanıcıları bu link ile uygulamayı indirebilir

## 🐛 Sorun Giderme

### Build Hatası
- Bundle ID'nin Apple Developer Portal'da kayıtlı olduğundan emin ol
- Provisioning Profile'ın geçerli olduğundan emin ol
- Certificate'ın geçerli olduğundan emin ol

### TestFlight'a Yüklenemiyor
- App Store Connect'te app oluşturulmuş olmalı
- Bundle ID eşleşmeli
- Build number her seferinde artırılmalı

### Test Kullanıcıları Göremiyor
- TestFlight'ta "Internal Testing" veya "External Testing" grubu oluştur
- Kullanıcıları gruba ekle
- Build'i gruba atayın

