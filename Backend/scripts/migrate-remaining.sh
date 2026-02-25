#!/bin/bash

# Kalan tabloları migrate et
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# ProductPhotos
echo "📊 ProductPhotos migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM ProductPhotos;" | while IFS='|' read -r id product_id blob_url blob_name content_type size_bytes order created_at; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"ProductPhotos\" (\"Id\", \"ProductId\", \"BlobUrl\", \"BlobName\", \"ContentType\", \"SizeBytes\", \"Order\", \"CreatedAt\")
        VALUES ('$id'::uuid, '$product_id'::uuid, '$blob_url', '$blob_name', '$content_type', '$size_bytes', '$order', '$created_at'::timestamp)
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# ProductLikes
echo "📊 ProductLikes migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM ProductLikes;" | while IFS='|' read -r id product_id user_id created_at; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"ProductLikes\" (\"Id\", \"ProductId\", \"UserId\", \"CreatedAt\")
        VALUES ('$id'::uuid, '$product_id'::uuid, '$user_id', '$created_at'::timestamp)
        ON CONFLICT (\"ProductId\", \"UserId\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# ProductSaves
echo "📊 ProductSaves migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM ProductSaves;" | while IFS='|' read -r id product_id user_id created_at; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"ProductSaves\" (\"Id\", \"ProductId\", \"UserId\", \"CreatedAt\")
        VALUES ('$id'::uuid, '$product_id'::uuid, '$user_id', '$created_at'::timestamp)
        ON CONFLICT (\"ProductId\", \"UserId\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

echo "✅ Kalan tablolar migration tamamlandı!"

