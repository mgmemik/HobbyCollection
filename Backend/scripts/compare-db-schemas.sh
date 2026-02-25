#!/bin/bash

# Dev ve Production database schema'larını karşılaştır

# PostgreSQL path'ini ekle
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "=========================================="
echo "Database Schema Karşılaştırması"
echo "=========================================="

# Development database bilgileri
DEV_HOST="localhost"
DEV_DB="hobbycollection_dev"
DEV_USER="gokhanmemik"
DEV_PASSWORD=""

# Production database bilgileri (Cloud SQL)
PROD_INSTANCE="fresh-inscriber-472521-t7:europe-west1:hobbycollection-db"
PROD_DB="hobbycollection"
PROD_USER="postgres"
PROD_PASSWORD="${CLOUDSQL_PASSWORD}"

if [ -z "$PROD_PASSWORD" ]; then
    echo "⚠️  CLOUDSQL_PASSWORD environment variable tanımlı değil!"
    echo "Production schema'sını kontrol edemiyorum."
    exit 1
fi

echo ""
echo "📊 Development Database Schema:"
echo "--------------------------------"
psql -h "$DEV_HOST" -U "$DEV_USER" -d "$DEV_DB" <<EOF
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name NOT LIKE '__%'
ORDER BY table_name, column_name;
EOF

echo ""
echo "📊 Production Database Schema:"
echo "--------------------------------"
PGPASSWORD="$PROD_PASSWORD" psql -h "/cloudsql/$PROD_INSTANCE" -U "$PROD_USER" -d "$PROD_DB" <<EOF
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name NOT LIKE '__%'
ORDER BY table_name, column_name;
EOF

echo ""
echo "🔍 Follows Tablosu Detayları:"
echo "--------------------------------"
echo "Development:"
psql -h "$DEV_HOST" -U "$DEV_USER" -d "$DEV_DB" -c "\d Follows"

echo ""
echo "Production:"
PGPASSWORD="$PROD_PASSWORD" psql -h "/cloudsql/$PROD_INSTANCE" -U "$PROD_USER" -d "$PROD_DB" -c "\d Follows"

echo ""
echo "✅ Karşılaştırma tamamlandı!"

