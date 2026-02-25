#!/bin/bash

# Dev ve Production database schema'larını karşılaştır
# Cloud SQL Proxy kullanarak production'a bağlanır

# PostgreSQL path'ini ekle
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "=========================================="
echo "Database Schema Karşılaştırması"
echo "=========================================="

# Development database bilgileri
DEV_HOST="localhost"
DEV_DB="hobbycollection_dev"
DEV_USER="gokhanmemik"

# Production database bilgileri (Cloud SQL Proxy üzerinden)
PROD_HOST="127.0.0.1"
PROD_PORT="5432"
PROD_DB="hobbycollection"
PROD_USER="postgres"
PROD_PASSWORD="${CLOUDSQL_PASSWORD}"

if [ -z "$PROD_PASSWORD" ]; then
    echo "⚠️  CLOUDSQL_PASSWORD environment variable tanımlı değil!"
    echo "Secret Manager'dan alınıyor..."
    PROD_PASSWORD=$(gcloud secrets versions access latest --secret="database-password" --project fresh-inscriber-472521-t7 2>/dev/null)
    if [ -z "$PROD_PASSWORD" ]; then
        echo "❌ Production password alınamadı!"
        exit 1
    fi
fi

echo ""
echo "📊 Development Database - Follows Tablosu:"
echo "--------------------------------"
psql -h "$DEV_HOST" -U "$DEV_USER" -d "$DEV_DB" <<EOF
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'Follows'
ORDER BY ordinal_position;
EOF

echo ""
echo "📊 Production Database - Follows Tablosu:"
echo "--------------------------------"
if [ -z "$CLOUDSQL_PASSWORD" ]; then
    CLOUDSQL_PASSWORD=$(gcloud secrets versions access latest --secret="database-password" --project fresh-inscriber-472521-t7 2>/dev/null)
fi

if [ -n "$CLOUDSQL_PASSWORD" ]; then
    echo "$CLOUDSQL_PASSWORD" | gcloud sql connect hobbycollection-db --user=postgres --database=hobbycollection --project=fresh-inscriber-472521-t7 --quiet 2>&1 <<SQL
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'Follows'
ORDER BY ordinal_position;
\q
SQL
else
    echo "⚠️  Cloud SQL Proxy gerekiyor. Alternatif yöntem kullanılıyor..."
    echo ""
    echo "Production schema bilgilerini almak için Cloud SQL Proxy başlatın:"
    echo "  cloud-sql-proxy fresh-inscriber-472521-t7:europe-west1:hobbycollection-db --port=5432"
fi

echo ""
echo "🔍 Tüm Tablolar - Development:"
echo "--------------------------------"
psql -h "$DEV_HOST" -U "$DEV_USER" -d "$DEV_DB" <<EOF
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name NOT LIKE '__%'
GROUP BY table_name
ORDER BY table_name;
EOF

echo ""
echo "✅ Karşılaştırma tamamlandı!"
echo ""
echo "💡 İpucu: Production schema'sını görmek için:"
echo "   1. Cloud SQL Proxy'yi başlatın"
echo "   2. Scripti tekrar çalıştırın"

