# 🚀 Simülatör ile Production API'ye Bağlanma Rehberi

Bu rehber, iOS Simulator'ı production API'lere bağlayarak gerçek verilerle ekran görüntüleri almanızı sağlar.

## 🎯 Neden Production API?

- ✅ **Gerçek veriler:** Gerçek ürünler, kullanıcılar ve içeriklerle ekran görüntüleri
- ✅ **Daha profesyonel:** App Store'da gösterilecek gerçekçi görüntüler
- ✅ **Hızlı:** Local backend kurulumu gerekmez
- ✅ **Güncel:** Production'daki en güncel veriler

## 🔧 Yöntem 1: Environment Variable ile (Önerilen)

### Adım 1: Production API ile Başlat

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile

# Production API'ye bağlanarak başlat
EXPO_PUBLIC_API_BASE_URL=https://api.save-all.com npm run ios
```

### Adım 2: Doğrulama

Uygulama başladığında console'da şu logları görmelisiniz:

```
=== API CONFIGURATION ===
API_BASE_URL: https://api.save-all.com
EXPO_PUBLIC_API_BASE_URL: https://api.save-all.com
Selected URL Type: PRODUCTION
```

### Adım 3: Ekran Görüntüleri Al

Artık production verileriyle ekran görüntüleri alabilirsiniz!

---

## 🛠️ Yöntem 2: Script ile Otomatik Başlatma

`start-ios-production.sh` scriptini kullanarak otomatik başlatabilirsiniz:

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile
./start-ios-production.sh
```

---

## 📸 Ekran Görüntüleri Alma İş Akışı

### 1. Production API ile Başlat

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.save-all.com npm run ios -- --simulator="iPhone 15 Pro Max"
```

### 2. Giriş Yap

- Production API'de geçerli bir hesabınızla giriş yapın
- Veya yeni bir hesap oluşturun

### 3. Ekran Görüntüleri Al

- **Ana ekran:** Ürün feed'i
- **Ürün detay:** Gerçek bir ürünün detay sayfası
- **Profil:** Kullanıcı profili
- **Arama:** Arama sonuçları
- **Koleksiyon:** Kategorize edilmiş ürünler

### 4. Cmd + S ile Ekran Görüntüsü Al

Her ekran için `Cmd + S` tuşlarına basın.

---

## 🎥 Video Kaydı (App Preview)

Production API ile video kaydı için:

1. **Production API ile başlat:**
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://api.save-all.com npm run ios
   ```

2. **Giriş yap ve hazır olun**

3. **Simulator'da Device > Record Screen**

4. **Uygulamada gezin:**
   - Ana ekranı gösterin
   - Bir ürün detayına gidin
   - Arama yapın
   - Profil sayfasını gösterin

5. **Device > Stop Recording**

6. **Video Desktop'a kaydedilir**

---

## ⚠️ Önemli Notlar

### Authentication

- Production API'ye bağlandığınızda gerçek bir hesap ile giriş yapmanız gerekir
- Test hesapları kullanabilirsiniz
- Token'lar production'da geçerli olmalı

### Network

- Simulator internet bağlantısına ihtiyaç duyar
- Production API'ye erişim olmalı
- HTTPS bağlantısı gerekli

### Veri Güvenliği

- Production verilerini kullanırken dikkatli olun
- Hassas bilgiler ekran görüntülerinde görünmemeli
- Test hesapları kullanmak önerilir

---

## 🔄 Local API'ye Geri Dönme

Local development için normal şekilde başlatın:

```bash
# Environment variable olmadan başlat (localhost kullanır)
npm run ios
```

---

## 📋 Hızlı Referans

### Production API ile Başlat
```bash
EXPO_PUBLIC_API_BASE_URL=https://api.save-all.com npm run ios
```

### Belirli Cihaz ile
```bash
EXPO_PUBLIC_API_BASE_URL=https://api.save-all.com npm run ios -- --simulator="iPhone 15 Pro Max"
```

### Ekran Görüntüsü Al
- Simulator'da: `Cmd + S`

### Video Kaydı
- Simulator'da: `Device > Record Screen`
- Durdur: `Device > Stop Recording`

---

## 🐛 Sorun Giderme

### API'ye Bağlanamıyor

```bash
# Production API'nin çalıştığını kontrol et
curl https://api.save-all.com/api/photoanalysis/health
```

### Environment Variable Çalışmıyor

- Expo development server'ı yeniden başlatın
- `.env` dosyası kullanmayın (Expo bunu desteklemez)
- Doğrudan komut satırında environment variable kullanın

### Token Sorunları

- Production API'de geçerli bir token gerekir
- Giriş yaparak yeni token alın
- Token süresi dolmuşsa yeniden giriş yapın

---

## ✅ Kontrol Listesi

- [ ] Production API ile başlatıldı (`EXPO_PUBLIC_API_BASE_URL` set edildi)
- [ ] Console'da production URL görünüyor
- [ ] Giriş yapıldı (production hesabı)
- [ ] Gerçek veriler yükleniyor
- [ ] Ekran görüntüleri alındı
- [ ] Video kaydedildi (opsiyonel)

---

**Not:** Production API kullanırken gerçek verilerle çalıştığınızı unutmayın. Test hesapları kullanmak ve hassas bilgileri ekran görüntülerinde göstermemek önemlidir.
