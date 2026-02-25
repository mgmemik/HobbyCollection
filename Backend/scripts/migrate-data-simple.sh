#!/bin/bash

# Basit SQLite'tan PostgreSQL'e veri migration
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "🚀 SQLite'tan PostgreSQL'e veri migration başlatılıyor..."

# SQLite'tan CSV export ve PostgreSQL'e import
echo "📊 AspNetUsers migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM AspNetUsers;" > /tmp/users.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<EOF
\copy "AspNetUsers" FROM '/tmp/users.csv' WITH CSV HEADER ON CONFLICT DO NOTHING;
EOF

echo "📊 Categories migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM Categories;" > /tmp/categories.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<EOF
\copy "Categories" FROM '/tmp/categories.csv' WITH CSV HEADER ON CONFLICT DO NOTHING;
EOF

echo "📊 Products migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM Products;" > /tmp/products.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<EOF
\copy "Products" FROM '/tmp/products.csv' WITH CSV HEADER ON CONFLICT DO NOTHING;
EOF

echo "📊 ProductPhotos migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM ProductPhotos;" > /tmp/photos.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<EOF
\copy "ProductPhotos" FROM '/tmp/photos.csv' WITH CSV HEADER ON CONFLICT DO NOTHING;
EOF

echo "✅ Migration tamamlandı!"

