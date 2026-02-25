# 🌐 DNS Kurulum Talimatları - backoffice.save-all.com

## ✅ Deploy Durumu

**Build:** ✅ Başarılı
**Cloud Run Servisi:** ✅ Hazır
**URL:** https://backoffice-admin-w2qvlhkctq-ew.a.run.app

---

## 📋 GoDaddy DNS Kayıtları

### Adım 1: GoDaddy'ye Giriş

1. https://www.godaddy.com adresine gidin
2. Hesabınıza giriş yapın

### Adım 2: DNS Management

1. "My Products" → "Domains" → **save-all.com** → **"DNS"** sekmesine gidin

### Adım 3: CNAME Kaydı Ekle

1. **"Add"** butonuna tıklayın
2. Aşağıdaki bilgileri girin:

```
Type:    CNAME
Name:    backoffice
Value:   backoffice-admin-w2qvlhkctq-ew.a.run.app
TTL:     600 (10 dakika)
```

3. **"Save"** butonuna tıklayın

---

## ⚠️ Önemli Notlar

1. **Domain Verification:** `backoffice.save-all.com` domain'i Google Cloud'da henüz verify edilmemiş. Domain mapping için önce verification yapılması gerekiyor.

2. **Alternatif Yöntem:** Domain mapping olmadan da çalışabilir. Sadece Cloud Run URL'ini kullanabilirsiniz:
   - **URL:** https://backoffice-admin-w2qvlhkctq-ew.a.run.app

3. **DNS Propagation:** DNS kayıtları 5-10 dakika içinde aktif olur, bazen 24 saate kadar sürebilir.

---

## 🔍 DNS Kaydını Test Etme

DNS kaydı eklendikten sonra:

```bash
# DNS kaydını kontrol edin
dig backoffice.save-all.com CNAME

# Farklı DNS sunucularından kontrol
dig @8.8.8.8 backoffice.save-all.com CNAME
dig @1.1.1.1 backoffice.save-all.com CNAME
```

---

## 🌐 Domain Mapping ve SSL Sertifikası

### ⚠️ SSL Hatası Çözümü

SSL hatası alıyorsanız, domain mapping oluşturulması gerekiyor. Domain mapping için önce domain verification yapılmalı.

### Adım 1: Domain Verification

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
   ```

2. **"Verify Domain"** butonuna tıklayın

3. **Domain adını girin:** `backoffice.save-all.com`

4. **DNS kayıtlarını kontrol edin:**
   - CNAME kaydı zaten eklenmiş olmalı
   - Google Cloud'un istediği ek bir TXT kaydı olabilir (Console'da gösterilir)

5. **Verification tamamlanana kadar bekleyin** (birkaç dakika sürebilir)

### Adım 2: Domain Mapping Oluştur

Domain verification tamamlandıktan sonra:

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud beta run domain-mappings create \
  --service=backoffice-admin \
  --domain=backoffice.save-all.com \
  --region=europe-west1
```

### Adım 3: SSL Sertifikası

Domain mapping oluşturulduktan sonra Google Cloud otomatik olarak SSL sertifikası oluşturur. Bu işlem 10-15 dakika sürebilir.

### ✅ Alternatif: Cloud Run URL'i Kullanın

Domain mapping yapmadan önce, Cloud Run'un kendi URL'i SSL sertifikası ile gelir:

```
https://backoffice-admin-w2qvlhkctq-ew.a.run.app
```

Bu URL'i kullanarak SSL hatası olmadan erişebilirsiniz.

---

## ✅ Test

DNS kaydı eklendikten 5-10 dakika sonra:

1. **Cloud Run URL ile test:**
   ```bash
   curl -I https://backoffice-admin-w2qvlhkctq-ew.a.run.app
   ```

2. **Custom domain ile test (DNS propagation sonrası):**
   ```bash
   curl -I https://backoffice.save-all.com
   ```

---

## 📞 Destek

Sorun yaşarsanız:
- DNS kayıtlarını kontrol edin
- DNS propagation için bekleyin
- Cloud Run servis loglarını kontrol edin: `gcloud run services logs read backoffice-admin --region=europe-west1`
