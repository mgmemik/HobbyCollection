#!/bin/bash

# Migration uygulama scripti (.NET EF Core kullanarak)
# Hem dev hem production ortamında kullanılabilir

set -e  # Hata durumunda dur

echo "=========================================="
echo "Migration Uygulanıyor: AddPrivateAccountAndFollowStatus"
echo "=========================================="

cd "$(dirname "$0")/.."

# Environment kontrolü
ENVIRONMENT=${ASPNETCORE_ENVIRONMENT:-Development}

if [ "$ENVIRONMENT" = "Production" ]; then
    echo "⚠️  PRODUCTION ortamı tespit edildi!"
    read -p "Devam etmek istediğinizden emin misiniz? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "İşlem iptal edildi."
        exit 1
    fi
    export ASPNETCORE_ENVIRONMENT=Production
else
    export ASPNETCORE_ENVIRONMENT=Development
fi

echo "Migration uygulanıyor..."
cd HobbyCollection.Api

# dotnet ef database update komutunu kullan
# Eğer dotnet-ef yüklü değilse, migration'ı manuel SQL ile uygula
if command -v dotnet-ef &> /dev/null || dotnet ef --version &> /dev/null; then
    echo "dotnet-ef bulundu, migration uygulanıyor..."
    dotnet ef database update --project ../HobbyCollection.Infrastructure
else
    echo "⚠️  dotnet-ef bulunamadı. Manuel SQL script'i kullanılacak."
    echo ""
    echo "Lütfen şu SQL script'ini veritabanınızda çalıştırın:"
    echo "  Backend/scripts/apply-private-account-migration.sql"
    echo ""
    echo "Veya dotnet-ef tool'unu yükleyin:"
    echo "  dotnet tool install --global dotnet-ef"
    exit 1
fi

echo ""
echo "✅ Migration başarıyla uygulandı!"

