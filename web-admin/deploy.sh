#!/bin/bash

# Admin Panel Deployment Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e

ENVIRONMENT=${1:-production}
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"

echo "🚀 Admin Panel Deployment Başlatılıyor..."
echo "Environment: $ENVIRONMENT"
echo "Project ID: $PROJECT_ID"
echo ""

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Environment variables kontrolü
if [ -z "$GOOGLE_CLOUD_PROJECT" ] && [ "$PROJECT_ID" = "your-project-id" ]; then
    echo -e "${RED}❌ HATA: GOOGLE_CLOUD_PROJECT environment variable'ı set edilmemiş${NC}"
    echo "   Örnek: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

# Build kontrolü
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ HATA: package.json bulunamadı. Script web-admin dizininde çalıştırılmalı.${NC}"
    exit 1
fi

# Environment file kontrolü
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  UYARI: .env.production dosyası bulunamadı.${NC}"
    echo "   Oluşturuluyor..."
    cat > .env.production << EOF
NEXT_PUBLIC_API_BASE_URL=https://api.save-all.com
EOF
    echo -e "${GREEN}✅ .env.production dosyası oluşturuldu${NC}"
fi

# Google Cloud SDK kontrolü
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ HATA: Google Cloud SDK (gcloud) yüklü değil${NC}"
    echo "   Yükleme: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Not: Docker local'de gerekli değil. Cloud Build kendi içinde Docker ile image build eder.

# Google Cloud authentication kontrolü
echo "🔐 Google Cloud authentication kontrol ediliyor..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  Google Cloud'da giriş yapılmamış${NC}"
    echo "   Giriş yapılıyor..."
    gcloud auth login
fi

# Project set etme
echo "📦 Google Cloud projesi set ediliyor: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Container Registry API kontrolü
echo "🔍 Container Registry API kontrol ediliyor..."
if ! gcloud services list --enabled --filter="name:containerregistry.googleapis.com" | grep -q containerregistry; then
    echo "📦 Container Registry API etkinleştiriliyor..."
    gcloud services enable containerregistry.googleapis.com
fi

# Cloud Run API kontrolü
echo "🔍 Cloud Run API kontrol ediliyor..."
if ! gcloud services list --enabled --filter="name:run.googleapis.com" | grep -q run; then
    echo "📦 Cloud Run API etkinleştiriliyor..."
    gcloud services enable run.googleapis.com
fi

# Cloud Build API kontrolü
echo "🔍 Cloud Build API kontrol ediliyor..."
if ! gcloud services list --enabled --filter="name:cloudbuild.googleapis.com" | grep -q cloudbuild; then
    echo "📦 Cloud Build API etkinleştiriliyor..."
    gcloud services enable cloudbuild.googleapis.com
fi

# Build ve deploy
echo ""
echo "🏗️  Build başlatılıyor..."
gcloud builds submit --config=cloudbuild.yaml .

echo ""
echo -e "${GREEN}✅ Deployment tamamlandı!${NC}"
echo ""
echo "📋 Sonraki Adımlar:"
echo "1. Cloud Run servis URL'ini alın:"
echo "   gcloud run services describe backoffice-admin --region=europe-west1 --format='value(status.url)'"
echo ""
echo "2. Domain mapping yapın (backoffice.save-all.com):"
echo "   gcloud run domain-mappings create --service=backoffice-admin --domain=backoffice.save-all.com --region=europe-west1"
echo ""
echo "3. DNS kayıtlarını kontrol edin (GoDaddy'de)"
echo ""

