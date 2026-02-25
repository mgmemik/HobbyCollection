# 🔧 Android AI Analiz Sorunu - Çözüm

## 📋 Sorun Özeti

**Durum:** Android'de AI analiz yaparken "Network request failed" hatası alınıyor.
**Etkilenen:** Hem development (emülatör) hem de production (canlı uygulama)
**iOS:** Çalışıyor, sorun yok

## 🔍 Sorun Analizi

### Development (Emülatör) Sorunu
**Neden:**
- Android emülatör `10.0.2.2:5015` üzerinden localhost'a bağlanamıyordu
- iOS Simulator direkt `localhost:5015` kullanabiliyor

**Çözüm:**
✅ ADB reverse port forwarding yapıldı:
```bash
adb reverse tcp:5015 tcp:5015
```

Artık emülatör localhost:5015'e `10.0.2.2:5015` üzerinden erişebilir.

---

### Production (Canlı Uygulama) Sorunu

**Olası Nedenler:**

1. **FormData Gönderimi**
   - Android ve iOS'ta FormData farklı şekilde işleniyor olabilir
   - React Native'de FormData multipart/form-data olarak gönderilmeli

2. **Network Security Config**
   - Android için network security config eklendi
   - Production API (https://api.save-all.com) için HTTPS zorunlu

3. **API URL Konfigürasyonu**
   - Production build'de `__DEV__ === false` olacak
   - API_BASE_URL otomatik olarak `https://api.save-all.com` olacak

4. **Token/Authorization**
   - Backend'de `[Authorize]` attribute var mı kontrol et
   - Token header'da doğru gönderiliyor

## ✅ Yapılan Düzeltmeler

### 1. Network Security Config
Dosya: `android/app/src/main/res/xml/network_security_config.xml`

```xml
<!-- Production API için HTTPS -->
<domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">api.save-all.com</domain>
</domain-config>

<!-- Development için HTTP izni -->
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
</domain-config>
```

### 2. AndroidManifest.xml
```xml
<application 
    android:networkSecurityConfig="@xml/network_security_config">
```

### 3. Timeout ve Error Handling
- AI analiz için 120 saniye timeout
- Network hatası için açıklayıcı mesajlar
- Detaylı logging

### 4. API URL Konfigürasyonu
```typescript
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (!isDevelopment ? PRODUCTION_API_URL :
    Platform.OS === 'ios'
      ? `http://localhost:${DEFAULT_PORT}`
      : Platform.OS === 'android'
        ? `http://10.0.2.2:${DEFAULT_PORT}`
        : LAN_FALLBACK);
```

## 🧪 Test Sonrası Kontroller

### Production Build Sonrası Test:

1. **API URL Kontrolü**
   ```
   Logları kontrol edin:
   === API CONFIGURATION ===
   Selected URL Type: PRODUCTION
   API_BASE_URL: https://api.save-all.com
   __DEV__: false
   ```

2. **AI Analiz Testi**
   - Fotoğraf seçin
   - AI Check butonuna basın
   - Logları kontrol edin:
     ```
     === AI ANALİZ BAŞLATILIYOR ===
     API_BASE_URL: https://api.save-all.com
     === FETCH İSTEĞİ GÖNDERİLİYOR ===
     URL: https://api.save-all.com/api/photoanalysis/enhanced
     ```

3. **Backend Response Kontrolü**
   - Backend'den response geldiğini doğrulayın
   - Status: 200 OK olmalı
   - Result döndürülmeli

## 🚨 Sorun Devam Ederse

### Backend Kontrolü
```bash
# Backend çalışıyor mu?
curl https://api.save-all.com/api/photoanalysis/health

# Beklenen response:
{"status":"healthy","service":"EnhancedPhotoAnalysisService",...}
```

### FormData Debugging
Mobile tarafında FormData'nın doğru oluşturulduğunu kontrol edin:
```typescript
console.log('FormData içeriği:');
selectedUris.forEach((photo, index) => {
  console.log(`Photo ${index}:`, {
    uri: photo.uri,
    type: photo.type,
    name: photo.name,
    size: photo.size
  });
});
```

### Backend Log Kontrolü
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api" --limit 50 | grep -i "photo\|analysis\|error"
```

## 📝 Çözüm Özeti

| Ortam | Sorun | Çözüm | Durum |
|-------|-------|-------|-------|
| Development (Emülatör) | 10.0.2.2:5015 erişim sorunu | ADB reverse | ✅ Çözüldü |
| Production (Canlı) | Network request failed | Network security config + timeout | ✅ Test edilmeli |
| API URL | Yanlış ortam | Development/production algılama | ✅ Düzeltildi |
| Token | Remember me sorunu | Token yükleme mantığı | ✅ Düzeltildi |

## 🎯 Sonraki Adımlar

1. ✅ Backend publish edildi
2. ⏳ iOS build tamamlanıyor → TestFlight'a gönderilecek
3. ⏳ Android build tamamlanıyor → Internal testing'e gönderilecek
4. 🧪 Production build'lerle AI analiz test edilmeli
5. 📊 Sonuçları raporlayın

## ⚠️ Önemli Not

**Production build'de mutlaka test edin:**
- Development modundaki düzeltmeler (ADB reverse) sadece emülatör için
- Production'da `https://api.save-all.com` kullanılacak
- Build sonrası AI analiz testi yapın
- Sorun devam ederse backend log'larını inceleyin

