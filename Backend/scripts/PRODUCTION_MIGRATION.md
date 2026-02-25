# Production Migration - Kapalı Hesap Sistemi

## 🎯 Amaç
`IsPrivateAccount` ve `Status` kolonlarını production veritabanına güvenle eklemek.

## ✅ Dev Ortamında Başarıyla Uygulandı

Migration dev ortamında test edildi ve başarıyla çalıştı:
- ✅ `AspNetUsers.IsPrivateAccount` kolonu eklendi (boolean, default: false)
- ✅ `Follows.Status` kolonu eklendi (integer, default: 1 = Accepted)
- ✅ Veri kaybı olmadı
- ✅ Mevcut takipler "Accepted" olarak işaretlendi

## 🚀 Production'a Uygulama

### Yöntem 1: Cloud SQL Console (En Güvenli - Önerilen)

1. Google Cloud Console'da Cloud SQL'e git
2. `hobbycollection-db` instance'ına tıkla
3. "Cloud SQL Studio" veya "Query Editor"ı aç
4. Aşağıdaki SQL'i çalıştır:

```sql
-- Önce kontrol et (mevcut değerleri gör)
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_name IN ('AspNetUsers', 'Follows');

-- Migration'ı uygula
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'AspNetUsers' AND column_name = 'IsPrivateAccount'
    ) THEN
        ALTER TABLE "AspNetUsers" 
        ADD COLUMN "IsPrivateAccount" boolean NOT NULL DEFAULT false;
        RAISE NOTICE 'IsPrivateAccount kolonu eklendi';
    ELSE
        RAISE NOTICE 'IsPrivateAccount kolonu zaten mevcut';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Follows' AND column_name = 'Status'
    ) THEN
        ALTER TABLE "Follows" 
        ADD COLUMN "Status" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Status kolonu eklendi';
    ELSE
        RAISE NOTICE 'Status kolonu zaten mevcut';
    END IF;
END $$;

-- Migration history'ye ekle
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250122000000_AddPrivateAccountAndFollowStatus', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

-- Kontrol et
SELECT 'Migration başarıyla uygulandı!' AS result;
```

### Yöntem 2: Cloud SQL Proxy ile (Lokal Terminal)

```bash
# 1. Cloud SQL Proxy'yi başlat (başka bir terminal'de)
cloud_sql_proxy -instances=fresh-inscriber-472521-t7:europe-west1:hobbycollection-db=tcp:5432

# 2. Migration'ı uygula (bu terminal'de)
export PGPASSWORD="your-production-password"
psql -h 127.0.0.1 -U postgres -d hobbycollection -f Backend/scripts/apply-private-account-migration.sql
```

### Yöntem 3: Backend Restart (Otomatik)

Production backend'i yeniden başlat. `Program.cs` içindeki `MigrateAsync()` otomatik olarak migration'ı uygulayacak.

```bash
# Cloud Run'da yeni bir deployment
gcloud run deploy hobbycollection-api \
  --source . \
  --region europe-west1
```

## 🔍 Doğrulama

Migration'ın başarıyla uygulandığını kontrol et:

```sql
-- Kolonları kontrol et
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'AspNetUsers' AND column_name = 'IsPrivateAccount';

SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'Follows' AND column_name = 'Status';

-- Migration kaydını kontrol et
SELECT * FROM "__EFMigrationsHistory" 
WHERE "MigrationId" = '20250122000000_AddPrivateAccountAndFollowStatus';

-- Mevcut takiplerin durumunu kontrol et (hepsi 1 = Accepted olmalı)
SELECT "Status", COUNT(*) FROM "Follows" GROUP BY "Status";
```

## ⚠️ Geri Alma (Acil Durum)

Eğer bir sorun olursa, migration'ı geri al:

```sql
-- Kolonları sil
ALTER TABLE "AspNetUsers" DROP COLUMN IF EXISTS "IsPrivateAccount";
ALTER TABLE "Follows" DROP COLUMN IF EXISTS "Status";

-- Migration kaydını sil
DELETE FROM "__EFMigrationsHistory" 
WHERE "MigrationId" = '20250122000000_AddPrivateAccountAndFollowStatus';
```

## 📊 Güvenlik Notları

1. ✅ **İdempotent**: Birden fazla kez çalıştırılabilir, sorun olmaz
2. ✅ **Veri Güvenli**: Mevcut veriler korunur, DEFAULT değerler kullanılır
3. ✅ **Zero Downtime**: Kolonlar ekleme işlemi anlık, downtime yok
4. ✅ **Backward Compatible**: Eski kod çalışmaya devam eder (yeni kolonlar optional)
5. ✅ **Rollback Ready**: Geri alma script'i hazır

## 🎉 Beklenen Sonuçlar

Migration başarılı olduktan sonra:

- ✅ Tüm mevcut kullanıcılar `IsPrivateAccount = false` (açık hesap)
- ✅ Tüm mevcut takipler `Status = 1` (Accepted)
- ✅ Yeni takip sistemi çalışmaya başlar
- ✅ Kullanıcılar hesaplarını kapalı yapabilir
- ✅ Kapalı hesaplara takip talebi gönderilebilir

