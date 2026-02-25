# 🌐 DNS Kurulum Rehberi - save-all.com ve www.save-all.com
## Adım Adım GoDaddy Kurulumu

---

## 📋 Yapılacaklar Özeti

GoDaddy'de **iki DNS kaydı** eklemeniz gerekiyor:

### 1. Root Domain (save-all.com) için A Records:
- **Type:** A
- **Name:** @ (veya boş bırakın)
- **Value:** Aşağıdaki 4 IP adresinden her biri için ayrı kayıt:
  - 216.239.32.21
  - 216.239.34.21
  - 216.239.36.21
  - 216.239.38.21
- **TTL:** 600 (10 dakika)

### 2. www Subdomain için CNAME:
- **Type:** CNAME
- **Name:** www
- **Value:** ghs.googlehosted.com.
- **TTL:** 600 (10 dakika)

**Not:** Root domain (save-all.com) otomatik olarak www.save-all.com'a yönlendirilecek.

---

## 🎯 Adım 1: GoDaddy'ye Giriş

1. Tarayıcınızda **https://www.godaddy.com** adresine gidin
2. Sağ üst köşedeki **"Sign In"** butonuna tıklayın
3. Email ve şifrenizle giriş yapın

---

## 🎯 Adım 2: Domain Yönetim Sayfasına Gidin

1. Giriş yaptıktan sonra, üst menüden **"My Products"** sekmesine tıklayın
2. Sol menüden **"Domains"** seçeneğine tıklayın
3. Domain listesinden **"save-all.com"** domain'ine tıklayın
4. Açılan sayfada **"DNS"** sekmesine tıklayın

**Alternatif Yol:**
- Direkt olarak: https://dcc.godaddy.com/manage/save-all.com/dns

---

## 🎯 Adım 3: Mevcut Kayıtları Kontrol Edin

DNS sayfasında mevcut kayıtları göreceksiniz. Şunları kontrol edin:

### Root Domain (@) için:
- Eğer `@` (root domain) için zaten A Records varsa, bunları **SİLİN** veya **DEĞİŞTİRİN**
- Yeni A Records ekleyeceğiz (yukarıdaki 4 IP adresi)

### www Subdomain için:

**Seçenek A: A Record varsa**
- `www` için bir **A Record** (Type: A) varsa, onu **SİLİN**
- A Record'u silin, sonra CNAME ekleyin

**Seçenek B: Yanlış CNAME varsa**
- `www` için zaten bir CNAME varsa ama değeri `ghs.googlehosted.com.` değilse
- O kaydı **DÜZENLEYİN** ve değeri `ghs.googlehosted.com.` yapın

**Seçenek C: Doğru CNAME varsa**
- Eğer zaten `www` → `ghs.googlehosted.com.` kaydı varsa, hiçbir şey yapmanıza gerek yok! ✅

---

## 🎯 Adım 4: Root Domain (@) için A Records Ekleme

### 4.1. İlk A Record'u Ekleyin

1. **"Add"** veya **"+ Add"** butonuna tıklayın
2. Aşağıdaki bilgileri girin:

```
┌─────────────────────────────────────────┐
│ Type:    A                              │
│ Name:    @ (veya boş bırakın)           │
│ Value:   216.239.32.21                  │
│ TTL:     600                            │
└─────────────────────────────────────────┘
```

3. **"Save"** butonuna tıklayın

### 4.2. Kalan 3 A Record'u Ekleyin

Aynı işlemi **3 kez daha** tekrarlayın, her seferinde farklı IP adresi ile:

- **2. A Record:** Value = `216.239.34.21`
- **3. A Record:** Value = `216.239.36.21`
- **4. A Record:** Value = `216.239.38.21`

**Toplam 4 A Record** eklemiş olacaksınız.

---

## 🎯 Adım 5: www için CNAME Kaydı Ekleme

### 5.1. "Add" Butonuna Tıklayın

DNS kayıtları tablosunun üstünde veya yanında **"Add"** veya **"+ Add"** butonunu bulun ve tıklayın.

