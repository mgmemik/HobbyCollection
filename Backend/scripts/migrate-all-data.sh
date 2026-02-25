#!/bin/bash

# SQLite'tan PostgreSQL'e veri migration script'i
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "🚀 SQLite'tan PostgreSQL'e veri migration başlatılıyor..."

# PostgreSQL bağlantısını kontrol et
if ! psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ PostgreSQL bağlantısı başarısız"
    exit 1
fi

echo "✅ PostgreSQL bağlantısı başarılı"

# Geçici dosya oluştur
TEMP_FILE=$(mktemp)

# AspNetUsers - TEXT ID'leri UUID'ye çevirmek gerekiyor ama şimdilik TEXT olarak bırakıyoruz
echo "📊 AspNetUsers migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM AspNetUsers;" | while IFS='|' read -r id email normalized_email password_hash security_stamp concurrency_stamp phone_number phone_number_confirmed two_factor_enabled lockout_end lockout_enabled access_failed_count ui_language ai_language currency; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"AspNetUsers\" (\"Id\", \"Email\", \"NormalizedEmail\", \"PasswordHash\", \"SecurityStamp\", \"ConcurrencyStamp\", \"PhoneNumber\", \"PhoneNumberConfirmed\", \"TwoFactorEnabled\", \"LockoutEnd\", \"LockoutEnabled\", \"AccessFailedCount\", \"UiLanguage\", \"AiLanguage\", \"Currency\")
        VALUES ('$id', '$email', '$normalized_email', '$password_hash', '$security_stamp', '$concurrency_stamp', '$phone_number', '$phone_number_confirmed', '$two_factor_enabled', NULLIF('$lockout_end', ''), '$lockout_enabled', '$access_failed_count', '$ui_language', '$ai_language', '$currency')
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# Categories - ID'leri UUID'ye çevirmek gerekiyor
echo "📊 Categories migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM Categories;" | while IFS='|' read -r id name slug description parent_id is_active created_at_utc; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"Categories\" (\"Id\", \"Name\", \"Slug\", \"Description\", \"ParentId\", \"IsActive\", \"CreatedAtUtc\")
        VALUES ('$id'::uuid, '$name', '$slug', '$description', NULLIF('$parent_id', '')::uuid, '$is_active', '$created_at_utc'::timestamp)
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# Products
echo "📊 Products migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM Products;" | while IFS='|' read -r id name description category_id user_id price currency condition created_at_utc updated_at_utc; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"Products\" (\"Id\", \"Name\", \"Description\", \"CategoryId\", \"UserId\", \"Price\", \"Currency\", \"Condition\", \"CreatedAtUtc\", \"UpdatedAtUtc\")
        VALUES ('$id'::uuid, '$name', '$description', NULLIF('$category_id', '')::uuid, '$user_id', '$price', '$currency', '$condition', '$created_at_utc'::timestamp, NULLIF('$updated_at_utc', '')::timestamp)
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# ProductPhotos
echo "📊 ProductPhotos migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM ProductPhotos;" | while IFS='|' read -r id product_id photo_url is_primary display_order created_at_utc; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"ProductPhotos\" (\"Id\", \"ProductId\", \"PhotoUrl\", \"IsPrimary\", \"DisplayOrder\", \"CreatedAtUtc\")
        VALUES ('$id'::uuid, '$product_id'::uuid, '$photo_url', '$is_primary', '$display_order', '$created_at_utc'::timestamp)
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

# Brands
echo "📊 Brands migrate ediliyor..."
sqlite3 "$SQLITE_DB" "SELECT * FROM Brands;" | while IFS='|' read -r id name normalized_name category country founded_year is_active popularity_score created_at_utc updated_at_utc; do
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"Brands\" (\"Id\", \"Name\", \"NormalizedName\", \"Category\", \"Country\", \"FoundedYear\", \"IsActive\", \"PopularityScore\", \"CreatedAtUtc\", \"UpdatedAtUtc\")
        VALUES ('$id', '$name', '$normalized_name', '$category', '$country', '$founded_year', '$is_active', '$popularity_score', '$created_at_utc'::timestamp, NULLIF('$updated_at_utc', '')::timestamp)
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

echo "✅ Migration tamamlandı!"
echo "⚠️  Not: Bazı tablolar (CategoryClosures, Comments, vb.) için manuel migration gerekebilir."

