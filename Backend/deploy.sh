#!/bin/bash

# Google Cloud Run Deployment Script
# api.save-all.com için

set -e

PROJECT_ID="fresh-inscriber-472521-t7"
REGION="europe-west1"
SERVICE_NAME="hobbycollection-api"
DOMAIN="api.save-all.com"

echo "🚀 HobbyCollection API Deployment Başlatılıyor..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Domain: $DOMAIN"
echo ""

# Google Cloud projesini kontrol et
echo "📋 Google Cloud projesi kontrol ediliyor..."
gcloud config set project $PROJECT_ID

# Gerekli API'leri etkinleştir
echo "🔧 Gerekli API'ler etkinleştiriliyor..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Database'i Backend/Database'e kopyala (eğer yoksa)
echo "💾 Database kopyalanıyor..."
if [ ! -f "Database/app.db" ]; then
    mkdir -p Database
    cp ../Database/app.db Database/app.db 2>/dev/null || echo "⚠️  Database kopyalanamadı, mevcut database kullanılacak"
fi

# Docker image build ve push
echo "🐳 Docker image build ediliyor..."
cd HobbyCollection.Api
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest -f Dockerfile ..

echo "📤 Docker image Google Container Registry'ye push ediliyor..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# JWT Key oluştur (eğer yoksa) - Production'da sabit kalması için
JWT_KEY_FILE=".jwt_key"
if [ ! -f "$JWT_KEY_FILE" ]; then
    echo "🔐 Yeni JWT key oluşturuluyor..."
    # 64 karakterlik güvenli random key oluştur
    JWT_KEY=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
    echo "$JWT_KEY" > "$JWT_KEY_FILE"
    echo "✅ JWT key oluşturuldu ve $JWT_KEY_FILE dosyasına kaydedildi"
    echo "⚠️  Bu dosyayı ASLA git'e eklemeyin! (.gitignore'da olduğundan emin olun)"
else
    JWT_KEY=$(cat "$JWT_KEY_FILE")
    echo "✅ Mevcut JWT key kullanılıyor"
fi

# Cloud Run deploy
echo "☁️ Cloud Run'a deploy ediliyor..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "ASPNETCORE_ENVIRONMENT=Production,Jwt__Key=$JWT_KEY"

# Domain mapping oluştur (eğer yoksa)
echo "🌐 Domain mapping kontrol ediliyor..."
if ! gcloud run domain-mappings describe $DOMAIN --region $REGION &>/dev/null; then
    echo "📝 Domain mapping oluşturuluyor..."
    gcloud run domain-mappings create \
      --service $SERVICE_NAME \
      --domain $DOMAIN \
      --region $REGION
    
    echo ""
    echo "⚠️  DNS KAYITLARI GEREKLİ!"
    echo "Domain sağlayıcınızda şu kayıtları ekleyin:"
    echo ""
    echo "1. TXT Record:"
    echo "   Type: TXT"
    echo "   Name: api"
    echo "   Value: (Cloud Run'dan alınan verification değeri)"
    echo ""
    echo "2. CNAME Record:"
    echo "   Type: CNAME"
    echo "   Name: api"
    echo "   Value: ghs.googlehosted.com"
    echo ""
    echo "Detaylı bilgi için: Backend/HobbyCollection.Api/DNS_SETUP.md"
else
    echo "✅ Domain mapping zaten mevcut"
fi

# Service URL'i göster
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
echo ""
echo "✅ Deployment tamamlandı!"
echo "📍 Service URL: $SERVICE_URL"
echo "🌐 Custom Domain: https://$DOMAIN"
echo ""
echo "Test için:"
echo "  curl https://$DOMAIN/api/health"

