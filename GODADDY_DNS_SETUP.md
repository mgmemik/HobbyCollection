# GoDaddy DNS Ayarları - backoffice.save-all.com

## 📋 Adım Adım DNS Kurulumu

### 1. İlk Deploy'dan Sonra Cloud Run URL'ini Alın

```bash
gcloud run services describe backoffice-admin \
  --region=europe-west1 \
  --format='value(status.url)'
```

Çıktı şuna benzer olacak:
```
https://backoffice-admin-xxxxx-ew.a.run.app
```

### 2. GoDaddy'de DNS Kayıtları

1. **GoDaddy hesabınıza giriş yapın**
   - https://www.godaddy.com

2. **Domain Manager'a gidin**
   - "My Products" → "Domains" → `save-all.com`

3. **DNS Management'e gidin**
   - "DNS" sekmesine tıklayın

4. **CNAME kaydı ekleyin**
   ```
   Type: CNAME
   Name: backoffice
   Value: [Cloud Run URL'den alınan domain - örn: backoffice-admin-xxxxx-ew.a.run.app]
   TTL: 600 (10 dakika)
   ```

   **ÖNEMLİ:** 
   - Value'da sadece domain kısmını kullanın (https:// olmadan)
   - Örnek: `backoffice-admin-xxxxx-ew.a.run.app`

### 3. Domain Mapping (Google Cloud)

```bash
gcloud run domain-mappings create \
  --service=backoffice-admin \
  --domain=backoffice.save-all.com \
  --region=europe-west1
```

### 4. DNS Verification

Domain mapping oluşturduktan sonra Google Cloud size bir verification kaydı verebilir. Bu durumda:

1. GoDaddy'de **TXT Record** ekleyin:
   ```
   Type: TXT
   Name: backoffice
   Value: [Google Cloud'dan verilen verification değeri]
   ```

2. Verification tamamlandıktan sonra (birkaç dakika) SSL sertifikası otomatik olarak aktif olacak.

### 5. Test

DNS propagation için 5-10 dakika bekleyin, sonra:

```bash
# DNS kaydını kontrol edin
dig backoffice.save-all.com CNAME

# Web sitesini test edin
curl https://backoffice.save-all.com
```

## ⚠️ Önemli Notlar

1. **DNS Propagation:** Değişiklikler 5-10 dakika içinde aktif olabilir, bazen 24 saate kadar sürebilir.

2. **SSL Sertifikası:** Cloud Run otomatik olarak SSL sertifikası sağlar. Domain mapping yaptıktan sonra birkaç dakika içinde aktif olur.

3. **Cloudflare Kullanıyorsanız:** CNAME kaydı için Proxy **KAPALI** olmalı (DNS only mode).

4. **TTL Değeri:** 600 (10 dakika) önerilir. Daha düşük değerler DNS sorgularını artırabilir.

## 🔍 Troubleshooting

### DNS Kaydı Görünmüyor

```bash
# DNS kaydını kontrol edin
dig backoffice.save-all.com CNAME

# Farklı DNS sunucularından kontrol edin
dig @8.8.8.8 backoffice.save-all.com CNAME
dig @1.1.1.1 backoffice.save-all.com CNAME
```

### SSL Sertifikası Aktif Değil

```bash
# Domain mapping durumunu kontrol edin
gcloud run domain-mappings describe backoffice.save-all.com \
  --region=europe-west1

# SSL sertifikası durumunu kontrol edin
gcloud run domain-mappings describe backoffice.save-all.com \
  --region=europe-west1 \
  --format='value(status.conditions)'
```

### 404 Not Found

- Cloud Run servisinin çalıştığından emin olun
- Environment variables'ın doğru set edildiğini kontrol edin
- Logları kontrol edin: `gcloud run services logs read backoffice-admin --region=europe-west1`
