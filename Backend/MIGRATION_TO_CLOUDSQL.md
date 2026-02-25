# 🚀 Cloud SQL Migration Guide - Temiz Çözüm

## 🎯 Hedef
SQLite ephemeral storage sorunlarını çözmek için Cloud SQL PostgreSQL'e geçiş.

## ⚠️ Mevcut Sorunlar
1. **Race Condition**: Birden fazla instance aynı anda backup atıyor
2. **Veri Kaybı**: Instance restart olduğunda değişiklikler kaybolabiliyor
3. **Karmaşık Backup**: Her yazma işleminde Cloud Storage'a backup
4. **Silinen Veriler Geri Geliyor**: Eski backup'lar yeni değişikliklerin üzerine yazıyor

## ✅ Cloud SQL Avantajları
- ✅ Kalıcı storage (container restart'tan etkilenmez)
- ✅ Otomatik backup (Google tarafından yönetilen)
- ✅ Çoklu instance desteği (race condition yok)
- ✅ High availability
- ✅ Point-in-time recovery
- ✅ Otomatik failover

## 📋 Adım Adım Migration

### 1. Cloud SQL Instance Oluştur

```bash
# PostgreSQL instance oluştur (f1-micro = ücretsiz denemek için)
gcloud sql instances create hobbycollection-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --project=fresh-inscriber-472521-t7

# Database oluştur
gcloud sql databases create hobbycollection \
  --instance=hobbycollection-db \
  --project=fresh-inscriber-472521-t7

# Kullanıcı şifresi oluştur
DB_PASSWORD=$(openssl rand -base64 32)
echo "Database Password: $DB_PASSWORD"

# Secret Manager'a ekle
echo -n "$DB_PASSWORD" | gcloud secrets create database-password --data-file=- --project=fresh-inscriber-472521-t7

# Kullanıcı oluştur
gcloud sql users set-password postgres \
  --instance=hobbycollection-db \
  --password="$DB_PASSWORD" \
  --project=fresh-inscriber-472521-t7
```

### 2. Cloud Run'a SQL Erişim İzni Ver

```bash
# Cloud Run service account'una SQL erişimi ver
PROJECT_NUMBER=$(gcloud projects describe fresh-inscriber-472521-t7 --format="value(projectNumber)")

gcloud sql instances patch hobbycollection-db \
  --authorized-networks=0.0.0.0/0 \
  --project=fresh-inscriber-472521-t7
  
# Cloud SQL Admin rolü ver (Cloud SQL Proxy için)
gcloud projects add-iam-policy-binding fresh-inscriber-472521-t7 \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Secret erişim izni ver (database şifresi için)
gcloud secrets add-iam-policy-binding database-password \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=fresh-inscriber-472521-t7
```

### 3. Mevcut SQLite Verilerini Export Et

```bash
# Mevcut database'i Cloud Storage'dan indir
gsutil cp gs://hc-uploads-557805993095/database/app.db /tmp/app.db

# SQLite'tan SQL dump al
sqlite3 /tmp/app.db .dump > /tmp/sqlite_dump.sql

# PostgreSQL'e import etmek için düzenle (manuel veya script ile)
# - SQLite syntax'ını PostgreSQL'e çevir
# - AUTOINCREMENT -> SERIAL
# - TEXT -> VARCHAR veya TEXT
# - INTEGER -> INTEGER veya BIGINT
```

### 4. .NET Kodunu Güncelle

#### HobbyCollection.Api.csproj

```xml
<ItemGroup>
  <!-- SQLite'ı kaldır -->
  <!-- <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.0" /> -->
  
  <!-- PostgreSQL ekle -->
  <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />
  <PackageReference Include="Google.Cloud.EntityFrameworkCore.PostgreSQL.Infrastructure" Version="2.0.0" />
</ItemGroup>
```

#### Program.cs - Database Configuration

```csharp
// SQLite configuration'ı kaldır
// builder.Services.AddDbContext<AppDbContext>(options =>
//     options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// PostgreSQL configuration ekle
builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    var environment = configuration["ASPNETCORE_ENVIRONMENT"];
    
    if (environment == "Production")
    {
        // Cloud SQL bağlantısı (Unix socket kullanarak)
        var instanceConnectionName = configuration["CloudSql:InstanceConnectionName"]; // fresh-inscriber-472521-t7:europe-west1:hobbycollection-db
        var databaseName = configuration["CloudSql:DatabaseName"] ?? "hobbycollection";
        var userId = configuration["CloudSql:UserId"] ?? "postgres";
        var password = configuration["CloudSql:Password"]; // Secret Manager'dan gelecek
        
        var connectionString = $"Host=/cloudsql/{instanceConnectionName};Database={databaseName};Username={userId};Password={password}";
        options.UseNpgsql(connectionString);
    }
    else
    {
        // Development'ta SQLite kullan
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        options.UseSqlite(connectionString);
    }
});

// Database download/backup kodunu KALDIR (artık gerek yok)
// Satır 193-264 arası kodu sil veya comment out yap

// DatabaseBackupService'i KALDIR (artık gerek yok)
// builder.Services.AddSingleton<HobbyCollection.Infrastructure.Services.DatabaseBackupService>();
```

#### AppDbContext.cs - SaveChangesAsync

```csharp
// Backup kodunu KALDIR
public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
{
    // Sadece normal SaveChanges yap, backup'a gerek yok
    return await base.SaveChangesAsync(cancellationToken);
}
```

#### appsettings.Production.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=/cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db;Database=hobbycollection;Username=postgres;Password=PLACEHOLDER"
  },
  "CloudSql": {
    "InstanceConnectionName": "fresh-inscriber-472521-t7:europe-west1:hobbycollection-db",
    "DatabaseName": "hobbycollection",
    "UserId": "postgres",
    "Password": "PLACEHOLDER"
  }
}
```

### 5. Cloud Build'i Güncelle

#### cloudbuild.yaml

```yaml
# Deploy step'e Cloud SQL connection ekle
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: 'bash'
  secretEnv: ['JWT_KEY', 'DB_PASSWORD']
  args:
    - '-c'
    - |
      gcloud run deploy hobbycollection-api \
        --image gcr.io/$PROJECT_ID/hobbycollection-api:latest \
        --region europe-west1 \
        --platform managed \
        --allow-unauthenticated \
        --port 8080 \
        --memory 2Gi \
        --cpu 2 \
        --timeout 300 \
        --max-instances 10 \
        --add-cloudsql-instances fresh-inscriber-472521-t7:europe-west1:hobbycollection-db \
        --set-env-vars "ASPNETCORE_ENVIRONMENT=Production,Jwt__Key=$$JWT_KEY,CloudSql__Password=$$DB_PASSWORD,Smtp__Host=smtp-relay.brevo.com,Smtp__Port=587,Smtp__Username=9490c6001@smtp-brevo.com,Smtp__Password=EOMNg1CtaJ9XGFkn,Smtp__From=noreply@save-all.com,Smtp__FromName=Save All,AppStoreReview__TestEmail=appstore.review@save-all.com,AppStoreReview__TestCode=123456"

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/jwt-key/versions/latest
      env: 'JWT_KEY'
    - versionName: projects/$PROJECT_ID/secrets/database-password/versions/latest
      env: 'DB_PASSWORD'
