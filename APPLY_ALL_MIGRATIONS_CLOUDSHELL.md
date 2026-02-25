# 🔧 Tüm Migration'ları Uygulama - Cloud Shell

## ✅ Yöntem 1: Backend'i Yeniden Deploy Et (Önerilen)

Backend'de `Program.cs` içinde otomatik migration var. Backend'i yeniden deploy ederseniz tüm migration'lar otomatik uygulanır.

### Adımlar:

1. **Backend klasörüne gidin:**
```bash
cd Backend
```

2. **Cloud Build ile deploy edin:**
```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud builds submit --config HobbyCollection.Api/cloudbuild.yaml .
```

Backend deploy edildiğinde otomatik olarak tüm migration'lar uygulanacak.

---

## ✅ Yöntem 2: Cloud Shell'de dotnet ef database update

Cloud Shell'de .NET SDK yüklüyse migration'ları manuel uygulayabilirsiniz.

### Adımlar:

1. **Backend kodunu Cloud Shell'e yükleyin** (git clone veya upload)

2. **Migration'ları uygulayın:**
```bash
cd Backend/HobbyCollection.Api
export ASPNETCORE_ENVIRONMENT=Production
export CloudSql__DatabaseName=hobbycollection
export CloudSql__UserId=postgres
export CloudSql__Password=$(gcloud secrets versions access latest --secret="database-password")
dotnet ef database update --project ../HobbyCollection.Infrastructure
```

---

## ✅ Yöntem 3: SQL ile Manuel Migration (Hızlı - Sadece IsAdmin için)

Sadece IsAdmin kolonunu eklemek için:

```sql
ALTER TABLE "AspNetUsers" ADD COLUMN IF NOT EXISTS "IsAdmin" boolean NOT NULL DEFAULT false;
```

---

## 🔍 Migration Durumunu Kontrol Etme

Cloud Shell'de (psql içinde):

```sql
-- Uygulanan migration'ları görüntüle
SELECT "MigrationId", "ProductVersion" 
FROM "__EFMigrationsHistory" 
ORDER BY "MigrationId";

-- IsAdmin kolonunu kontrol et
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'AspNetUsers' 
AND column_name = 'IsAdmin';
```
