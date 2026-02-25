#!/bin/bash

# Products migration
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "📊 Products migrate ediliyor..."

sqlite3 "$SQLITE_DB" "SELECT * FROM Products;" | while IFS='|' read -r id category_id comments_enabled created_at description hashtags is_public price title user_id; do
    # NULL değerleri kontrol et
    [ -z "$category_id" ] && category_id="NULL" || category_id="'$category_id'::uuid"
    [ -z "$description" ] && description="NULL" || description="'${description//\'/\'\'}'"
    [ -z "$hashtags" ] && hashtags="NULL" || hashtags="'${hashtags//\'/\'\'}'"
    [ -z "$price" ] && price="NULL" || price="$price"
    [ -z "$comments_enabled" ] && comments_enabled="false" || comments_enabled="$comments_enabled"
    [ -z "$is_public" ] && is_public="true" || is_public="$is_public"
    
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"Products\" (
            \"Id\", \"CategoryId\", \"CommentsEnabled\", \"CreatedAt\", \"Description\",
            \"Hashtags\", \"IsPublic\", \"Price\", \"Title\", \"UserId\"
        )
        VALUES (
            '$id'::uuid, $category_id, '$comments_enabled', '$created_at'::timestamp,
            $description, $hashtags, '$is_public', $price, '${title//\'/\'\'}', '$user_id'
        )
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

echo "✅ Products migration tamamlandı!"

