#!/bin/bash

# Google Cloud Run Deployment Script
# www.save-all.com için

set -e

PROJECT_ID="fresh-inscriber-472521-t7"
REGION="europe-west1"
SERVICE_NAME="save-all-web"
DOMAIN="www.save-all.com"

echo "🚀 Save All Public Website Deployment Başlatılıyor..."
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

# Cloud Build ile deploy
echo "☁️ Cloud Build ile deploy ediliyor..."
gcloud builds submit --config cloudbuild.yaml --project $PROJECT_ID

# Domain mapping kontrol et
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
    echo "   Name: www"
    echo "   Value: (Cloud Run'dan alınan verification değeri)"
    echo ""
    echo "2. CNAME Record:"
    echo "   Type: CNAME"
    echo "   Name: www"
    echo "   Value: ghs.googlehosted.com"
    echo ""
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
echo "  curl https://$DOMAIN"