### 5.2. Kayıt Bilgilerini Girin

Açılan formda şu bilgileri girin:

```
┌─────────────────────────────────────────┐
│ Type:    CNAME                          │
│ Name:    www                            │
│ Value:   ghs.googlehosted.com.          │
│ TTL:     600                            │
└─────────────────────────────────────────┘
```

**ÖNEMLİ DETAYLAR:**

1. **Type:** Dropdown menüden **"CNAME"** seçin
2. **Name:** Sadece **"www"** yazın (nokta veya başka bir şey eklemeyin)
3. **Value:** **"ghs.googlehosted.com."** yazın
   - ⚠️ **SONUNDA NOKTA (.) OLMALI!**
   - Doğru: `ghs.googlehosted.com.`
   - Yanlış: `ghs.googlehosted.com` (nokta yok)
4. **TTL:** `600` yazın (10 dakika) veya varsayılan değeri kullanın

### 5.3. Kaydet

**"Save"** veya **"Add Record"** butonuna tıklayın.

---

## 🎯 Adım 6: Kayıtları Doğrulama

Kayıtlar eklendikten sonra, DNS kayıtları listesinde şunları görmelisiniz:

```
Type    Name    Value                    TTL
A       @       216.239.32.21           600
A       @       216.239.34.21           600
A       @       216.239.36.21           600
A       @       216.239.38.21           600
CNAME   www     ghs.googlehosted.com.    600
```

**Toplam 5 kayıt** olmalı (4 A Record + 1 CNAME).

---

## ⏱️ Adım 7: Bekleme Süresi

DNS kayıtları hemen aktif olmaz. Bekleme süreleri:

- **Minimum:** 5 dakika
- **Ortalama:** 10-15 dakika
- **Maksimum:** 24 saat (nadir)

**Öneri:** 10 dakika bekleyin, sonra test edin.

---

## ✅ Adım 8: Test Etme

### 8.1. Terminal/Command Prompt'ta Test

**Root Domain Testi:**
Mac/Linux:
```bash
dig save-all.com A +short
```

Windows (PowerShell):
```powershell
nslookup -type=A save-all.com
```

**Beklenen Sonuç (4 IP adresi):**
```
216.239.32.21
216.239.34.21
216.239.36.21
216.239.38.21
```

**www Subdomain Testi:**
Mac/Linux:
```bash
dig www.save-all.com CNAME +short
```

Windows (PowerShell):
```powershell
nslookup -type=CNAME www.save-all.com
```

**Beklenen Sonuç:**
```
ghs.googlehosted.com.
```

### 8.2. Web Tarayıcısında Test

1. **10-15 dakika bekleyin** (DNS propagation için)
2. **Root domain testi:**
   - Tarayıcıda **https://save-all.com** adresini açın
   - Otomatik olarak **https://www.save-all.com** adresine yönlendirilmeli ✅
3. **www subdomain testi:**
   - Tarayıcıda **https://www.save-all.com** adresini açın
   - Site yüklenmeli ve SSL sertifikası aktif olmalı (kilit ikonu) ✅

---

## 🔍 Sorun Giderme

### Problem 1: "DNS kaydı görünmüyor"

**Kontrol:**
```bash
dig www.save-all.com CNAME +short
```

**Çözüm:**
- GoDaddy'de kaydın doğru eklendiğinden emin olun
- TTL süresini bekleyin (5-10 dakika)
- Farklı DNS sunucularından test edin:
  ```bash
  dig @8.8.8.8 www.save-all.com CNAME
  dig @1.1.1.1 www.save-all.com CNAME
  ```

### Problem 2: "Site yüklenmiyor" veya "404 hatası"

**Kontrol:**
```bash
# Cloud Run servisinin çalıştığını kontrol edin
curl -I https://save-all-web-w2qvlhkctq-ew.a.run.app
```

**Çözüm:**
- Cloud Run servisi çalışıyorsa, DNS propagation için daha fazla bekleyin
- Tarayıcı cache'ini temizleyin (Ctrl+Shift+R veya Cmd+Shift+R)

