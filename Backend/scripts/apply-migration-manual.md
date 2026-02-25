# Migration Manuel Uygulama Rehberi

Bu migration'ı veri kaybı olmadan hem dev hem production ortamında uygulamak için:

## Yöntem 1: SQL Script ile (Önerilen - En Güvenli)

### Development Ortamı

```bash
# PostgreSQL'e bağlan
psql -h localhost -U gokhanmemik -d hobbycollection_dev

# SQL script'ini çalıştır
\i scripts/apply-private-account-migration.sql
```

Veya doğrudan:

```bash
psql -h localhost -U gokhanmemik -d hobbycollection_dev -f scripts/apply-private-account-migration.sql
```

### Production Ortamı (Cloud SQL)

```bash
# Cloud SQL Proxy üzerinden bağlan
psql -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db \
     -U postgres \
     -d hobbycollection \
     -f scripts/apply-private-account-migration.sql
```

## Yöntem 2: .NET EF Core ile

### Development

```bash
cd Backend/HobbyCollection.Api
export ASPNETCORE_ENVIRONMENT=Development
dotnet ef database update --project ../HobbyCollection.Infrastructure
```

### Production

```bash
cd Backend/HobbyCollection.Api
export ASPNETCORE_ENVIRONMENT=Production
export CLOUDSQL_PASSWORD="your-password"
dotnet ef database update --project ../HobbyCollection.Infrastructure
```

## Yöntem 3: Program.cs Otomatik Migration (Mevcut)

Backend'i yeniden başlatın. `Program.cs` içindeki `MigrateAsync()` otomatik olarak migration'ı uygulayacaktır.

```bash
cd Backend/HobbyCollection.Api
dotnet run
```

## Güvenlik Notları

1. ✅ SQL script'i **idempotent** - birden fazla kez çalıştırılabilir, veri kaybı olmaz
2. ✅ Mevcut kolonları kontrol eder, varsa tekrar eklemez
3. ✅ Mevcut veriler korunur (DEFAULT değerler kullanılır)
4. ✅ Migration kaydı otomatik eklenir

## Kontrol

Migration'ın başarıyla uygulandığını kontrol etmek için:

```sql
-- Kolonların varlığını kontrol et
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'AspNetUsers' 
AND column_name = 'IsPrivateAccount';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Follows' 
AND column_name = 'Status';

-- Migration kaydını kontrol et
SELECT * FROM "__EFMigrationsHistory" 
WHERE "MigrationId" = '20250122000000_AddPrivateAccountAndFollowStatus';
```

