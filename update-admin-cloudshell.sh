#!/bin/bash
# Cloud Shell'de çalıştırılacak script

export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud config set project $GOOGLE_CLOUD_PROJECT

echo "🔧 Database şifresi alınıyor..."
DB_PASSWORD=$(gcloud secrets versions access latest --secret="database-password")

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database şifresi alınamadı"
    exit 1
fi

echo "✅ Şifre alındı"
echo ""
echo "🔧 Cloud SQL'e bağlanılıyor..."
echo ""

# SQL komutlarını çalıştır
PGPASSWORD="$DB_PASSWORD" psql \
  -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db \
  -U postgres \
  -d hobbycollection \
  -c "UPDATE \"AspNetUsers\" SET \"IsAdmin\" = true WHERE \"Email\" = 'gmemik@gmail.com';"

echo ""
echo "✅ Güncelleme tamamlandı!"
echo ""
echo "🔍 Kontrol:"

PGPASSWORD="$DB_PASSWORD" psql \
  -h /cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db \
  -U postgres \
  -d hobbycollection \
  -c "SELECT \"Email\", \"IsAdmin\" FROM \"AspNetUsers\" WHERE \"Email\" = 'gmemik@gmail.com';"
