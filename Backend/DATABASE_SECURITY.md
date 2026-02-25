# 🔒 Database Güvenlik Rehberi

## ⚠️ Kritik Güvenlik Sorunları ve Çözümleri

### 1. ✅ Cloud Storage Erişim Kontrolü (Düzeltildi)

**Sorun:** Database Cloud Storage'da herkese açık (`allUsers`) olabilirdi.

**Çözüm:** 
- `allUsers` erişimi kaldırıldı
- Sadece Cloud Run service account'una (`557805993095-compute@developer.gserviceaccount.com`) erişim verildi

**Doğrulama:**
```bash
gsutil iam get gs://hc-uploads-557805993095
```

### 2. ⚠️ SQLite Encryption Eksikliği

**Sorun:** Database şifrelenmemiş durumda. Eğer birisi database dosyasına erişirse, tüm verileri okuyabilir.

**Mevcut Durum:**
- Database Cloud Storage'da plain text olarak saklanıyor
- Cloud Run'da `/app/data/app.db` olarak plain text
- SQLite encryption kullanılmıyor

**Önerilen Çözümler:**

#### Seçenek A: SQLCipher ile Encryption (Önerilen)

SQLite database'ini şifrelemek için SQLCipher kullanın:

1. **NuGet Package Ekle:**
```bash
dotnet add package Microsoft.Data.Sqlite.Core
dotnet add package SQLitePCLRaw.bundle_e_sqlcipher
```

2. **Program.cs'de Connection String'i Güncelle:**
```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var builder = new SqliteConnectionStringBuilder(connectionString);
builder.DataSource = dbPath;
builder.Password = builder.Configuration["Database:EncryptionKey"]; // Secret Manager'dan alın
options.UseSqlite(builder.ConnectionString);
```

3. **Secret Manager'a Encryption Key Ekle:**
```bash
echo -n "YOUR-32-CHAR-ENCRYPTION-KEY-HERE" | gcloud secrets create database-encryption-key --data-file=-
```

#### Seçenek B: Cloud Storage'da Encryption

Database'i Cloud Storage'a yüklerken şifreleyin:

```csharp
// Database'i şifreleyerek Cloud Storage'a yükle
using (var inputFile = File.OpenRead(dbPath))
using (var encryptedStream = new AesGcmStream(inputFile, encryptionKey))
{
    storageClient.UploadObject(bucketName, objectName, "application/octet-stream", encryptedStream);
}
```

### 3. ⚠️ Cloud Run Ephemeral Storage

**Sorun:** Cloud Run'da database `/app/data/app.db` olarak saklanıyor. Bu ephemeral storage, container restart olduğunda kaybolabilir.

**Mevcut Durum:**
- Database her container başlangıcında Cloud Storage'dan indiriliyor
- Yazma işlemleri sadece container içinde kalıyor
- Container restart olduğunda yazma işlemleri kaybolabilir

**Önerilen Çözümler:**

#### Seçenek A: Cloud SQL (En İyi Çözüm)

Cloud SQL PostgreSQL veya MySQL kullanın:

```bash
# Cloud SQL instance oluştur
gcloud sql instances create hobbycollection-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --backup-start-time=03:00 \
  --enable-bin-log

# Database oluştur
gcloud sql databases create hobbycollection --instance=hobbycollection-db

# Kullanıcı oluştur
gcloud sql users create hobbycollection-user \
  --instance=hobbycollection-db \
  --password=$(gcloud secrets versions access latest --secret=database-password)
```

**Connection String:**
```
Server=/cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db;Database=hobbycollection;Uid=hobbycollection-user;Pwd={password}
```

#### Seçenek B: Cloud Storage'a Periyodik Backup

Yazma işlemlerini periyodik olarak Cloud Storage'a yedekleyin:

```csharp
// Her 5 dakikada bir database'i Cloud Storage'a yedekle
var timer = new Timer(async _ => {
    try {
        await BackupDatabaseToCloudStorage();
    } catch (Exception ex) {
        logger.LogError(ex, "Database backup failed");
    }
}, null, TimeSpan.Zero, TimeSpan.FromMinutes(5));
```

### 4. ⚠️ Database İçeriği Güvenliği

**Hassas Veriler:**
- Kullanıcı şifreleri: ✅ Hash'lenmiş (ASP.NET Identity)
- Email adresleri: ⚠️ Plain text
- Kullanıcı adları: ⚠️ Plain text
- Telefon numaraları: ⚠️ Plain text (varsa)
- Ürün bilgileri: ⚠️ Plain text

**Öneriler:**
1. **PII (Personally Identifiable Information) Masking:**
   - Email adreslerini loglarda maskelleyin
   - Production'da hassas verileri loglamayın

2. **GDPR Uyumluluğu:**
   - Kullanıcı verilerini silme endpoint'i ekleyin
   - Veri export endpoint'i ekleyin

3. **Audit Logging:**
   - Tüm database işlemlerini loglayın
   - Kim, ne zaman, ne yaptı bilgilerini saklayın

### 5. ✅ Mevcut Güvenlik Özellikleri

- ✅ Password hashing (ASP.NET Identity)
- ✅ JWT authentication
- ✅ Email confirmation required
- ✅ Cloud Storage erişim kontrolü (düzeltildi)

## 📋 Güvenlik Checklist

- [x] Cloud Storage bucket erişim kontrolü düzeltildi
- [ ] SQLite encryption eklendi
- [ ] Database encryption key Secret Manager'da saklanıyor
- [ ] Cloud SQL'e geçiş planlandı (opsiyonel)
- [ ] Periyodik backup mekanizması eklendi
- [ ] Audit logging eklendi
- [ ] GDPR uyumluluk kontrolleri yapıldı

## 🚀 Hızlı İyileştirmeler

### 1. Encryption Key'i Secret Manager'a Ekle

```bash
# 32 karakterlik güçlü bir key oluştur
openssl rand -base64 32 | gcloud secrets create database-encryption-key --data-file=-
```

### 2. Database Backup Script'i

```bash
#!/bin/bash
# Backend/scripts/backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/app.db.backup.$DATE"

# Cloud Run'dan database'i indir (eğer erişiminiz varsa)
# veya local database'i yedekle
cp /path/to/app.db "$BACKUP_FILE"

# Cloud Storage'a yükle
gsutil cp "$BACKUP_FILE" gs://hc-uploads-557805993095/backups/

# Eski backup'ları temizle (30 günden eski)
gsutil ls gs://hc-uploads-557805993095/backups/ | while read line; do
    if [[ $(date -d "$(gsutil stat "$line" | grep timeCreated | cut -d: -f2- | xargs)" +%s) -lt $(date -d '30 days ago' +%s) ]]; then
        gsutil rm "$line"
    fi
done
```

## 📚 Ek Kaynaklar

- [Google Cloud Storage Security Best Practices](https://cloud.google.com/storage/docs/security)
- [SQLCipher Documentation](https://www.zetetic.net/sqlcipher/)
- [Cloud SQL Security](https://cloud.google.com/sql/docs/postgres/security)
- [ASP.NET Identity Security](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity)

