# 🎥 App Store Uygulama Önizlemesi (Video) Hazırlama

Bu rehber, App Store için uygulama önizlemesi videosu hazırlamanın en kolay yöntemlerini içerir.

## 📋 App Store Video Gereksinimleri

- **Format:** MP4 veya MOV
- **Süre:** 15-30 saniye arası (en fazla 30 saniye)
- **Boyut:** Ekran görüntüleriyle aynı boyutlarda
- **Ses:** Yok (App Store ses kabul etmez)
- **Opsiyonel:** Zorunlu değil ama önerilir

## 🚀 Yöntem 1: iOS Simulator ile Video Kaydı (En Kolay)

### Adım 1: Simulator'ı Başlat

```bash
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile
npm run ios -- --simulator="iPhone 15 Pro Max"
```

### Adım 2: Video Kaydı Başlat

1. **Simulator menüsünden:** `Device > Record Screen`
2. Veya **klavye kısayolu:** `Cmd + R` (bazı Simulator versiyonlarında)

### Adım 3: Uygulamada Gezin

- İlk 1-2 saniyede ana ekranı gösterin
- Önemli özellikleri sırayla gösterin
- Smooth geçişler yapın (hızlı hareket etmeyin)
- 15-30 saniye arası tutun

### Adım 4: Kaydı Durdur

1. **Simulator menüsünden:** `Device > Stop Recording`
2. Video otomatik olarak Desktop'a kaydedilir

### Adım 5: Video Düzenleme

**QuickTime Player ile:**
1. Desktop'taki video dosyasını açın
2. `Edit > Trim` ile ilk/son kısımları kırpın
3. 15-30 saniye arası tutun
4. `File > Export As > 1080p` ile kaydedin

**iMovie ile (daha gelişmiş):**
1. Video'yu iMovie'ye import edin
2. İlk 1-2 saniyeyi kırpın (başlangıç gecikmesi)
3. 30 saniyeyi geçmeyecek şekilde düzenleyin
4. Export edin

## 🎬 Video İçeriği İpuçları

### İlk 3 Saniye Kritik
- Uygulamanın ana özelliğini hemen gösterin
- Kullanıcı ne yapacağını anlamalı

### Önerilen Akış
1. **0-3 saniye:** Ana ekran / Logo / Splash
2. **3-10 saniye:** Ana özellik gösterimi
3. **10-20 saniye:** İkinci önemli özellik
4. **20-30 saniye:** Üçüncü özellik veya call-to-action

### Yapılması Gerekenler
✅ Smooth ve yavaş hareketler
✅ Net odak (her an ne gösterildiği belli)
✅ Tutarlı tema ve stil
✅ Önemli özellikleri vurgula

### Yapılmaması Gerekenler
❌ Ses ekleme (App Store kabul etmez)
❌ Çok hızlı geçişler
❌ 30 saniyeyi geçme
❌ Belirsiz veya bulanık görüntüler

## 🛠️ Yöntem 2: QuickTime ile Gerçek Cihazdan Kayıt

Gerçek iPhone/iPad kullanmak istiyorsanız:

1. **iPhone'u Mac'e bağlayın**
2. **QuickTime Player'ı açın**
3. **File > New Movie Recording**
4. **Kayıt butonunun yanındaki ok'a tıklayın**
5. **iPhone'unuzu seçin**
6. **Kayıt başlatın**
7. **iPhone'da uygulamayı çalıştırın ve gezin**
8. **Kaydı durdurun**

## 📱 Farklı Cihaz Boyutları İçin

Her cihaz boyutu için ayrı video hazırlamak zorunlu değildir, ancak önerilir:

- **iPhone 6.7"** (iPhone 15 Pro Max): En önemli
- **iPhone 6.1"** (iPhone 15 Pro): İkinci öncelik
- **iPad:** Tablet kullanıcıları için önemli

## 🎯 Hızlı Başlangıç

```bash
# 1. Simulator'ı başlat
cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile
npm run ios -- --simulator="iPhone 15 Pro Max"

# 2. Simulator'da Device > Record Screen

# 3. Uygulamada 15-30 saniye gezin

# 4. Device > Stop Recording

# 5. Desktop'taki video'yu QuickTime ile düzenle

# 6. App Store Connect'e yükle
```

## 📚 Ek Kaynaklar

- [Apple App Preview Guidelines](https://developer.apple.com/app-store/product-page/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

---

**Not:** Uygulama önizlemesi zorunlu değildir ancak indirme oranlarını %30'a kadar artırabilir!
