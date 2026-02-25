# 🔧 Cloud Shell ile Admin Kullanıcı Güncelleme

## 📋 Yöntem: Google Cloud Shell

Cloud Shell'de psql zaten yüklü ve Cloud SQL'e otomatik bağlanabilir.

### Adım 1: Cloud Shell'i Açın

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/cloudshell?project=fresh-inscriber-472521-t7
   ```

2. **Cloud Shell'i başlatın** (sağ üstteki terminal ikonuna tıklayın)

### Adım 2: Database Şifresini Alın

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Database şifresini al
DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password")
```

### Adım 3: Cloud SQL'e Bağlanın

```bash
# Cloud SQL instance'a bağlan
gcloud sql connect hobbycollection-db --user=postgres --database=hobbycollection
```

Şifre istendiğinde, yukarıda aldığınız `$DB_PASSWORD` değerini girin.

### Adım 4: SQL Komutunu Çalıştırın

```sql
UPDATE "AspNetUsers" 
SET "IsAdmin" = true 
WHERE "Email" = 'gmemik@gmail.com';
```

### Adım 5: Kontrol Edin

```sql
SELECT "Email", "IsAdmin" 
FROM "AspNetUsers" 
WHERE "Email" = 'gmemik@gmail.com';
```

### Adım 6: Çıkış

```sql
\q
```

---

## ✅ Alternatif: Tek Satırda

Cloud Shell'de tek komutla:

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password")
PGPASSWORD="$DB_PASSWORD" psql -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db -U postgres -d hobbycollection -c "UPDATE \"AspNetUsers\" SET \"IsAdmin\" = true WHERE \"Email\" = 'gmemik@gmail.com';"
```

---

## 🔍 Kontrol

```bash
PGPASSWORD="$DB_PASSWORD" psql -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db -U postgres -d hobbycollection -c "SELECT \"Email\", \"IsAdmin\" FROM \"AspNetUsers\" WHERE \"Email\" = 'gmemik@gmail.com';"
```
