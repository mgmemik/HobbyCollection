#!/bin/bash

# Migration uygulama scripti
# Hem dev hem production ortamında kullanılabilir

set -e  # Hata durumunda dur

echo "=========================================="
echo "Migration Uygulanıyor: AddPrivateAccountAndFollowStatus"
echo "=========================================="

# Environment kontrolü
ENVIRONMENT=${ASPNETCORE_ENVIRONMENT:-Development}

if [ "$ENVIRONMENT" = "Production" ]; then
    echo "⚠️  PRODUCTION ortamı tespit edildi!"
    read -p "Devam etmek istediğinizden emin misiniz? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "İşlem iptal edildi."
        exit 1
    fi
    
    # Production için Cloud SQL bağlantı bilgileri
    DB_HOST=${CLOUDSQL_INSTANCE:-"/cloudsql/fresh-inscriber-472521-t7:europe-west1:hobbycollection-db"}
    DB_NAME=${CLOUDSQL_DATABASE:-"hobbycollection"}
    DB_USER=${CLOUDSQL_USER:-"postgres"}
    DB_PASSWORD=${CLOUDSQL_PASSWORD}
    
    if [ -z "$DB_PASSWORD" ]; then
        echo "❌ HATA: CLOUDSQL_PASSWORD environment variable tanımlı değil!"
        exit 1
    fi
    
    echo "Production veritabanına bağlanılıyor..."
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f scripts/apply-private-account-migration.sql
    
else
    # Development için local PostgreSQL
    DB_HOST=${DB_HOST:-"localhost"}
    DB_NAME=${DB_NAME:-"hobbycollection_dev"}
    DB_USER=${DB_USER:-"gokhanmemik"}
    DB_PASSWORD=${DB_PASSWORD:-""}
    
    echo "Development veritabanına bağlanılıyor..."
    echo "Host: $DB_HOST"
    echo "Database: $DB_NAME"
    echo "User: $DB_USER"
    
    if [ -z "$DB_PASSWORD" ]; then
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f scripts/apply-private-account-migration.sql
    else
        PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f scripts/apply-private-account-migration.sql
    fi
fi

echo ""
echo "✅ Migration başarıyla uygulandı!"
echo "Backend'i yeniden başlatabilirsiniz."

