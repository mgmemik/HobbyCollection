#!/bin/bash

# SQLite'tan PostgreSQL'e veri migration - Final versiyon
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "🚀 SQLite'tan PostgreSQL'e veri migration başlatılıyor..."

# AspNetUsers - CSV export ve import
echo "📊 AspNetUsers migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM AspNetUsers;" > /tmp/users.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
CREATE TEMP TABLE temp_users AS SELECT * FROM "AspNetUsers" WHERE 1=0;
\copy temp_users FROM '/tmp/users.csv' WITH CSV HEADER
INSERT INTO "AspNetUsers" SELECT * FROM temp_users ON CONFLICT ("Id") DO NOTHING;
DROP TABLE temp_users;
EOF

# Categories
echo "📊 Categories migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM Categories;" > /tmp/categories.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
CREATE TEMP TABLE temp_categories AS SELECT * FROM "Categories" WHERE 1=0;
\copy temp_categories FROM '/tmp/categories.csv' WITH CSV HEADER
INSERT INTO "Categories" SELECT * FROM temp_categories ON CONFLICT ("Id") DO NOTHING;
DROP TABLE temp_categories;
EOF

# Products
echo "📊 Products migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM Products;" > /tmp/products.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
CREATE TEMP TABLE temp_products AS SELECT * FROM "Products" WHERE 1=0;
\copy temp_products FROM '/tmp/products.csv' WITH CSV HEADER
INSERT INTO "Products" SELECT * FROM temp_products ON CONFLICT ("Id") DO NOTHING;
DROP TABLE temp_products;
EOF

# ProductPhotos
echo "📊 ProductPhotos migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM ProductPhotos;" > /tmp/photos.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
CREATE TEMP TABLE temp_photos AS SELECT * FROM "ProductPhotos" WHERE 1=0;
\copy temp_photos FROM '/tmp/photos.csv' WITH CSV HEADER
INSERT INTO "ProductPhotos" SELECT * FROM temp_photos ON CONFLICT ("Id") DO NOTHING;
DROP TABLE temp_photos;
EOF

# Brands
echo "📊 Brands migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM Brands;" > /tmp/brands.csv
psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
CREATE TEMP TABLE temp_brands AS SELECT * FROM "Brands" WHERE 1=0;
\copy temp_brands FROM '/tmp/brands.csv' WITH CSV HEADER
INSERT INTO "Brands" SELECT * FROM temp_brands ON CONFLICT ("Id") DO NOTHING;
DROP TABLE temp_brands;
EOF

# CategoryClosures
echo "📊 CategoryClosures migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM CategoryClosures;" > /tmp/closures.csv 2>/dev/null
if [ -s /tmp/closures.csv ]; then
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
    CREATE TEMP TABLE temp_closures AS SELECT * FROM "CategoryClosures" WHERE 1=0;
    \copy temp_closures FROM '/tmp/closures.csv' WITH CSV HEADER
    INSERT INTO "CategoryClosures" SELECT * FROM temp_closures ON CONFLICT ("AncestorId", "DescendantId") DO NOTHING;
    DROP TABLE temp_closures;
EOF
fi

# ProductLikes
echo "📊 ProductLikes migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM ProductLikes;" > /tmp/likes.csv 2>/dev/null
if [ -s /tmp/likes.csv ]; then
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
    CREATE TEMP TABLE temp_likes AS SELECT * FROM "ProductLikes" WHERE 1=0;
    \copy temp_likes FROM '/tmp/likes.csv' WITH CSV HEADER
    INSERT INTO "ProductLikes" SELECT * FROM temp_likes ON CONFLICT ("ProductId", "UserId") DO NOTHING;
    DROP TABLE temp_likes;
EOF
fi

# ProductSaves
echo "📊 ProductSaves migrate ediliyor..."
sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM ProductSaves;" > /tmp/saves.csv 2>/dev/null
if [ -s /tmp/saves.csv ]; then
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'EOF'
    CREATE TEMP TABLE temp_saves AS SELECT * FROM "ProductSaves" WHERE 1=0;
    \copy temp_saves FROM '/tmp/saves.csv' WITH CSV HEADER
    INSERT INTO "ProductSaves" SELECT * FROM temp_saves ON CONFLICT ("ProductId", "UserId") DO NOTHING;
    DROP TABLE temp_saves;
EOF
fi

# Temizlik
rm -f /tmp/*.csv

echo "✅ Migration tamamlandı!"

