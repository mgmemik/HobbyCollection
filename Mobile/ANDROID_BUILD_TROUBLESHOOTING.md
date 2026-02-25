# 🔧 Android Build Sorun Giderme Rehberi

## 📋 Build Loglarını Kontrol Etme

Build hatası aldığınızda, detaylı logları görmek için:

1. EAS Dashboard'a git: https://expo.dev/accounts/gmemik/projects/save-all/builds
2. Başarısız build'i seç
3. **"Run gradlew"** fazındaki logları kontrol et
4. Hata mesajını not al

## 🔍 Yaygın Sorunlar ve Çözümleri

### 1. Gradle Build Hatası

**Hata:** `Gradle build failed with unknown error`

**Olası Nedenler:**
- Gradle versiyonu uyumsuzluğu
- Android SDK versiyonu sorunları
- Dependency çakışmaları
- Memory yetersizliği

**Çözümler:**

#### A. Temiz Build Yapma

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Mobile

# Android klasörünü temizle (eğer varsa)
rm -rf android

# Node modules ve cache temizle
rm -rf node_modules
npm cache clean --force
npm install

# EAS build'i tekrar dene
eas build --platform android --profile production --clear-cache
```

#### B. Gradle Wrapper Versiyonunu Kontrol Etme

`android/gradle/wrapper/gradle-wrapper.properties` dosyasını kontrol edin:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.3-all.zip
```

Eğer versiyon çok eskiyse, Expo'nun önerdiği versiyonu kullanın.

#### C. Android SDK Versiyonunu Kontrol Etme

`android/build.gradle` dosyasında:

```gradle
ext {
    minSdkVersion = 23  // Android 6.0+
    compileSdkVersion = 34  // Android 14
    targetSdkVersion = 34
}
```

### 2. Dependency Çakışmaları

**Hata:** `Conflict with dependency` veya `Duplicate class`

**Çözüm:**

```bash
# package.json'daki dependency versiyonlarını kontrol et
# Özellikle React Native ve Expo versiyonları uyumlu olmalı

# Expo SDK 54 için:
# - React Native: 0.81.4 ✅
# - React: 19.1.0 ✅
```

### 3. Memory Hatası

**Hata:** `OutOfMemoryError` veya `GC overhead limit exceeded`

**Çözüm:**

`android/gradle.properties` dosyasına ekleyin:

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
```

### 4. Kotlin Versiyonu Sorunu

**Hata:** `Unsupported Kotlin version`

**Çözüm:**

`android/build.gradle` dosyasında Kotlin versiyonunu kontrol edin:

```gradle
buildscript {
    ext.kotlinVersion = '1.9.0'  // Expo SDK 54 için uyumlu versiyon
}
```

### 5. Keystore Sorunu

**Hata:** `Keystore file not found` veya signing hatası

**Çözüm:**

EAS otomatik keystore yönetir. Eğer sorun varsa:

```bash
# Credentials'ı kontrol et
eas credentials

# Keystore'u sıfırla (dikkatli olun!)
eas credentials --platform android
```

### 6. Android Manifest Sorunları

**Hata:** `Manifest merger failed`

**Çözüm:**

`app.json`'da Android permissions doğru tanımlanmış olmalı:

```json
{
  "android": {
    "permissions": [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO"
    ]
  }
}
```

## 🚀 Adım Adım Debug Süreci

### 1. Build Loglarını İncele

```bash
# Build ID'yi al
eas build:list

# Belirli bir build'in loglarını görüntüle
eas build:view [BUILD_ID]
```

### 2. Lokal Build Deneme (Opsiyonel)

Eğer EAS build sürekli başarısız oluyorsa, lokal build deneyebilirsiniz:

```bash
# Android klasörünü oluştur (eğer yoksa)
npx expo prebuild --platform android

# Lokal build (sadece test için)
cd android
./gradlew assembleRelease
```

**Not:** Lokal build production için önerilmez, sadece debug için kullanın.

### 3. Expo SDK Versiyonunu Kontrol Et

```bash
# Mevcut Expo versiyonunu kontrol et
npx expo --version

# Package.json'daki Expo versiyonunu kontrol et
cat package.json | grep expo
```

### 4. EAS Build Cache'i Temizle

```bash
# Cache'i temizle ve tekrar build al
eas build --platform android --profile production --clear-cache
```

## 📝 Build Loglarını Paylaşma

Sorun devam ederse, şu bilgileri paylaşın:

1. **Build Log Link:** EAS dashboard'dan build log linki
2. **Hata Mesajı:** "Run gradlew" fazındaki tam hata mesajı
3. **Package.json:** `package.json` içeriği
4. **App.json:** `app.json` içeriği
5. **EAS.json:** `eas.json` içeriği

## 🔄 Alternatif Çözümler

### Seçenek 1: Preview Build Deneme

Production build başarısız oluyorsa, önce preview build deneyin:

```bash
eas build --platform android --profile preview
```

Preview build daha az optimizasyon içerir ve bazen daha kolay başarılı olur.

### Seçenek 2: Development Build

Development build ile test edin:

```bash
eas build --platform android --profile development
```

### Seçenek 3: Expo Go Kullanma (Geçici)

Production build sorunları devam ederse, Expo Go ile test edebilirsiniz:

```bash
npx expo start
```

**Not:** Expo Go bazı native modülleri desteklemez, bu yüzden production build gerekli.

## ⚠️ Önemli Notlar

1. **İlk Build:** İlk Android build genellikle daha uzun sürer (10-20 dakika)
2. **Cache:** EAS build cache kullanır, bazen cache temizlemek sorunları çözer
3. **Versiyonlar:** Expo SDK, React Native ve React versiyonları uyumlu olmalı
4. **Memory:** EAS build sunucuları yeterli memory'ye sahip, lokal build'de memory sorunları olabilir

## 📚 Ek Kaynaklar

- [EAS Build Dokümantasyonu](https://docs.expo.dev/build/introduction/)
- [Android Build Sorunları](https://docs.expo.dev/build-reference/troubleshooting/)
- [Expo SDK 54 Release Notes](https://expo.dev/changelog/2024/01-15-sdk-54/)
- [React Native Android Setup](https://reactnative.dev/docs/environment-setup)

## 🆘 Hala Sorun mu Var?

1. EAS Build loglarını detaylı inceleyin
2. Expo Community Forum'da sorun: https://forums.expo.dev/
3. GitHub Issues: https://github.com/expo/expo/issues
4. EAS Support: https://expo.dev/support

