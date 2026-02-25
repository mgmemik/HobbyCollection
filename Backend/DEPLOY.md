# 🚀 Google Cloud Run Deployment Guide

## api.save-all.com için Deployment Adımları

### 1. Ön Gereksinimler

```bash
# Google Cloud CLI kurulumu (eğer yoksa)
# macOS:
brew install google-cloud-sdk

# veya https://cloud.google.com/sdk/docs/install adresinden indirin

# Giriş yapın
gcloud auth login

# Projeyi seçin
gcloud config set project fresh-inscriber-472521-t7

# Gerekli API'leri etkinleştirin
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Secret Manager'da Gizli Bilgileri Saklayın

```bash
# JWT Key
echo -n "YOUR-SUPER-SECRET-JWT-KEY-32-CHARS-MIN" | gcloud secrets create jwt-key --data-file=-

# SMTP Username
echo -n "9490c6001@smtp-brevo.com" | gcloud secrets create smtp-username --data-file=-

# SMTP Password
echo -n "EOMNg1CtaJ9XGFkn" | gcloud secrets create smtp-password --data-file=-

# Google Search API Key
echo -n "AIzaSyCm-Kp5-NRa8wVgbdNcxHIHYiT8qSOvWpk" | gcloud secrets create google-search-api-key --data-file=-
```

### 3. Cloud Run Service Oluşturma ve Deploy

#### Yöntem 1: Cloud Build ile (Önerilen)

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend

# Cloud Build tetikle
gcloud builds submit --config HobbyCollection.Api/cloudbuild.yaml
```

#### Yöntem 2: Manuel Docker Build ve Deploy

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend

# Docker image build
docker build -t gcr.io/fresh-inscriber-472521-t7/hobbycollection-api:latest -f HobbyCollection.Api/Dockerfile .

# Google Container Registry'ye push
docker push gcr.io/fresh-inscriber-472521-t7/hobbycollection-api:latest

# Cloud Run'a deploy
gcloud run deploy hobbycollection-api \
  --image gcr.io/fresh-inscriber-472521-t7/hobbycollection-api:latest \
  --region europe-west3 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars ASPNETCORE_ENVIRONMENT=Production \
  --set-secrets /secrets/jwt-key=jwt-key:latest,/secrets/smtp-username=smtp-username:latest,/secrets/smtp-password=smtp-password:latest,/secrets/google-search-api-key=google-search-api-key:latest
```

### 4. Custom Domain Mapping (api.save-all.com)

#### Adım 1: Domain Mapping Oluştur

```bash
# Cloud Run service'e domain mapping ekle
gcloud run domain-mappings create \
  --service hobbycollection-api \
  --domain api.save-all.com \
  --region europe-west3
