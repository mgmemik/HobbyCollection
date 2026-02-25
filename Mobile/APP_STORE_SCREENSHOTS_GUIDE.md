# 📸 App Store Ekran Görüntüleri ve Uygulama Önizlemesi Rehberi

Bu rehber, App Store'a yüklemek için ekran görüntüleri ve uygulama önizlemesi hazırlamanın en kolay ve etkili yöntemlerini içerir.

## ⭐ Önerilen Yöntem: Production API ile

**En verimli yöntem:** Simulator'ı production API'lere bağlayarak gerçek verilerle ekran görüntüleri almak. Bu sayede:
- ✅ Gerçek ürünler ve içeriklerle çalışırsınız
- ✅ Daha profesyonel görüntüler elde edersiniz
- ✅ Local backend kurulumu gerekmez

**Detaylı rehber için:** [`PRODUCTION_API_SCREENSHOTS.md`](./PRODUCTION_API_SCREENSHOTS.md)

**Hızlı başlangıç:**
```bash
npm run ios:prod -- --simulator="iPhone 15 Pro Max"
```

## 📋 App Store Gereksinimleri

### Ekran Görüntüleri Boyutları
- **iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max):** 1290 x 2796 piksel
- **iPhone 6.5" (iPhone 11 Pro Max, XS Max):** 1242 x 2688 piksel
- **iPhone 5.5" (iPhone 8 Plus):** 1242 x 2208 piksel
- **iPad Pro 12.9" (3. nesil ve sonrası):** 2048 x 2732 piksel
- **iPad Pro 11" (2. nesil ve sonrası):** 1668 x 2388 piksel

**Not:** En az 1 ekran görüntüsü gereklidir, ancak 3-5 adet önerilir.

### Uygulama Önizlemesi (App Preview)
- **Süre:** 15-30 saniye arası
- **Format:** MP4 veya MOV
- **Boyut:** Ekran görüntüleriyle aynı boyutlarda
- **Opsiyonel:** Zorunlu değil ama önerilir

---

## 🚀 Yöntem 1: iOS Simulator ile Manuel Ekran Görüntüsü

### ⭐ Production API ile (Önerilen)

**Gerçek verilerle çalışmak için:**

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile

# Production API'ye bağlanarak başlat
npm run ios:prod -- --simulator="iPhone 15 Pro Max"
```

Veya script ile:
```bash
npm run ios:production
```

**Avantajlar:**
- Gerçek ürünler ve içerikler
- Daha profesyonel görüntüler
- Local backend gerekmez

### Local API ile

**Local development için:**

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile

# Local API ile başlat (localhost)
npm run ios -- --simulator="iPhone 15 Pro Max"
```

Veya belirli bir cihaz modeli seçmek için:

```bash
# Kullanılabilir cihazları listele
xcrun simctl list devices

# Belirli bir cihaz ile başlat
npm run ios -- --simulator="iPhone 15 Pro Max"
```

### Adım 2: Ekran Görüntüsü Al

**Simulator'da:**
1. Uygulamayı istediğiniz ekrana getirin
2. **Cmd + S** tuşlarına basın (veya **Device > Screenshot** menüsünden)
3. Ekran görüntüsü otomatik olarak Desktop'a kaydedilir

**Farklı cihaz boyutları için:**
- Simulator menüsünden **Device > Manage Devices** ile farklı cihazlar ekleyin
- Her cihaz için ayrı ekran görüntüsü alın

### Adım 3: Ekran Görüntülerini Düzenle

Ekran görüntüleri Desktop'ta `Screen Shot [tarih] at [saat].png` formatında kaydedilir.

**Önerilen düzenlemeler:**
- Status bar'ı temizleyin (opsiyonel)
- Gereksiz alanları kırpın
- Tutarlı bir stil kullanın

---

## 🎥 Yöntem 2: Uygulama Önizlemesi (Video) Hazırlama

### Simulator ile Video Kaydı

1. **Simulator'da uygulamayı başlatın**
2. **Device > Record Screen** menüsünden kayıt başlatın
3. Uygulamada gezinin ve önemli özellikleri gösterin
4. **Device > Stop Recording** ile kaydı durdurun
5. Video Desktop'a kaydedilir

**Video düzenleme önerileri:**
- İlk 1-2 saniyeyi kırpın (başlangıç gecikmesi)
- 15-30 saniye arası tutun
- Ses eklemeyin (App Store ses kabul etmez)
- Smooth geçişler kullanın

---

## ⚡ Yöntem 3: Fastlane Snapshot (Otomatik ve Profesyonel)

Fastlane Snapshot, otomatik olarak tüm gerekli cihaz boyutlarında ekran görüntüleri alır.

### Kurulum

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile

# Fastlane kurulumu
sudo gem install fastlane

# Snapshot kurulumu
fastlane add_plugin snapshot
```

### Snapshot Konfigürasyonu

1. **Snapshotfile oluştur:**

```bash
fastlane snapshot init
```

Bu komut `fastlane/Snapshotfile` dosyası oluşturur.

2. **Snapshotfile'ı düzenle:**

```ruby
# fastlane/Snapshotfile
devices([
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone SE (3rd generation)",
  "iPad Pro (12.9-inch) (6th generation)"
])

languages([
  "en-US",
  "tr-TR"
])

scheme("SaveAll") # Xcode scheme adınız