### Problem 3: "SSL sertifikası hatası"

**Kontrol:**
- DNS kaydının doğru çalıştığından emin olun
- 15-20 dakika bekleyin (SSL sertifikası otomatik oluşturulur)

**Çözüm:**
- Google Cloud Console'da domain mapping durumunu kontrol edin:
  ```
  https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
  ```

### Problem 4: "GoDaddy'de kayıt ekleyemiyorum"

**Olası Nedenler:**
- Domain başka bir hesapta olabilir
- DNS yönetimi başka bir serviste olabilir (Cloudflare, Route53, vb.)

**Çözüm:**
- Domain'in hangi hesapta olduğunu kontrol edin
- Eğer Cloudflare gibi bir DNS servisi kullanıyorsanız, orada da aynı kaydı ekleyin

---

## 📸 Görsel Rehber (GoDaddy Arayüzü)

### DNS Sayfası Görünümü:

```
┌─────────────────────────────────────────────────────────────┐
│  DNS Management - save-all.com                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Records                                                    │
│  ┌─────────┬──────┬──────────────────────┬─────┐          │
│  │ Type    │ Name │ Value                │ TTL │          │
│  ├─────────┼──────┼──────────────────────┼─────┤          │
│  │ A       │ @    │ 192.0.2.1            │ 600 │          │
│  │ CNAME   │ www  │ ghs.googlehosted.com.│ 600 │ ← BURASI │
│  └─────────┴──────┴──────────────────────┴─────┘          │
│                                                             │
│  [+ Add]                                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Hızlı Kontrol Listesi

- [ ] GoDaddy'ye giriş yaptım
- [ ] save-all.com domain'inin DNS sayfasına gittim
- [ ] Mevcut kayıtları kontrol ettim
- [ ] Root domain (@) için 4 A Record ekledim:
  - [ ] A Record 1: Value = 216.239.32.21
  - [ ] A Record 2: Value = 216.239.34.21
  - [ ] A Record 3: Value = 216.239.36.21
  - [ ] A Record 4: Value = 216.239.38.21
- [ ] www için CNAME kaydı ekledim:
  - [ ] Type: CNAME
  - [ ] Name: www
  - [ ] Value: ghs.googlehosted.com. (sonunda nokta var)
  - [ ] TTL: 600
- [ ] Tüm kayıtları kaydettim
- [ ] 10 dakika bekledim
- [ ] DNS kayıtlarını test ettim:
  - [ ] `dig save-all.com A` (4 IP adresi döndü)
  - [ ] `dig www.save-all.com CNAME` (ghs.googlehosted.com. döndü)
- [ ] Tarayıcıda test ettim:
  - [ ] https://save-all.com → www'ye yönlendirildi ✅
  - [ ] https://www.save-all.com → Site yüklendi ✅
  - [ ] SSL çalışıyor ✅

---

## 📞 Yardım Gerekirse

Eğer sorun yaşıyorsanız:

1. **DNS kaydını kontrol edin:**
   ```bash
   dig www.save-all.com CNAME +short
   ```

2. **Cloud Run servisini kontrol edin:**
   ```bash
   curl -I https://save-all-web-w2qvlhkctq-ew.a.run.app
   ```

3. **Google Cloud Console'da domain mapping durumunu kontrol edin:**
   - https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7

---

## ✅ Başarı Kriterleri

DNS kurulumu başarılı olduğunda:

1. ✅ `dig save-all.com A` komutu 4 IP adresi döndürür (216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21)
2. ✅ `dig www.save-all.com CNAME` komutu `ghs.googlehosted.com.` döndürür
3. ✅ Tarayıcıda https://save-all.com açılır ve otomatik olarak https://www.save-all.com'a yönlendirilir
4. ✅ Tarayıcıda https://www.save-all.com açılır
5. ✅ Her iki domain için de SSL sertifikası aktif (kilit ikonu yeşil)
6. ✅ Site içeriği görüntülenir

---

**Hazırsanız, Adım 1'den başlayın! 🚀**