```

Bu komut size bir **verification record** verecek. Örnek:
```
Please create the following DNS record:
Type: TXT
Name: api.save-all.com
Value: google-site-verification=ABC123XYZ...
```

#### Adım 2: DNS Ayarları

**save-all.com domain'inizin DNS ayarlarına şunları ekleyin:**

1. **Verification Record (TXT)**
   ```
   Type: TXT
   Name: api
   Value: google-site-verification=ABC123XYZ... (Cloud Run'dan aldığınız değer)
   TTL: 3600
   ```

2. **CNAME Record**
   ```
   Type: CNAME
   Name: api
   Value: ghs.googlehosted.com
   TTL: 3600
   ```

**NOT:** Eğer root domain (save-all.com) için subdomain kullanıyorsanız:
- `api.save-all.com` için `api` subdomain'i kullanın
- CNAME kaydı `ghs.googlehosted.com` olmalı

#### Adım 3: DNS Verification Kontrolü

```bash
# Domain mapping durumunu kontrol et
gcloud run domain-mappings describe api.save-all.com --region europe-west3

# DNS propagation kontrolü (birkaç dakika sürebilir)
dig api.save-all.com TXT
dig api.save-all.com CNAME
```

### 5. Environment Variables ve Secrets

Cloud Run service'i oluşturduktan sonra, environment variables'ı güncelleyin:

```bash
gcloud run services update hobbycollection-api \
  --region europe-west3 \
  --update-env-vars ASPNETCORE_ENVIRONMENT=Production \
  --update-secrets /secrets/jwt-key=jwt-key:latest,/secrets/smtp-username=smtp-username:latest,/secrets/smtp-password=smtp-password:latest,/secrets/google-search-api-key=google-search-api-key:latest
```

### 6. Program.cs'de Secret Manager Entegrasyonu

`Program.cs` dosyasını güncelleyerek Secret Manager'dan değerleri okuyun:

```csharp
// Secret Manager'dan değerleri oku
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") ?? 
             await GetSecretAsync("jwt-key") ?? 
             builder.Configuration["Jwt:Key"];

// Helper method ekleyin
private static async Task<string?> GetSecretAsync(string secretName)
{
    try
    {
        var client = SecretManagerServiceClient.Create();
        var secret = await client.GetSecretVersionAsync(
            new SecretVersionName("fresh-inscriber-472521-t7", secretName, "latest"));
        return secret.Payload.Data.ToStringUtf8();
    }
    catch
    {
        return null;
    }
}
```

### 7. Database Migration

Cloud Run'da SQLite kullanıyorsanız, `/tmp` dizinini kullanın (geçici, her instance için ayrı).

**ÖNERİ:** Production için Cloud SQL (PostgreSQL veya MySQL) kullanın:

```bash
# Cloud SQL instance oluştur
gcloud sql instances create hobbycollection-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west3

# Database oluştur
gcloud sql databases create hobbycollection --instance=hobbycollection-db

# Kullanıcı oluştur
gcloud sql users create hobbycollection-user \
  --instance=hobbycollection-db \
  --password=YOUR_SECURE_PASSWORD
```

### 8. Test

```bash
# Service URL'ini al
gcloud run services describe hobbycollection-api --region europe-west3 --format 'value(status.url)'

# Test
curl https://api.save-all.com/api/health
```

### 9. Monitoring ve Logging

```bash
# Logları görüntüle
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api" --limit 50

# Metrics
gcloud monitoring dashboards create --config-from-file=monitoring-dashboard.json
```

### 10. CI/CD Pipeline (Opsiyonel)

GitHub Actions veya Cloud Build ile otomatik deploy:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v1
      - run: gcloud builds submit --config Backend/HobbyCollection.Api/cloudbuild.yaml
```

## 🔒 Güvenlik Notları

1. **JWT Key**: Mutlaka Secret Manager'da saklayın
2. **API Keys**: Google Search API key'i Secret Manager'da saklayın
3. **SMTP Credentials**: Secret Manager'da saklayın
4. **HTTPS**: Cloud Run otomatik HTTPS sağlar
5. **CORS**: Production'da sadece gerekli domain'leri allow edin

## 📊 Fiyatlandırma

- **Cloud Run**: İlk 2 milyon request ücretsiz, sonrası $0.40/milyon
- **Memory**: 2GB = ~$0.0000025/GB-saniye
- **CPU**: 2 vCPU = ~$0.00002400/vCPU-saniye
- **Network**: Egress ücretli (ilk 1GB ücretsiz)

## 🐛 Troubleshooting

```bash
# Service logları
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api" --limit 100

# Service durumu
gcloud run services describe hobbycollection-api --region europe-west3

# Domain mapping durumu
gcloud run domain-mappings describe api.save-all.com --region europe-west3
```

## 📝 Checklist

- [ ] Google Cloud CLI kuruldu
- [ ] Gerekli API'ler etkinleştirildi
- [ ] Secret Manager'da gizli bilgiler saklandı
- [ ] Docker image build edildi ve push edildi
- [ ] Cloud Run service deploy edildi
- [ ] Domain mapping oluşturuldu
- [ ] DNS kayıtları eklendi (TXT + CNAME)
- [ ] DNS verification tamamlandı
- [ ] HTTPS çalışıyor
- [ ] API test edildi

