#!/bin/bash

# AspNetUsers migration - Column mapping ile
SQLITE_DB="/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db"
PG_HOST="localhost"
PG_DB="hobbycollection_dev"
PG_USER="gokhanmemik"

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "📊 AspNetUsers migrate ediliyor..."

sqlite3 "$SQLITE_DB" "SELECT * FROM AspNetUsers;" | while IFS='|' read -r id display_name user_name normalized_user_name email normalized_email email_confirmed password_hash security_stamp concurrency_stamp phone_number phone_number_confirmed two_factor_enabled lockout_end lockout_enabled access_failed_count ai_language ui_language currency; do
    # NULL değerleri kontrol et
    [ -z "$lockout_end" ] && lockout_end="NULL" || lockout_end="'$lockout_end'"
    [ -z "$email" ] && email="NULL" || email="'$email'"
    [ -z "$normalized_email" ] && normalized_email="NULL" || normalized_email="'$normalized_email'"
    [ -z "$ui_language" ] && ui_language="'en'" || ui_language="'$ui_language'"
    [ -z "$currency" ] && currency="'TRY'" || currency="'$currency'"
    
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
        INSERT INTO \"AspNetUsers\" (
            \"Id\", \"DisplayName\", \"UserName\", \"NormalizedUserName\", \"Email\", \"NormalizedEmail\",
            \"EmailConfirmed\", \"PasswordHash\", \"SecurityStamp\", \"ConcurrencyStamp\",
            \"PhoneNumber\", \"PhoneNumberConfirmed\", \"TwoFactorEnabled\", \"LockoutEnd\",
            \"LockoutEnabled\", \"AccessFailedCount\", \"AiLanguage\", \"UiLanguage\", \"Currency\"
        )
        VALUES (
            '$id', '$display_name', '$user_name', '$normalized_user_name', $email, $normalized_email,
            '$email_confirmed', '$password_hash', '$security_stamp', '$concurrency_stamp',
            '$phone_number', '$phone_number_confirmed', '$two_factor_enabled', $lockout_end,
            '$lockout_enabled', '$access_failed_count', '$ai_language', $ui_language, $currency
        )
        ON CONFLICT (\"Id\") DO NOTHING;
    " 2>&1 | grep -v "already exists" || true
done

echo "✅ AspNetUsers migration tamamlandı!"