output_directory("./screenshots")
```

3. **UI Test dosyaları oluştur:**

Snapshot, UI test dosyalarına ihtiyaç duyar. Xcode'da:
- **File > New > Target > UI Testing Bundle** ekleyin
- Test dosyalarını oluşturun

### Kullanım

```bash
# Tüm ekran görüntülerini al
fastlane snapshot

# Belirli bir cihaz için
fastlane snapshot --devices "iPhone 15 Pro Max"
```

---

## 🛠️ Yöntem 4: Özel Script ile Otomatikleştirme

Basit bir shell script ile ekran görüntüleri alma sürecini otomatikleştirebilirsiniz.

### Script Oluşturma

`capture-screenshots.sh` dosyası oluşturun:

```bash
#!/bin/bash

# Farklı cihazlarda ekran görüntüleri almak için script

DEVICES=(
  "iPhone 15 Pro Max"
  "iPhone 15 Pro"
  "iPad Pro (12.9-inch) (6th generation)"
)

OUTPUT_DIR="./screenshots"

# Çıktı klasörünü oluştur
mkdir -p "$OUTPUT_DIR"

# Her cihaz için ekran görüntüsü al
for device in "${DEVICES[@]}"; do
  echo "📱 $device için ekran görüntüsü alınıyor..."
  
  # Simulator'ı başlat ve uygulamayı çalıştır
  xcrun simctl boot "$device" 2>/dev/null || true
  npm run ios -- --simulator="$device" &
  
  # Uygulamanın yüklenmesini bekle
  sleep 10
  
  # Ekran görüntüsü al
  xcrun simctl io booted screenshot "$OUTPUT_DIR/${device// /_}.png"
  
  # Simulator'ı kapat
  xcrun simctl shutdown "$device"
done

echo "✅ Tüm ekran görüntüleri $OUTPUT_DIR klasörüne kaydedildi!"
```

---

## 📱 Pratik İpuçları

### 1. Hangi Ekranları Göstermeli?

- **Ana ekran:** Uygulamanın ana özelliğini gösteren ekran
- **Önemli özellikler:** Kullanıcıların ilgisini çekecek özellikler
- **Kullanıcı arayüzü:** Modern ve temiz görünen ekranlar
- **Ürün detayları:** Eğer bir ürün/koleksiyon uygulamasıysa, detay ekranları

### 2. Ekran Görüntülerini Optimize Etme

- **Status Bar:** Temiz ve tutarlı olmalı (saat 9:41, tam batarya, WiFi açık)
- **Notch/Dynamic Island:** Modern iPhone'larda dikkat edin
- **Safe Area:** Önemli içeriğin kesilmediğinden emin olun
- **Tutarlılık:** Tüm ekran görüntülerinde aynı stil ve tema

### 3. Uygulama Önizlemesi İçin İpuçları

- **İlk 3 saniye kritik:** En önemli özelliği hemen gösterin
- **Yavaş hareket:** Hızlı geçişler kullanıcıyı şaşırtabilir
- **Net odak:** Her an ne gösterildiği açık olmalı
- **Ses yok:** App Store ses kabul etmez, müzik eklemeyin

---

## 🎯 Hızlı Başlangıç (Önerilen Yol)

### Production API ile (Önerilen - Gerçek Veriler)

1. **Production API ile iOS Simulator'ı başlat:**
   ```bash
   cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile
   npm run ios:prod -- --simulator="iPhone 15 Pro Max"
   ```
   
   Veya script ile:
   ```bash
   npm run ios:production
   ```

2. **Giriş yapın** (production hesabı ile)

3. **Ekran görüntüleri alın** (gerçek verilerle)

### Local API ile

1. **iOS Simulator'ı başlat:**
   ```bash
   cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile
   npm run ios -- --simulator="iPhone 15 Pro Max"
   ```

2. **Uygulamada gezin ve önemli ekranları belirle:**
   - Ana ekran
   - Ürün detay ekranı
   - Profil ekranı
   - Arama ekranı
   - Ayarlar ekranı

3. **Her ekran için Cmd + S ile ekran görüntüsü al**

4. **Video kaydı için:**
   - Device > Record Screen
   - 15-30 saniye uygulamada gezin
   - Stop Recording

5. **Ekran görüntülerini düzenle:**
   - Preview veya Photoshop ile
   - Status bar'ı temizle (opsiyonel)
   - Boyutları kontrol et

6. **App Store Connect'e yükle:**
   - App Store Connect > My Apps > [Uygulamanız]
   - App Store > Screenshots
   - Gerekli boyutlarda ekran görüntülerini yükleyin

---

## 📚 Ek Kaynaklar

- [Apple App Store Screenshot Guidelines](https://developer.apple.com/app-store/product-page/)
- [Fastlane Snapshot Documentation](https://docs.fastlane.tools/actions/snapshot/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

---

## ✅ Kontrol Listesi

- [ ] En az 1 ekran görüntüsü hazırlandı (3-5 önerilir)
- [ ] Tüm ekran görüntüleri doğru boyutlarda
- [ ] Status bar tutarlı ve temiz
- [ ] Önemli özellikler gösteriliyor
- [ ] Uygulama önizlemesi hazırlandı (opsiyonel ama önerilir)
- [ ] Video 15-30 saniye arası
- [ ] Tüm görseller App Store Connect'e yüklendi

---

**Not:** İlk kez App Store'a yüklüyorsanız, en az 3 ekran görüntüsü önerilir. Uygulama önizlemesi zorunlu değildir ancak indirme oranlarını artırabilir.
