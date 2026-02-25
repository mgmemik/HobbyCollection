# ⚡ Hızlı Başlangıç - api.save-all.com

## 🎯 5 Dakikada Deploy

### 1. Google Cloud CLI Kurulumu

```bash
# macOS
brew install google-cloud-sdk

# veya
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### 2. Giriş ve Proje Ayarları

```bash
# Giriş yap
gcloud auth login

# Projeyi seç
gcloud config set project fresh-inscriber-472521-t7

# Region ayarla
gcloud config set run/region europe-west3
```

### 3. Deploy

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend

# Otomatik deploy script'i çalıştır
./deploy.sh

# VEYA manuel deploy
gcloud builds submit --config HobbyCollection.Api/cloudbuild.yaml
```

### 4. DNS Ayarları

Deploy tamamlandıktan sonra, domain sağlayıcınızda:

**TXT Record:**
```
Type: TXT
Name: api
Value: google-site-verification=... (Cloud Run'dan alınan)
```

**CNAME Record:**
```
Type: CNAME
Name: api
Value: ghs.googlehosted.com
```

### 5. Test

```bash
# Service URL'i al
gcloud run services describe hobbycollection-api --region europe-west3 --format 'value(status.url)'

# Test et
curl https://api.save-all.com/api/health
```

## 📚 Detaylı Dokümantasyon

- **Deployment:** `Backend/DEPLOY.md`
- **DNS Ayarları:** `Backend/HobbyCollection.Api/DNS_SETUP.md`

## 🔑 Secret Manager (Önemli!)

Production'da gizli bilgileri Secret Manager'da saklayın:

```bash
# JWT Key
echo -n "YOUR-JWT-KEY" | gcloud secrets create jwt-key --data-file=-

# SMTP Password
echo -n "YOUR-SMTP-PASSWORD" | gcloud secrets create smtp-password --data-file=-

# Google Search API Key
echo -n "YOUR-API-KEY" | gcloud secrets create google-search-api-key --data-file=-
```

## ⚠️ Önemli Notlar

1. **Cloudflare kullanıyorsanız:** CNAME kaydı için Proxy **KAPALI** olmalı (DNS only)
2. **DNS Propagation:** 5-10 dakika sürebilir
3. **SSL:** Cloud Run otomatik SSL sertifikası sağlar
4. **Database:** SQLite `/tmp` dizininde (geçici). Production için Cloud SQL önerilir.

## 🆘 Sorun Giderme

```bash
# Logları görüntüle
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api" --limit 50

# Service durumu
gcloud run services describe hobbycollection-api --region europe-west3

# Domain mapping durumu
gcloud run domain-mappings describe api.save-all.com --region europe-west3
```

