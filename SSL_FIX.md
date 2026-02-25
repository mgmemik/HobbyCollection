# 🔒 SSL Hatası Çözümü

## ❌ Sorun

`backoffice.save-all.com` adresine gittiğinizde SSL hatası alıyorsunuz.

## ✅ Çözüm

SSL hatası, domain mapping yapılmadığı için oluşuyor. Domain mapping için önce domain verification yapılmalı.

---

## 📋 Adım Adım Çözüm

### 1️⃣ Domain Verification (Google Cloud Console)

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
   ```

2. **"Verify Domain"** veya **"Add Domain"** butonuna tıklayın

3. **Domain adını girin:** `backoffice.save-all.com`

4. **DNS kayıtlarını kontrol edin:**
   - CNAME kaydı: `backoffice` → `backoffice-admin-w2qvlhkctq-ew.a.run.app` ✅ (zaten eklenmiş)
   - TXT kaydı: Google Cloud'un istediği verification kaydı (Console'da gösterilir)

5. **GoDaddy'de TXT kaydını ekleyin** (eğer istenirse)

6. **Verification tamamlanana kadar bekleyin** (5-10 dakika)

### 2️⃣ Domain Mapping Oluştur

Domain verification tamamlandıktan sonra terminal'de:

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud beta run domain-mappings create \
  --service=backoffice-admin \
  --domain=backoffice.save-all.com \
  --region=europe-west1
```

### 3️⃣ SSL Sertifikası Bekleyin

Domain mapping oluşturulduktan sonra Google Cloud otomatik olarak SSL sertifikası oluşturur. Bu işlem **10-15 dakika** sürebilir.

Durumu kontrol etmek için:

```bash
gcloud beta run domain-mappings list --region=europe-west1
```

---

## 🚀 Hızlı Çözüm (Geçici)

Domain mapping yapmadan önce, Cloud Run'un kendi URL'ini kullanabilirsiniz (SSL sertifikası ile gelir):

```
https://backoffice-admin-w2qvlhkctq-ew.a.run.app
```

Bu URL'i kullanarak SSL hatası olmadan erişebilirsiniz.

---

## 🔍 Durum Kontrolü

### Domain Mapping Durumu:

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud beta run domain-mappings list --region=europe-west1
```

### SSL Sertifikası Durumu:

```bash
curl -I https://backoffice.save-all.com
```

SSL sertifikası hazır olduğunda `200 OK` döner.

---

## ⚠️ Önemli Notlar

1. **Domain Verification:** `save-all.com` ana domain'i zaten verify edilmiş (`api.save-all.com` çalışıyor). Subdomain'ler için ayrı verification gerekebilir.

2. **DNS Propagation:** DNS kayıtları 5-10 dakika içinde aktif olur.

3. **SSL Sertifikası:** Google Cloud'un managed SSL'i otomatik oluşturulur, manuel işlem gerekmez.

---

## 📞 Sorun Giderme

### Domain Verification Başarısız Olursa:

1. DNS kayıtlarını kontrol edin:
   ```bash
   dig backoffice.save-all.com CNAME
   dig backoffice.save-all.com TXT
   ```

2. GoDaddy'de DNS kayıtlarının doğru olduğundan emin olun

3. Birkaç dakika bekleyin (DNS propagation)

### SSL Sertifikası Oluşmazsa:

1. Domain mapping'in başarılı olduğunu kontrol edin
2. 15-20 dakika bekleyin
3. Google Cloud Console → Cloud Run → Domain Mappings → SSL sertifikası durumunu kontrol edin
