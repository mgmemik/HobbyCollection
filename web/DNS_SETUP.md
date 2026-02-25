# 🌐 DNS Kurulum Talimatları - www.save-all.com

## ✅ Deploy Durumu

**Build:** ✅ Başarılı
**Cloud Run Servisi:** ✅ Hazır ve Çalışıyor
**Service URL:** https://save-all-web-w2qvlhkctq-ew.a.run.app
**Domain Mapping:** ✅ Oluşturuldu
**Custom Domain:** www.save-all.com

---

## 📋 GoDaddy DNS Kayıtları

### Adım 1: GoDaddy'ye Giriş

1. https://www.godaddy.com adresine gidin
2. Hesabınıza giriş yapın

### Adım 2: DNS Management

1. **"My Products"** → **"Domains"** → **save-all.com** → **"DNS"** sekmesine gidin

### Adım 3: CNAME Kaydı Ekle

1. **"Add"** butonuna tıklayın
2. Aşağıdaki bilgileri girin:

```
Type:    CNAME
Name:    www
Value:   ghs.googlehosted.com.
TTL:     600 (10 dakika) veya 3600 (1 saat)
```

**ÖNEMLİ:** Value'nun sonunda nokta (.) olmalı: `ghs.googlehosted.com.`

3. **"Save"** butonuna tıklayın

---

## ⚠️ Önemli Notlar

1. **DNS Propagation:** DNS kayıtları genellikle 5-10 dakika içinde aktif olur, bazen 24 saate kadar sürebilir.

2. **SSL Sertifikası:** Domain mapping zaten oluşturuldu. DNS kaydı eklendikten sonra Google Cloud otomatik olarak SSL sertifikası oluşturacak (10-15 dakika sürebilir).

3. **Mevcut Kayıtlar:** Eğer `www` için zaten bir A record veya başka bir CNAME kaydı varsa, önce onu silin veya düzenleyin.

---

## 🔍 DNS Kaydını Test Etme

DNS kaydı eklendikten sonra:

```bash
# DNS kaydını kontrol edin
dig www.save-all.com CNAME

# Farklı DNS sunucularından kontrol
dig @8.8.8.8 www.save-all.com CNAME
dig @1.1.1.1 www.save-all.com CNAME

# nslookup ile kontrol
nslookup www.save-all.com
```

**Beklenen Sonuç:**
```
www.save-all.com.    CNAME    ghs.googlehosted.com.
```

---

## 🌐 SSL Sertifikası

Domain mapping zaten oluşturuldu. DNS kaydı eklendikten sonra:

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
   ```

2. **Domain mapping durumunu kontrol edin:**
   - `www.save-all.com` için mapping durumunu görebilirsiniz
   - SSL sertifikası otomatik olarak sağlanacak (5-15 dakika)

3. **SSL durumunu kontrol etmek için:**
   ```bash
   gcloud beta run domain-mappings describe www.save-all.com \
     --region=europe-west1 \
     --project=fresh-inscriber-472521-t7
   ```

---

## ✅ Test

### 1. DNS Kaydı Eklendikten Sonra (5-10 dakika)

```bash
# DNS propagation kontrolü
dig www.save-all.com CNAME

# Cloud Run URL ile test (her zaman çalışır)
curl -I https://save-all-web-w2qvlhkctq-ew.a.run.app

# Custom domain ile test (DNS propagation sonrası)
curl -I https://www.save-all.com
```

### 2. Tarayıcıda Test

DNS kaydı eklendikten 10-15 dakika sonra:

1. **Tarayıcıda açın:** https://www.save-all.com
2. **SSL sertifikasını kontrol edin:** Kilit ikonuna tıklayın
3. **Sayfanın yüklendiğini doğrulayın**

---

## 🔧 Sorun Giderme

### Problem: DNS kaydı görünmüyor

**Çözüm:**
- DNS kaydının doğru eklendiğinden emin olun
- TTL süresini bekleyin (5-10 dakika)
- Farklı DNS sunucularından test edin: `dig @8.8.8.8 www.save-all.com`

### Problem: SSL sertifikası yok

**Çözüm:**
- DNS kaydının doğru çalıştığından emin olun
- Domain mapping durumunu kontrol edin
- 15-20 dakika bekleyin (SSL sertifikası otomatik oluşturulur)

### Problem: Site yüklenmiyor

**Çözüm:**
- Cloud Run servisinin çalıştığını kontrol edin:
  ```bash
  gcloud run services describe save-all-web \
    --region=europe-west1 \
    --project=fresh-inscriber-472521-t7
  ```
- Service loglarını kontrol edin:
  ```bash
  gcloud run services logs read save-all-web \
    --region=europe-west1 \
    --project=fresh-inscriber-472521-t7 \
    --limit=50
  ```

---

## 📊 Mevcut Durum

- ✅ **Cloud Run Service:** Çalışıyor
- ✅ **Domain Mapping:** Oluşturuldu
- ⏳ **DNS Kaydı:** GoDaddy'de eklenmeyi bekliyor
- ⏳ **SSL Sertifikası:** DNS kaydı eklendikten sonra otomatik oluşturulacak

---

## 📞 Sonraki Adımlar

1. ✅ GoDaddy'de CNAME kaydını ekleyin (yukarıdaki talimatlara göre)
2. ⏳ DNS propagation için 5-10 dakika bekleyin
3. ⏳ SSL sertifikasının oluşturulması için 10-15 dakika bekleyin
4. ✅ https://www.save-all.com adresini test edin

---

## 🔗 Hızlı Linkler

- **Service URL:** https://save-all-web-w2qvlhkctq-ew.a.run.app
- **Custom Domain:** https://www.save-all.com (DNS eklendikten sonra)
- **Google Cloud Console:** https://console.cloud.google.com/run?project=fresh-inscriber-472521-t7
- **Domain Mappings:** https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
