# 🌐 Domain Verification ve DNS Ayarları - api.save-all.com

## ⚠️ ÖNEMLİ: Domain Verification Gerekli!

`api.save-all.com` domain'i Google Cloud'da verify edilmemiş. Önce domain verification yapmanız gerekiyor.

---

## 📋 ADIM 1: Google Cloud Console'da Domain Verification

### 1.1 Google Cloud Console'a Gidin

**🔗 Link:** https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7

VEYA

1. https://console.cloud.google.com adresine gidin
2. Proje: **fresh-inscriber-472521-t7** seçin
3. Sol menüden **Cloud Run** > **Domain Mappings** seçin

### 1.2 Domain Mapping Oluştur

1. **"CREATE DOMAIN MAPPING"** butonuna tıklayın
2. **Domain:** `api.save-all.com` yazın
3. **Service:** `hobbycollection-api` seçin
4. **Region:** `europe-west3` seçin
5. **"CREATE"** butonuna tıklayın

### 1.3 Verification Record Alın

Google Cloud size bir **verification record** verecek. Örnek:

```
Type: TXT
Name: api
Value: google-site-verification=ABC123XYZ789...
```

**Bu değeri kopyalayın!** (Bir sonraki adımda kullanacağız)

---

## 📋 ADIM 2: Domain Sağlayıcınızda DNS Kayıtları

**save-all.com** domain'inizin DNS yönetim panelinde şu kayıtları ekleyin:

### 2.1 TXT Record (Verification)

**Domain sağlayıcınızın DNS panelinde:**

```
Type: TXT
Name: api
Value: google-site-verification=ABC123XYZ789... (Cloud Console'dan aldığınız değer)
TTL: 3600 (veya otomatik)
```

**ÖNEMLİ:** 
- `Name` alanına sadece `api` yazın (subdomain için)
- Root domain için (`save-all.com`) `@` veya boş bırakın

### 2.2 CNAME Record

**Domain sağlayıcınızın DNS panelinde:**

```
Type: CNAME
Name: api
Value: ghs.googlehosted.com
TTL: 3600 (veya otomatik)
```

**ÖNEMLİ:** 
- `Name`: `api` (subdomain için)
- `Value`: `ghs.googlehosted.com` (Google'un hosting servisi)

---

## 🔍 DNS Sağlayıcı Örnekleri

### Cloudflare

1. **DNS** > **Records** > **Add record**
2. **Type:** `TXT`, **Name:** `api`, **Value:** `google-site-verification=...`
3. **Type:** `CNAME`, **Name:** `api`, **Target:** `ghs.googlehosted.com`
4. **⚠️ ÖNEMLİ:** CNAME kaydı için **Proxy durumu: DNS only** (Proxy kapalı olmalı!)

### GoDaddy

1. **DNS Management** > **Add**
2. **Type:** `TXT`, **Host:** `api`, **Value:** `google-site-verification=...`
3. **Type:** `CNAME`, **Host:** `api`, **Points to:** `ghs.googlehosted.com`

### Namecheap

1. **Advanced DNS** > **Add New Record**
2. **Type:** `TXT Record`, **Host:** `api`, **Value:** `google-site-verification=...`
3. **Type:** `CNAME Record`, **Host:** `api`, **Value:** `ghs.googlehosted.com`

### Google Domains

1. **DNS** > **Custom records**
2. **Type:** `TXT`, **Subdomain:** `api`, **Data:** `google-site-verification=...`
3. **Type:** `CNAME`, **Subdomain:** `api`, **Data:** `ghs.googlehosted.com`

---

## ✅ ADIM 3: Verification Kontrolü

DNS kayıtlarını ekledikten sonra **5-10 dakika** bekleyin (DNS propagation).

### 3.1 DNS Kayıtlarını Kontrol Edin

```bash
# TXT kaydını kontrol et
dig api.save-all.com TXT +short

# CNAME kaydını kontrol et
dig api.save-all.com CNAME +short
```

**Beklenen Çıktı:**
```
TXT: "google-site-verification=ABC123XYZ..."
CNAME: ghs.googlehosted.com.
```

### 3.2 Google Cloud Console'da Kontrol

1. https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
2. Domain mapping'in durumunu kontrol edin
3. **Status:** `Ready` olmalı

### 3.3 Terminal'den Kontrol

```bash
gcloud beta run domain-mappings describe api.save-all.com --region=europe-west3
```

**Başarılı durum:**
```
status:
  conditions:
  - status: 'True'
    type: Ready
```

---

## 🎉 ADIM 4: Test

Verification tamamlandıktan sonra:

```bash
# HTTPS testi
curl -I https://api.save-all.com/api/health

# SSL sertifikası kontrolü
openssl s_client -connect api.save-all.com:443 -servername api.save-all.com
```

---

## ⚠️ Önemli Notlar

1. **Cloudflare Proxy:** Eğer Cloudflare kullanıyorsanız, CNAME kaydı için **Proxy KAPALI** olmalı (DNS only). Aksi halde SSL sertifikası oluşturulamaz.

2. **DNS Propagation:** DNS değişiklikleri 5-10 dakika sürebilir. Sabırlı olun.

3. **SSL Sertifikası:** Cloud Run otomatik olarak Let's Encrypt SSL sertifikası oluşturur (5-10 dakika).

4. **Verification Süresi:** Domain verification genellikle 5-15 dakika sürer.

---

## 🆘 Sorun Giderme

### Problem: "Domain verification failed"

**Çözüm:**
- DNS kayıtlarının doğru eklendiğinden emin olun
- TTL süresini bekleyin (5-10 dakika)
- `dig` komutu ile DNS kayıtlarını kontrol edin

### Problem: "CNAME conflict"

**Çözüm:**
- Başka bir CNAME kaydı varsa kaldırın
- A record varsa kaldırın (CNAME ile çakışır)

### Problem: "SSL certificate pending"

**Çözüm:**
- DNS verification tamamlanmış olmalı
- 5-10 dakika bekleyin
- Cloud Run otomatik SSL sertifikası oluşturur

---

## 📞 Sonraki Adımlar

DNS kayıtlarını ekledikten sonra:

1. **5-10 dakika bekleyin** (DNS propagation)
2. **Google Cloud Console'da kontrol edin** (Domain mapping durumu)
3. **Test edin:** `curl https://api.save-all.com/api/health`

Başarılar! 🚀

