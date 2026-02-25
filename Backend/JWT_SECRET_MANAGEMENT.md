# 🔐 JWT Secret Yönetimi

## ⚠️ ÖNEMLİ UYARI

**JWT Key Secret'ı ASLA güncellemeyin!**

Eğer JWT Key Secret'ını güncellerseniz:
- ❌ Tüm mevcut token'lar geçersiz olur
- ❌ Tüm kullanıcılar yeniden login yapmak zorunda kalır
- ❌ Mobile app'teki tüm oturumlar sonlanır
- ❌ Kullanıcı deneyimi ciddi şekilde bozulur

## 📋 Mevcut Durum

JWT Key Secret şu anda Google Cloud Secret Manager'da saklanıyor:
- **Secret Name:** `jwt-key`
- **Project:** `fresh-inscriber-472521-t7`
- **Location:** Google Cloud Secret Manager
- **Versiyon:** `latest` (sadece 1 versiyon var)

## ✅ Secret Kontrolü

Secret'ın mevcut olduğundan ve sabit olduğundan emin olmak için:

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend
./scripts/ensure-jwt-secret.sh
```

Bu script:
- Secret'ın var olup olmadığını kontrol eder
- Eğer yoksa, güvenli bir key oluşturur
- Mevcut versiyonları gösterir
- Secret'ın sabit olduğunu doğrular

## 🛡️ Secret Koruması

Secret'ın durumunu kontrol etmek için:

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend
./scripts/protect-jwt-secret.sh
```

## 🔧 Cloud Build Entegrasyonu

`cloudbuild.yaml` dosyasında JWT Key şu şekilde kullanılıyor:

```yaml
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/jwt-key/versions/latest
      env: 'JWT_KEY'
```

Bu yapılandırma:
- ✅ Secret Manager'dan `latest` versiyonunu alır
- ✅ Environment variable olarak `JWT_KEY`'e atar
- ✅ Cloud Run deployment'ında kullanılır

## 🚨 Ne Zaman Güncelleme Yapılmalı?

JWT Key Secret'ını **SADECE** şu durumlarda güncelleyin:

1. **Güvenlik İhlali:** Key'in sızdırıldığından kesinlikle eminseniz
2. **Zorunlu Rotasyon:** Güvenlik politikası gereği periyodik rotasyon yapılması gerekiyorsa

### Güncelleme Adımları (SADECE GEREKLİYSE)

```bash
# 1. Yeni key oluştur
NEW_JWT_KEY=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)

# 2. Yeni versiyon ekle (DİKKAT: Bu tüm token'ları geçersiz kılar!)
echo -n "$NEW_JWT_KEY" | gcloud secrets versions add jwt-key --data-file=-

# 3. Tüm kullanıcıları bilgilendir (yeniden login yapmaları gerekecek)
```

## 📊 Secret Versiyonları

Mevcut versiyonları görmek için:

```bash
gcloud secrets versions list jwt-key
```

Belirli bir versiyonu görmek için:

```bash
gcloud secrets versions access <VERSION_NUMBER> --secret=jwt-key
```

## 🔍 Sorun Giderme

### Token'lar Geçersiz Oluyor

1. **Secret'ın güncellenip güncellenmediğini kontrol edin:**
   ```bash
   gcloud secrets versions list jwt-key
   ```
   Eğer birden fazla versiyon varsa, son versiyon tarihini kontrol edin.

2. **Cloud Run environment variable'ını kontrol edin:**
   ```bash
   gcloud run services describe hobbycollection-api \
     --region europe-west1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

3. **Backend loglarını kontrol edin:**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api" \
     --limit 50 \
     --format json | grep -i "jwt\|token\|auth"
   ```

### Secret Bulunamıyor

Eğer secret bulunamıyorsa:

```bash
# Secret'ı oluştur
cd /Users/gokhanmemik/Desktop/HobbyCollection/Backend
./scripts/ensure-jwt-secret.sh
```

## 📝 Best Practices

1. ✅ **Secret'ı ASLA güncellemeyin** (güvenlik ihlali yoksa)
2. ✅ **Secret'ı düzenli olarak kontrol edin** (yeni versiyon oluşturulmamış olmalı)
3. ✅ **Secret'ı git'e eklemeyin** (zaten Secret Manager'da)
4. ✅ **Secret erişim loglarını izleyin** (Cloud Audit Logs)
5. ✅ **Secret'ı yedekleyin** (güvenli bir yerde, şifrelenmiş)

## 🔗 İlgili Dosyalar

- `Backend/HobbyCollection.Api/cloudbuild.yaml` - Cloud Build yapılandırması
- `Backend/scripts/ensure-jwt-secret.sh` - Secret kontrol script'i
- `Backend/scripts/protect-jwt-secret.sh` - Secret koruma script'i
- `Backend/HobbyCollection.Api/Program.cs` - JWT yapılandırması

