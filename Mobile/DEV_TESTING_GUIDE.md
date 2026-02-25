# 🧪 Android Development Testing Rehberi

## ⚠️ Önemli: Android Emülatör Kurulumu

Android emülatörde backend'e bağlanabilmek için **ADB reverse** gereklidir.

### 1. Her Emülatör Başlatıldığında Çalıştırın

```bash
# Terminal'de çalıştırın (Backend başlatmadan önce)
adb reverse tcp:5015 tcp:5015
```

Bu komut Android emülatörün `localhost:5015` üzerinden Mac'inizdeki backend'e erişmesini sağlar.

### 2. Backend'i Başlatın

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend/HobbyCollection.Api
dotnet run
```

Backend `http://localhost:5015` adresinde çalışacak.

### 3. Mobile Uygulamayı Başlatın

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Mobile
npx expo --clear
```

## 📊 Log Kontrolü

Uygulama başladığında şu logları görmelisiniz:

```
=== API CONFIGURATION ===
API_BASE_URL: http://localhost:5015
Platform: android
__DEV__: true
Selected URL Type: LOCALHOST (adb reverse for Android)
```

## ✅ Test Checklist

### 1. Backend Kontrolü
```bash
# Backend çalışıyor mu?
curl http://localhost:5015/api/photoanalysis/health

# Beklenen:
{"status":"healthy","service":"EnhancedPhotoAnalysisService",...}
```

### 2. ADB Reverse Kontrolü
```bash
# Emülatör bağlı mı?
adb devices

# Beklenen:
emulator-5554	device

# Port forward kontrolü
adb reverse --list

# Beklenen:
tcp:5015 tcp:5015
```

### 3. AI Analiz Testi
1. Uygulamayı başlatın
2. Login olun
3. Add ekranına gidin
4. Fotoğraf seçin
5. AI Check butonuna basın
6. Logları kontrol edin:
   ```
   === FETCH İSTEĞİ GÖNDERİLİYOR ===
   URL: http://localhost:5015/api/photoanalysis/enhanced
   === FETCH BAŞARILI ===
   Status: 200
   ```

## 🐛 Sorun Giderme

### Sorun: "Network request failed" 21ms'de
**Neden:** ADB reverse yapılmamış veya backend çalışmıyor

**Çözüm:**
```bash
# 1. ADB reverse yap
adb reverse tcp:5015 tcp:5015

# 2. Backend'i yeniden başlat
cd Backend/HobbyCollection.Api
dotnet run

# 3. Uygulamayı yeniden başlat (Expo'da R tuşu)
```

### Sorun: "404 Not Found"
**Neden:** Backend endpoint'i yanlış veya backend çalışmıyor

**Çözüm:**
```bash
# Backend'in çalıştığını doğrula
curl http://localhost:5015/api/photoanalysis/health

# Endpoint'i test et
curl -X POST http://localhost:5015/api/photoanalysis/enhanced \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "language=en" \
  -F "photos=@test-images/test-coin.jpg"
```

### Sorun: "401 Unauthorized"
**Neden:** Token geçersiz veya süresi dolmuş

**Çözüm:**
1. Uygulamadan logout yapın
2. Yeniden login olun
3. Fresh token ile test edin

## 🚀 Production Build İçin

Production build'de API URL otomatik olarak production'a (`https://api.save-all.com`) değişir:

```
=== API CONFIGURATION ===
API_BASE_URL: https://api.save-all.com
__DEV__: false
Selected URL Type: PRODUCTION
```

**NOT:** Production build'i test etmeden önce mutlaka development'ta test edin!

## 📝 Her Test Öncesi Kontrol Listesi

- [ ] Backend çalışıyor mu? (`dotnet run`)
- [ ] ADB reverse yapıldı mı? (`adb reverse tcp:5015 tcp:5015`)
- [ ] Emülatör çalışıyor mu? (`adb devices`)
- [ ] Token geçerli mi? (Yeniden login)
- [ ] API URL doğru mu? (Log kontrolü)

## 🎯 Özet

**Development:**
- Android ve iOS ikisi de `http://localhost:5015` kullanır
- Android için `adb reverse tcp:5015 tcp:5015` gereklidir
- Backend lokal makinede çalışmalıdır

**Production:**
- Android ve iOS ikisi de `https://api.save-all.com` kullanır
- ADB reverse gerekmez
- Backend Google Cloud Run'da çalışır

