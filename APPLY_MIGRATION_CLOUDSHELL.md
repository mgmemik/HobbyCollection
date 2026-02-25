# 🔧 Migration Uygulama - Cloud Shell

## ⚠️ Sorun

`IsAdmin` kolonu veritabanında yok. Migration henüz uygulanmamış.

## ✅ Çözüm: Migration Uygulama

### Yöntem 1: SQL ile Manuel Migration (Hızlı)

Cloud Shell'de şu SQL komutunu çalıştırın:

```sql
-- IsAdmin kolonunu ekle
ALTER TABLE "AspNetUsers" ADD COLUMN IF NOT EXISTS "IsAdmin" boolean NOT NULL DEFAULT false;

-- Migration kaydını ekle (EF Core için)
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('AddIsAdminToUser', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
```

### Yöntem 2: Backend'i Yeniden Deploy Et (Otomatik Migration)

Backend'de `Program.cs` içinde otomatik migration var. Backend'i yeniden deploy ederseniz migration otomatik uygulanır.

---

## 📋 Cloud Shell'de Yapılacaklar

1. **Cloud SQL'e bağlanın:**
```bash
gcloud sql connect hobbycollection-db --user=postgres --database=hobbycollection
```

2. **Şifre girin:** (yukarıda aldığınız şifre)

3. **SQL komutunu çalıştırın:**
```sql
ALTER TABLE "AspNetUsers" ADD COLUMN IF NOT EXISTS "IsAdmin" boolean NOT NULL DEFAULT false;
```

4. **Migration kaydını ekleyin (opsiyonel):**
```sql
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('AddIsAdminToUser', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
```

5. **Kontrol edin:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'AspNetUsers' 
AND column_name = 'IsAdmin';
```

6. **Admin kullanıcıyı güncelleyin:**
```sql
UPDATE "AspNetUsers" SET "IsAdmin" = true WHERE "Email" = 'gmemik@gmail.com';
SELECT "Email", "IsAdmin" FROM "AspNetUsers" WHERE "Email" = 'gmemik@gmail.com';
```

7. **Çıkış:** `\q`
