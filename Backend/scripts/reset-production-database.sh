#!/bin/bash

# Production Database Reset Script
# Bu script Cloud Storage'daki production database'ini siler
# Sonraki deployment'ta boş bir database otomatik oluşturulacak

set -e

echo "⚠️  UYARI: Bu script production database'ini silecek!"
echo "Devam etmek istiyor musunuz? (yes/no)"
read -r confirmation

if [ "$confirmation" != "yes" ]; then
    echo "İşlem iptal edildi."
    exit 0
fi

# Google Cloud proje bilgileri
PROJECT_ID="fresh-inscriber-472521-t7"
BUCKET_NAME="hc-uploads-557805993095"
OBJECT_NAME="database/app.db"

echo ""
echo "📦 Cloud Storage'daki database siliniyor..."
echo "   Bucket: $BUCKET_NAME"
echo "   Object: $OBJECT_NAME"
echo ""

# Database'i sil
gcloud storage rm "gs://$BUCKET_NAME/$OBJECT_NAME" --project="$PROJECT_ID"

if [ $? -eq 0 ]; then
    echo "✅ Database başarıyla silindi!"
    echo ""
    echo "📝 Sonraki adımlar:"
    echo "   1. Yeni bir deployment yapın"
    echo "   2. Container başladığında boş bir database oluşturulacak"
    echo "   3. Migration'lar otomatik çalışacak"
    echo "   4. Seeders çalışacak (Categories ve Brands)"
    echo ""
    echo "⚠️  NOT: Tüm kullanıcı verileri silindi!"
else
    echo "❌ Hata: Database silinemedi!"
    exit 1
fi

