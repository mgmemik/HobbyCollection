# 🚀 Migration Guide - Otomatik Deployment Sistemi

## 📋 Genel Bakış

Bu proje **otomatik migration deployment** sistemi kullanır. Backend uygulaması başlatıldığında, migration'lar otomatik olarak kontrol edilir ve uygulanır.

## ✨ Özellikler

- ✅ **Idempotent**: Migration'lar güvenli bir şekilde birden fazla kez çalıştırılabilir
- ✅ **Otomatik**: Uygulama başlatıldığında otomatik çalışır
- ✅ **Çapraz Ortam**: Dev, staging ve production'da aynı şekilde çalışır
- ✅ **Güvenli**: Hata durumunda uygulama başlatılmaz
- ✅ **Zero-Downtime**: Migration sırasında uygulama çalışır durumda kalabilir

## 🏗️ Mimari

### 1. Migration Service Pattern
Her migration için bir service metodu yazılır:
```csharp
// HobbyCollection.Api/Services/MigrationService.cs
public static async Task ApplyYourMigrationAsync(AppDbContext db, ILogger logger)
{
    // Idempotent SQL komutları
}
```

### 2. Program.cs Integration
Migration servisler `Program.cs`'de otomatik çağrılır:
```csharp
try
{
    app.Logger.LogInformation("🔧 Migration başlatılıyor...");
    await MigrationService.ApplyYourMigrationAsync(db, app.Logger);
    app.Logger.LogInformation("✅ Migration tamamlandı!");
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "❌ Migration FAILED!");
}
```

## 📝 Yeni Migration Ekleme Rehberi

### Adım 1: Migration Service Metodunu Oluştur

`MigrationService.cs` dosyasına yeni bir metod ekle:

```csharp
public static async Task ApplyYourNewFeatureAsync(AppDbContext db, ILogger logger)
{
    try
    {
        logger.LogInformation("🔧 YourNewFeature migration başlatılıyor...");

        // İdempotent SQL - IF NOT EXISTS kullan
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'YourTable' AND column_name = 'NewColumn'
                ) THEN
                    ALTER TABLE ""YourTable"" 
                    ADD COLUMN ""NewColumn"" TEXT NULL;
                END IF;
            END $$;
        ");

        logger.LogInformation("✅ YourNewFeature migration tamamlandı!");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ YourNewFeature migration hatası!");
        throw;
    }
}
```

### Adım 2: Program.cs'ye Ekle

Migration zincirine ekle:

```csharp
// Badge System Migration
try
{
    await MigrationService.ApplyBadgeMigrationAsync(db, app.Logger);
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "❌ Badge migration FAILED!");
}

// ⬇️ YENİ MIGRATION BURAYA
try
{
    app.Logger.LogInformation("🔧 YourNewFeature migration başlatılıyor...");
    await MigrationService.ApplyYourNewFeatureAsync(db, app.Logger);
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "❌ YourNewFeature migration FAILED!");
}
```

### Adım 3: Test Et

```bash
# Development'ta test et
cd Backend/HobbyCollection.Api
dotnet run

# Log'larda kontrol et:
# ✅ Badge sistemi hazır!
# ✅ YourNewFeature migration tamamlandı!
```

## 🎯 İdempotent SQL Örnekleri

### Tablo Oluşturma
```sql
CREATE TABLE IF NOT EXISTS "YourTable" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Name" TEXT NOT NULL
);
```

### Kolon Ekleme
```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'YourTable' AND column_name = 'NewColumn'
    ) THEN
        ALTER TABLE "YourTable" ADD COLUMN "NewColumn" TEXT NULL;
    END IF;
END $$;
```

### Index Oluşturma
```sql
CREATE INDEX IF NOT EXISTS "IX_YourTable_Column" ON "YourTable" ("Column");

-- Unique index için
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'IX_YourTable_Unique'
    ) THEN
        CREATE UNIQUE INDEX "IX_YourTable_Unique" 
        ON "YourTable" ("Column");
    END IF;
END $$;
```

### Veri Ekleme
```sql
INSERT INTO "YourTable" ("Id", "Name")
VALUES (gen_random_uuid(), 'DefaultValue')
ON CONFLICT DO NOTHING;
```

