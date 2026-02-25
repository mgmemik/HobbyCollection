# 🔧 Admin Kullanıcı Güncelleme - Basit Yöntem

## ✅ En Kolay Yöntem: Cloud Shell Script

### Adım 1: Cloud Shell'i Açın

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/cloudshell?project=fresh-inscriber-472521-t7
   ```

2. **Cloud Shell'i başlatın** (sağ üstteki terminal ikonuna tıklayın)

### Adım 2: Script'i Cloud Shell'e Yükleyin

Cloud Shell'de şu komutu çalıştırın:

```bash
curl -o update-admin-cloudshell.sh https://raw.githubusercontent.com/YOUR_REPO/update-admin-cloudshell.sh
```

**VEYA** script'i manuel olarak oluşturun:

```bash
cat > update-admin-cloudshell.sh << 'SCRIPT'
#!/bin/bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud config set project $GOOGLE_CLOUD_PROJECT

DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password")

PGPASSWORD="$DB_PASSWORD" psql \
  -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db \
  -U postgres \
  -d hobbycollection \
  -c "UPDATE \"AspNetUsers\" SET \"IsAdmin\" = true WHERE \"Email\" = 'gmemik@gmail.com';"

PGPASSWORD="$DB_PASSWORD" psql \
  -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db \
  -U postgres \
  -d hobbycollection \
  -c "SELECT \"Email\", \"IsAdmin\" FROM \"AspNetUsers\" WHERE \"Email\" = 'gmemik@gmail.com';"
SCRIPT

chmod +x update-admin-cloudshell.sh
```

### Adım 3: Script'i Çalıştırın

```bash
./update-admin-cloudshell.sh
```

---

## ✅ Alternatif: Tek Komut

Cloud Shell'de direkt olarak:

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password")
PGPASSWORD="$DB_PASSWORD" psql -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db -U postgres -d hobbycollection -c "UPDATE \"AspNetUsers\" SET \"IsAdmin\" = true WHERE \"Email\" = 'gmemik@gmail.com';"
```

---

## 🔍 Kontrol

```bash
DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password")
PGPASSWORD="$DB_PASSWORD" psql -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db -U postgres -d hobbycollection -c "SELECT \"Email\", \"IsAdmin\" FROM \"AspNetUsers\" WHERE \"Email\" = 'gmemik@gmail.com';"
```
