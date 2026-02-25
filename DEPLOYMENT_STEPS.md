# 🚀 Admin Panel Deployment Adımları

## 📋 Genel Bakış

Admin paneli `backoffice.save-all.com` subdomain'i üzerinden yayınlanacak. Google Cloud Run kullanılacak.

---

## 🔧 Adım 1: DNS Ayarları (GoDaddy)

### 1.1 GoDaddy'de DNS Kayıtları

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
   Value: [Cloud Run service URL - deploy sonrası alınacak]
   TTL: 600 (10 dakika)
   ```

   **Not:** İlk deploy'dan sonra Cloud Run URL'ini alıp buraya ekleyeceğiz.

---

## 🔧 Adım 2: Google Cloud Hazırlığı

### 2.1 Gerekli Servisler

Aşağıdaki servislerin aktif olduğundan emin olun:

- ✅ Cloud Run API
- ✅ Cloud Build API
- ✅ Container Registry API

**Kontrol ve Aktifleştirme:**
```bash
# Proje ID'nizi set edin
export GOOGLE_CLOUD_PROJECT=your-project-id

# Servisleri kontrol et ve aktifleştir
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2.2 Authentication

```bash
# Google Cloud'a giriş yapın
gcloud auth login

# Proje set edin
gcloud config set project YOUR_PROJECT_ID
```

---

## 🔧 Adım 3: Admin Panel Deploy

### 3.1 Environment Variables

```bash
cd web-admin

# .env.production dosyası oluşturun
cat > .env.production << EOF
NEXT_PUBLIC_API_BASE_URL=https://api.save-all.com
EOF
```

### 3.2 Deploy Script'i Çalıştırın

```bash
# Deploy script'ini çalıştırın
./deploy.sh production
```

**Script otomatik olarak:**
- ✅ Docker image build eder
- ✅ Container Registry'ye push eder
- ✅ Cloud Run'a deploy eder
- ✅ Environment variables set eder

### 3.3 Manuel Deploy (Alternatif)

```bash
# Build ve deploy
gcloud builds submit --config=cloudbuild.yaml .
```

---

## 🔧 Adım 4: Domain Mapping

### 4.1 Cloud Run URL'ini Alın

```bash
gcloud run services describe backoffice-admin \
  --region=us-central1 \
  --format='value(status.url)'
```

Çıktı şuna benzer olacak:
```
https://backoffice-admin-xxxxx-uc.a.run.app
```

### 4.2 Domain Mapping Oluşturun

```bash
gcloud run domain-mappings create \
  --service=backoffice-admin \
  --domain=backoffice.save-all.com \
  --region=us-central1
```

### 4.3 DNS Kayıtlarını Güncelleyin

**GoDaddy'de:**

1. DNS Management'e gidin
2. `backoffice` CNAME kaydını bulun
3. Value'yu Cloud Run URL'ine güncelleyin:
   ```
   Type: CNAME
   Name: backoffice
   Value: backoffice-admin-xxxxx-uc.a.run.app
   TTL: 600
   ```

**VEYA** (Domain mapping kullanıyorsanız):

Google Cloud Console'dan domain mapping'in verdiği CNAME kaydını ekleyin.

---

## 🔧 Adım 5: SSL Sertifikası

Cloud Run otomatik olarak SSL sertifikası sağlar. Domain mapping yaptıktan sonra birkaç dakika içinde aktif olur.

**Kontrol:**
```bash
# Domain mapping durumunu kontrol edin
gcloud run domain-mappings describe backoffice.save-all.com \
  --region=us-central1
```

---

## 🔧 Adım 6: Test

### 6.1 Cloud Run URL'den Test

```bash
# Cloud Run URL'ini açın
open https://backoffice-admin-xxxxx-uc.a.run.app
```

### 6.2 Custom Domain'den Test

```bash
# Custom domain'i açın (DNS propagation için birkaç dakika bekleyin)
open https://backoffice.save-all.com
```

---

## 📋 Deployment Checklist

- [ ] GoDaddy DNS kayıtları eklendi
- [ ] Google Cloud projesi hazır
- [ ] Gerekli API'ler aktif
- [ ] Environment variables ayarlandı (.env.production)
- [ ] Deploy script çalıştırıldı
- [ ] Cloud Run servisi oluşturuldu
- [ ] Domain mapping yapıldı
- [ ] DNS kayıtları güncellendi
- [ ] SSL sertifikası aktif
- [ ] Test edildi (Cloud Run URL)
- [ ] Test edildi (Custom domain)

---

## 🔄 Güncelleme Deploy

Kod değişikliklerinden sonra tekrar deploy:

```bash
cd web-admin
./deploy.sh production
```

---

## 🐛 Troubleshooting

### DNS Propagation Sorunu

DNS değişiklikleri 24-48 saat sürebilir. Hızlı kontrol:

```bash
# DNS kaydını kontrol edin
dig backoffice.save-all.com CNAME
```

### Domain Mapping Hatası

```bash
# Domain mapping durumunu kontrol edin
gcloud run domain-mappings list --region=us-central1

# Detaylı bilgi
gcloud run domain-mappings describe backoffice.save-all.com \
  --region=us-central1
```

### Build Hatası

```bash
# Build loglarını kontrol edin
gcloud builds list --limit=5

# Son build'in loglarını görüntüleyin
gcloud builds log [BUILD_ID]
```

### Environment Variables Sorunu

```bash
# Cloud Run servisinin environment variables'ını kontrol edin
gcloud run services describe backoffice-admin \
  --region=us-central1 \
  --format='value(spec.template.spec.containers[0].env)'
```

---

## 📞 Destek

Sorun yaşarsanız:
1. Build loglarını kontrol edin
2. Cloud Run servis loglarını kontrol edin
3. DNS kayıtlarını doğrulayın

