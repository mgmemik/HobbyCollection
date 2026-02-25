# 📋 Google Play Console Data Safety Soruları - Cevaplar

## Soru 1: Does your app collect or share any of the required user data types?

**Cevap: Yes**

**Açıklama:**
Uygulama aşağıdaki veri türlerini toplar:
- **Email address** (hesap oluşturma ve giriş için)
- **Photos** (ürün fotoğrafları - kamera/galeri erişimi)
- **User-generated content** (ürün bilgileri, koleksiyon verileri)
- **App activity** (kullanım verileri, tercihler)

## Soru 2: Is all of the user data collected by your app encrypted in transit?

**Cevap: Yes**

**Açıklama:**
- Tüm API iletişimi HTTPS üzerinden yapılır (api.save-all.com)
- Backend'de HTTPS redirection aktif (`app.UseHttpsRedirection()`)
- Tüm veri aktarımı şifrelenmiş bağlantılar üzerinden gerçekleşir
- JWT token'lar HTTPS üzerinden iletilir

## Soru 3: Which of the following methods of account creation does your app support?

**Cevap: Username and other authentication**

**Seçenekler:**
- ✅ **Username and other authentication** (ÖNERİLEN)
- ❌ Username and password
- ❌ Username, password, and other authentication
- ❌ OAuth
- ❌ Other
- ❌ My app does not allow users to create an account

**Açıklama:**
- **Username:** Email adresi kullanıcı adı olarak kullanılır
- **Other authentication:** Email'e gönderilen 6 haneli doğrulama kodu (verification code)
- Password kullanılmaz - Passwordless authentication sistemi
- Kayıt akışı:
  1. Kullanıcı email adresini girer
  2. Email'e 6 haneli kod gönderilir
  3. Kod ile email doğrulanır
  4. Giriş için email'e JWT token gönderilir (password yok)

**Alternatif Cevap (Eğer "Username and other authentication" seçeneği yoksa):**
- **Other** seçeneğini seçin ve açıklama alanına şunu yazın:
  ```
  Email-based passwordless authentication: Users register with email address and verify via email verification code. Login is done via email-based token authentication (no password required).
  ```

## 📝 Ek Notlar

### Veri Toplama Detayları:
- **Email:** Hesap oluşturma, giriş ve bildirimler için
- **Photos:** Ürün fotoğrafları (kamera/galeri izinleri)
- **User Content:** Ürün bilgileri, koleksiyon verileri
- **App Preferences:** Dil, tema, para birimi tercihleri

### Veri Güvenliği:
- Tüm veriler HTTPS üzerinden iletilir
- Şifreler hash'lenerek saklanır (ASP.NET Identity)
- JWT token'lar güvenli şekilde yönetilir
- Veriler Google Cloud SQL'de güvenli sunucularda saklanır

### Hesap Oluşturma Süreci:
1. Kullanıcı email adresini girer
2. Sistem email'e 6 haneli doğrulama kodu gönderir
3. Kullanıcı kodu girer ve email doğrulanır
4. Hesap oluşturulur (password yok)
5. Giriş için email'e JWT token gönderilir

## ✅ Kontrol Listesi

- [x] Veri toplama: Yes
- [x] Veri şifreleme: Yes (HTTPS)
- [x] Hesap oluşturma: Username and other authentication
- [x] Privacy Policy URL: https://api.save-all.com/privacy-policy

