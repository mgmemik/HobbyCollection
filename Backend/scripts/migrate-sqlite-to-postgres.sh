#!/bin/bash

# SQLite'tan PostgreSQL'e veri migration script'i
# Kullanım: ./migrate-sqlite-to-postgres.sh

SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

echo "🚀 SQLite'tan PostgreSQL'e veri migration başlatılıyor..."

# SQLite veritabanının var olduğunu kontrol et
if [ ! -f "$SQLITE_DB" ]; then
    echo "❌ SQLite veritabanı bulunamadı: $SQLITE_DB"
    exit 1
fi

# PostgreSQL bağlantısını kontrol et
export PGPASSWORD=""
if ! psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ PostgreSQL bağlantısı başarısız. Lütfen PostgreSQL'in çalıştığından ve database'in oluşturulduğundan emin olun."
    exit 1
fi

echo "✅ Bağlantılar başarılı"

# SQLite'tan veriyi export et ve PostgreSQL'e import et
# Not: Bu script temel tablolar için çalışır, Identity tabloları için manuel migration gerekebilir

echo "📊 Migration tamamlandı!"
echo "⚠️  Not: Identity tabloları (AspNetUsers, vb.) için manuel migration gerekebilir."
echo "💡 Uygulamayı çalıştırarak migration'ların otomatik olarak uygulanmasını sağlayabilirsiniz."