## 🚀 Deployment Workflow

### Development
```bash
# 1. Kod değişikliklerini yap
# 2. Migration service ekle/güncelle
# 3. Backend'i başlat
dotnet run

# Migration otomatik çalışır! ✨
```

### Production (Google Cloud Run)
```bash
# 1. Kodu push et
git push origin main

# 2. Cloud Run deployment
gcloud run deploy hobbycollection-api --source .

# 3. İlk container başlatıldığında migration otomatik çalışır! ✨
```

## 📊 Migration Sırası

Migration'lar şu sırayla çalışır:

1. **EF Core Migrations** (`db.Database.MigrateAsync()`)
2. **AI Credits System** (`EnsureAICreditTablesAsync`)
3. **Badge System** (`ApplyBadgeMigrationAsync`)
4. **[Yeni Migration'larınız buraya]**

## ⚠️ Önemli Notlar

### DO ✅
- ✅ Her zaman idempotent SQL yaz (IF NOT EXISTS kullan)
- ✅ Migration'ları küçük parçalara böl
- ✅ Try-catch kullan ve log'la
- ✅ Test ortamında önce test et
- ✅ Rollback planı hazırla (Down metodu)

### DON'T ❌
- ❌ Doğrudan ALTER TABLE yapma (IF NOT EXISTS kontrolü olmadan)
- ❌ Büyük veri migration'larını tek seferde yapma
- ❌ Production'da denenmemiş migration çalıştırma
- ❌ Migration sırasını değiştirme (dependencies bozulabilir)

## 🔄 Rollback

Migration'ı geri almak için:

1. `MigrationService.cs`'de Down metodunu ekle:
```csharp
public static async Task RollbackBadgeMigrationAsync(AppDbContext db, ILogger logger)
{
    await db.Database.ExecuteSqlRawAsync(@"
        DROP TABLE IF EXISTS ""ProductBadges"";
        ALTER TABLE ""Products"" DROP COLUMN IF EXISTS ""IsRare"";
        -- ... diğer kolonlar
    ");
}
```

2. Gerekirse Program.cs'de çağır (geliştirme sırasında)

## 📈 Monitoring

Migration durumunu kontrol et:

```bash
# Backend log'larına bak
docker logs container_name | grep "migration"

# Veya Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND severity>=INFO" --limit 50
```

## 🎉 Örnek Migration: Badge System

Badge System migration'ı referans olarak inceleyebilirsin:
- Dosya: `HobbyCollection.Api/Services/MigrationService.cs`
- Metod: `ApplyBadgeMigrationAsync`

Bu migration şunları yapar:
1. ✅ Products tablosuna 8 yeni kolon ekler
2. ✅ ProductBadges tablosunu oluşturur
3. ✅ Index'leri oluşturur
4. ✅ Mevcut ürünlere otomatik badge'ler atar
5. ✅ Birden fazla kez güvenle çalıştırılabilir

## 🆘 Sorun Giderme

### Migration çalışmıyor
```bash
# Log'ları kontrol et
dotnet run --verbose

# Veritabanı bağlantısını test et
psql -h localhost -U user -d dbname -c "\dt"
```

### Migration yarım kaldı
```sql
-- Manuel olarak durumu kontrol et
SELECT * FROM information_schema.columns 
WHERE table_name = 'Products';

-- Gerekirse manuel düzelt
ALTER TABLE "Products" ADD COLUMN "IsRare" boolean DEFAULT false;
```

### Production'da hata
```bash
# Cloud Run revision'ı geri al
gcloud run services update-traffic hobbycollection-api --to-revisions=PREVIOUS_REVISION=100

# Sorunu çöz ve yeniden deploy et
```

---

## 📚 Kaynaklar

- [Entity Framework Core Migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
- [PostgreSQL IF NOT EXISTS](https://www.postgresql.org/docs/current/sql-createtable.html)
- [Idempotent Migrations Pattern](https://martinfowler.com/articles/evodb.html)

---

**💡 Pro Tip**: Her production deployment'tan önce staging'de test et!

