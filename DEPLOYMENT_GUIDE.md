# Admin Panel Deployment Guide

## 📋 Genel Bakış

Admin paneli `backoffice.save-all.com` subdomain'i üzerinden yayınlanacak. Google Cloud'da hosting yapılacak.

## 🔧 Adım 1: DNS Ayarları (GoDaddy)

### GoDaddy'de DNS Kayıtları Ekleme

1. GoDaddy hesabınıza giriş yapın
2. Domain Manager'a gidin
3. `save-all.com` domain'ini seçin
4. DNS Management'e gidin
5. Aşağıdaki kayıtları ekleyin:

**A Record (IPv4):**
```
Type: A
Name: backoffice
Value: [Google Cloud IP adresi - Cloud Run veya App Engine IP]
TTL: 600 (veya otomatik)
```

**CNAME Record (Alternatif - Cloud Run için):**
```
Type: CNAME
Name: backoffice
Value: [Cloud Run service URL - örn: backoffice-service-xxxxx.run.app]
TTL: 600
```

**Not:** Google Cloud Run kullanıyorsanız CNAME kullanın, App Engine kullanıyorsanız A record kullanın.

## 🔧 Adım 2: Google Cloud Projesi Hazırlığı

### 2.1 Google Cloud Console'da İşlemler

1. Google Cloud Console'a gidin: https://console.cloud.google.com
2. Mevcut projenizi seçin (API projesi ile aynı proje)
3. Cloud Run veya App Engine servisini hazırlayın

### 2.2 Gerekli Servisler

- **Cloud Run** (Önerilen) veya **App Engine**
- **Cloud Build** (deploy için)
- **Container Registry** veya **Artifact Registry**

## 🔧 Adım 3: Admin Panel Build ve Deploy

### 3.1 Environment Variables

`.env.production` dosyası oluşturun:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.save-all.com
```

### 3.2 Build Script

Next.js projesini production build için hazırlayın.

### 3.3 Deploy Seçenekleri

**Seçenek 1: Cloud Run (Önerilen)**
- Docker container olarak deploy
- Otomatik scaling
- HTTPS otomatik

**Seçenek 2: App Engine**
- Next.js için özel runtime
- Daha basit deploy

## 📝 Deployment Checklist

- [ ] GoDaddy DNS kayıtları eklendi
- [ ] Google Cloud projesi hazır
- [ ] Environment variables ayarlandı
- [ ] Build script hazır
- [ ] Dockerfile oluşturuldu (Cloud Run için)
- [ ] Deploy script hazır
- [ ] SSL sertifikası aktif (otomatik Cloud Run'da)
- [ ] Domain mapping yapıldı
- [ ] Test edildi

## 🚀 Hızlı Başlangıç

Detaylı adımlar için aşağıdaki bölümlere bakın.