```

### 6. Migration Oluştur ve Uygula

```bash
# PostgreSQL migration oluştur
cd Backend/HobbyCollection.Api
dotnet ef migrations add MigrateToPostgreSQL

# Migration'ı PostgreSQL'e uygula
dotnet ef database update
```

### 7. Deploy Et

```bash
cd Backend
gcloud builds submit --config=HobbyCollection.Api/cloudbuild.yaml --project=fresh-inscriber-472521-t7
```

## 🧹 Temizlik (Migration Başarılı Olduktan Sonra)

```bash
# Eski backup dosyalarını sil
gsutil rm gs://hc-uploads-557805993095/database/app.db

# DatabaseBackupService.cs dosyasını sil
rm Backend/HobbyCollection.Infrastructure/Services/DatabaseBackupService.cs

# Program.cs'den backup kodlarını kaldır
# AppDbContext.cs'den backup kodlarını kaldır
```

## 💰 Maliyet Tahmini

**Cloud SQL f1-micro (shared-core):**
- $7/ay (~₺250/ay)
- Otomatik backup dahil
- High availability için +$7/ay

**Alternatif: Cloud SQL e2-micro (shared-core, E2):**
- $9/ay (~₺320/ay)
- Daha iyi performans

## 🔄 Rollback Planı

Eğer sorun çıkarsa:

```bash
# Eski SQLite versiyonuna dön
git revert <commit-hash>

# Database'i Cloud Storage'a yükle
gsutil cp /tmp/app.db gs://hc-uploads-557805993095/database/app.db

# Deploy et
./deploy.sh
```

## 📊 Test Checklist

- [ ] Cloud SQL instance oluşturuldu
- [ ] Database ve kullanıcı oluşturuldu
- [ ] Cloud Run'a SQL erişim izni verildi
- [ ] Mevcut veriler export edildi
- [ ] PostgreSQL migration başarılı
- [ ] Development'ta SQLite çalışıyor
- [ ] Production'da Cloud SQL çalışıyor
- [ ] Ürün ekleme/silme/güncelleme çalışıyor
- [ ] Birden fazla instance test edildi
- [ ] Race condition çözüldü
- [ ] Silinen ürünler geri gelmiyor

## 🚀 Sonuç

Bu migration ile:
- ✅ Race condition sorunu çözülür
- ✅ Veri kaybı sorunu çözülür
- ✅ Silinen ürünler geri gelmez
- ✅ Karmaşık backup kodu kaldırılır
- ✅ Profesyonel, ölçeklenebilir bir yapı kurulur

Migration sırasında bir sorun olursa veya yardıma ihtiyacın olursa bildirmeni bekliyorum!

