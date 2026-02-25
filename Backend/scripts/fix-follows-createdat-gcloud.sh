#!/bin/bash

# Follows.CreatedAt kolonunu TEXT'den TIMESTAMP'e dönüştür
# Cloud SQL'e direkt bağlanarak çalıştırır

set -e

echo "=========================================="
echo "Follows.CreatedAt Düzeltme Script'i"
echo "=========================================="

# Password'u Secret Manager'dan al
export CLOUDSQL_PASSWORD=$(gcloud secrets versions access latest --secret="database-password" --project fresh-inscriber-472521-t7)

if [ -z "$CLOUDSQL_PASSWORD" ]; then
    echo "❌ HATA: Password alınamadı!"
    exit 1
fi

echo "📝 SQL script'i Cloud SQL'e gönderiliyor..."

# SQL script'ini çalıştır
PGPASSWORD="$CLOUDSQL_PASSWORD" gcloud sql connect hobbycollection-db \
    --user=postgres \
    --database=hobbycollection \
    --project=fresh-inscriber-472521-t7 \
    --quiet <<SQL
$(cat /Users/gokhanmemik/Desktop/HobbyCollection/Backend/scripts/fix-follows-createdat.sql)
\q
SQL

echo ""
echo "✅ SQL script'i başarıyla çalıştırıldı!"
echo "Şimdi schema karşılaştırmasını tekrar çalıştırabilirsiniz."

