#!/bin/bash

# 🚀 Otomatik Migration Deployment Script
# Bu script hem dev hem de production'da çalışır

set -e  # Hata durumunda dur

echo "🔍 Migration deployment başlatılıyor..."

# Veritabanı bağlantı bilgileri
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-gokhanmemik}"
DB_NAME="${DB_NAME:-hobbycollection_dev}"

# PostgreSQL client path (Mac için farklı lokasyonlar)
PSQL_PATHS=(
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
    "/usr/local/bin/psql"
    "/opt/homebrew/bin/psql"
    "psql"
)

# psql'i bul
PSQL_CMD=""
for path in "${PSQL_PATHS[@]}"; do
    if command -v "$path" &> /dev/null; then
        PSQL_CMD="$path"
        echo "✅ psql bulundu: $PSQL_CMD"
        break
    fi
done

if [ -z "$PSQL_CMD" ]; then
    echo "❌ HATA: psql bulunamadı!"
    echo "Lütfen PostgreSQL client'i yükleyin veya PATH'e ekleyin."
    exit 1
fi

# Migration dosyasını çalıştır
echo "📦 Badge migration uygulanıyor..."
PGPASSWORD="${DB_PASSWORD:-}" $PSQL_CMD -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$(dirname "$0")/add-product-badges-migration.sql"

if [ $? -eq 0 ]; then
    echo "✅ Migration başarıyla uygulandı!"
    echo ""
    echo "🎉 Deployment tamamlandı! Backend'i yeniden başlatabilirsiniz."
else
    echo "❌ Migration uygulanırken hata oluştu!"
    exit 1
fi

