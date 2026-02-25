#!/bin/bash

# SQLite'tan PostgreSQL'e veri migration script'i
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "🚀 SQLite'tan PostgreSQL'e veri migration başlatılıyor..."

# SQLite veritabanının var olduğunu kontrol et
if [ ! -f "$SQLITE_DB" ]; then
    echo "❌ SQLite veritabanı bulunamadı: $SQLITE_DB"
    exit 1
fi

# PostgreSQL bağlantısını kontrol et
if ! psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ PostgreSQL bağlantısı başarısız"
    exit 1
fi

echo "✅ Bağlantılar başarılı"

# AspNetUsers tablosunu migrate et
echo "📊 AspNetUsers tablosu migrate ediliyor..."
sqlite3 "$SQLITE_DB" <<EOF | psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -q 2>&1 | grep -v "already exists" || true
.mode insert AspNetUsers
SELECT * FROM AspNetUsers;
EOF

# Categories tablosunu migrate et
echo "📊 Categories tablosu migrate ediliyor..."
sqlite3 "$SQLITE_DB" <<EOF | psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -q 2>&1 | grep -v "already exists" || true
.mode insert Categories
SELECT * FROM Categories;
EOF

# Products tablosunu migrate et
echo "📊 Products tablosu migrate ediliyor..."
sqlite3 "$SQLITE_DB" <<EOF | psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -q 2>&1 | grep -v "already exists" || true
.mode insert Products
SELECT * FROM Products;
EOF

# ProductPhotos tablosunu migrate et
echo "📊 ProductPhotos tablosu migrate ediliyor..."
sqlite3 "$SQLITE_DB" <<EOF | psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -q 2>&1 | grep -v "already exists" || true
.mode insert ProductPhotos
SELECT * FROM ProductPhotos;
EOF

# Brands tablosunu migrate et
echo "📊 Brands tablosu migrate ediliyor..."
sqlite3 "$SQLITE_DB" <<EOF | psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -q 2>&1 | grep -v "already exists" || true
.mode insert Brands
SELECT * FROM Brands;
EOF

echo "✅ Migration tamamlandı!"
echo "⚠️  Not: SQLite ve PostgreSQL arasındaki syntax farkları nedeniyle bazı tablolar manuel migration gerektirebilir."

