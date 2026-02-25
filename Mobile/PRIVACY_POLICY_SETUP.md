# 🔒 Privacy Policy Kurulumu - Google Play Console

Google Play Console, CAMERA ve diğer hassas izinler için Privacy Policy URL'si gerektirir.

## 📋 Sorun

**Hata Mesajı:**
```
Your APK or Android App Bundle is using permissions that require a privacy policy: 
(android.permission.CAMERA)
```

## ✅ Çözüm: Privacy Policy URL'si Ekleme

### Yöntem 1: Google Play Console'da Ekleme (Önerilen)

**Adım 1: Google Play Console'a Git**
- https://play.google.com/console adresine git
- Uygulamanı seç

**Adım 2: Privacy Policy Sayfasına Git**
- Sol menüden **"Policy"** > **"App content"** seçeneğine tıkla
- VEYA doğrudan şu URL'yi aç: https://play.google.com/console/u/0/developers/[APP_ID]/app-content
- Sayfada **"Privacy Policy"** bölümünü bul

**Adım 3: Privacy Policy URL'si Ekle**
- **"Privacy Policy"** bölümünde **"Start"** veya **"Add"** butonuna tıkla
- Privacy Policy URL'sini gir (örn: `https://save-all.com/privacy` veya `https://www.save-all.com/privacy-policy`)
- **"Save"** butonuna tıkla

**Önemli:** 
- URL herkese açık olmalı (şifre korumalı olmamalı)
- URL HTTPS ile başlamalı
- Privacy Policy sayfası erişilebilir olmalı

### Yöntem 2: Privacy Policy Sayfası Oluşturma

Eğer henüz bir Privacy Policy sayfanız yoksa:

#### Seçenek A: Basit HTML Sayfası Oluşturma

1. Bir web hosting servisi kullanın (GitHub Pages, Netlify, Vercel, vb.)
2. Privacy Policy içeriğini oluşturun
3. URL'yi Google Play Console'a ekleyin

#### Seçenek B: Privacy Policy Generator Kullanma

Ücretsiz Privacy Policy generator'lar:
- https://www.freeprivacypolicy.com/
- https://www.privacypolicygenerator.info/
- https://www.privacypolicytemplate.net/

#### Seçenek C: Mevcut Web Sitesine Ekleme

Eğer `save-all.com` gibi bir web siteniz varsa:
- `/privacy` veya `/privacy-policy` sayfası oluşturun
- URL'yi Google Play Console'a ekleyin

## 📝 Privacy Policy İçeriği (Örnek)

Privacy Policy'de şunlar olmalı:

1. **Veri Toplama:** Hangi verileri topladığınız
2. **Veri Kullanımı:** Verileri nasıl kullandığınız
3. **Kamera İzni:** Kamera erişiminin neden gerekli olduğu
4. **Fotoğraf Erişimi:** Fotoğraf erişiminin neden gerekli olduğu
5. **Veri Güvenliği:** Verilerin nasıl korunduğu
6. **Kullanıcı Hakları:** Kullanıcıların hakları
7. **İletişim:** İletişim bilgileri

### Örnek Privacy Policy İçeriği (Türkçe)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gizlilik Politikası - Save All</title>
</head>
<body>
    <h1>Gizlilik Politikası</h1>
    
    <h2>1. Veri Toplama</h2>
    <p>Save All uygulaması, koleksiyonunuzu yönetmek için aşağıdaki verileri toplar:</p>
    <ul>
        <li>Kullanıcı hesap bilgileri (e-posta adresi)</li>
        <li>Ürün fotoğrafları (kamera veya galeri erişimi ile)</li>
        <li>Ürün bilgileri (isim, kategori, fiyat, vb.)</li>
    </ul>
    
    <h2>2. Kamera ve Fotoğraf Erişimi</h2>
    <p>Uygulama, ürün fotoğrafları çekmek ve galeriden fotoğraf seçmek için kamera ve fotoğraf erişimine ihtiyaç duyar. Bu izinler sadece ürün fotoğrafları eklemek için kullanılır.</p>
    
    <h2>3. Veri Kullanımı</h2>
    <p>Toplanan veriler sadece uygulama içi özellikler için kullanılır ve üçüncü taraflarla paylaşılmaz.</p>
    
    <h2>4. Veri Güvenliği</h2>
    <p>Verileriniz güvenli sunucularda saklanır ve şifrelenir.</p>
    
    <h2>5. İletişim</h2>
    <p>Sorularınız için: support@thebarnapp.com</p>
    
    <p><strong>Son Güncelleme:</strong> [TARİH]</p>
</body>
</html>
```

## 🚀 Hızlı Çözüm: GitHub Pages ile Privacy Policy

Eğer hızlıca bir Privacy Policy sayfası oluşturmak isterseniz:

1. GitHub'da yeni bir repository oluşturun (örn: `save-all-privacy`)
2. `index.html` dosyası oluşturun ve Privacy Policy içeriğini ekleyin
3. GitHub Pages'i aktifleştirin
4. URL şu şekilde olacak: `https://[kullanıcı-adı].github.io/save-all-privacy/`
5. Bu URL'yi Google Play Console'a ekleyin

## ✅ Kontrol Listesi

- [ ] Privacy Policy sayfası oluşturuldu
- [ ] Privacy Policy URL'si Google Play Console'a eklendi
- [ ] URL herkese açık ve erişilebilir
- [ ] URL HTTPS ile başlıyor
- [ ] Privacy Policy içeriği CAMERA iznini açıklıyor
- [ ] Google Play Console'da Privacy Policy kaydedildi

## 🔍 Doğrulama

Privacy Policy ekledikten sonra:

1. Google Play Console'da **"Policy"** > **"App content"** sayfasına git
2. Privacy Policy bölümünde URL'nin göründüğünü kontrol et
3. URL'ye tıklayarak sayfanın açıldığını doğrula
4. Tekrar build yüklemeyi dene

## 📚 Ek Kaynaklar

- [Google Play Privacy Policy Gereksinimleri](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Privacy Policy Generator](https://www.freeprivacypolicy.com/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)


