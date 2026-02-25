# 🚀 App Store Ekran Görüntüleri - Hızlı Başlangıç

## ⚡ En Hızlı Yol (Production API ile)

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile

# 1. Production API ile başlat
npm run ios:prod -- --simulator="iPhone 15 Pro Max"

# 2. Uygulamada giriş yapın

# 3. İstediğiniz ekrana gidin

# 4. Cmd + S ile ekran görüntüsü alın (Desktop'a kaydedilir)
```

## 📋 Tüm Komutlar

```bash
# Production API ile başlat
npm run ios:prod                    # Varsayılan cihaz
npm run ios:prod -- --simulator="iPhone 15 Pro Max"  # Belirli cihaz

# Script ile başlat
npm run ios:production

# Otomatik ekran görüntüsü scripti (production API ile)
npm run screenshots

# Rehberleri görüntüle
npm run screenshot:guide            # Ana rehber
cat PRODUCTION_API_SCREENSHOTS.md   # Production API rehberi
cat APP_PREVIEW_GUIDE.md            # Video rehberi
```

## 🎯 Önerilen İş Akışı

1. **Production API ile başlat:**
   ```bash
   npm run ios:prod -- --simulator="iPhone 15 Pro Max"
   ```

2. **Giriş yapın** (production hesabı)

3. **Ekran görüntüleri alın:**
   - Ana ekran → `Cmd + S`
   - Ürün detay → `Cmd + S`
   - Profil → `Cmd + S`
   - Arama → `Cmd + S`

4. **Video kaydı (opsiyonel):**
   - `Device > Record Screen`
   - 15-30 saniye gezin
   - `Device > Stop Recording`

5. **Desktop'taki görüntüleri kontrol edin**

6. **App Store Connect'e yükleyin**

## 📚 Detaylı Rehberler

- **[APP_STORE_SCREENSHOTS_GUIDE.md](./APP_STORE_SCREENSHOTS_GUIDE.md)** - Tüm yöntemler ve detaylar
- **[PRODUCTION_API_SCREENSHOTS.md](./PRODUCTION_API_SCREENSHOTS.md)** - Production API kullanımı
- **[APP_PREVIEW_GUIDE.md](./APP_PREVIEW_GUIDE.md)** - Video hazırlama

## ✅ Kontrol Listesi

- [ ] Production API ile başlatıldı
- [ ] Giriş yapıldı
- [ ] En az 3 ekran görüntüsü alındı
- [ ] Video kaydedildi (opsiyonel)
- [ ] Görüntüler kontrol edildi
- [ ] App Store Connect'e yüklendi

---

**Not:** Production API kullanırken gerçek verilerle çalıştığınızı unutmayın. Test hesapları kullanmak önerilir.
