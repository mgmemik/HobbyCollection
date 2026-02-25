#!/bin/bash

# DNS Setup Script for backoffice.save-all.com
# Bu script DNS kayıtları için gerekli bilgileri toplar ve GoDaddy'de yapılacakları gösterir

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-fresh-inscriber-472521-t7}"
REGION="europe-west1"
SERVICE_NAME="backoffice-admin"
DOMAIN="backoffice.save-all.com"

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 DNS Setup Script - backoffice.save-all.com${NC}"
echo ""

# Google Cloud project kontrolü
echo -e "${YELLOW}📋 Google Cloud projesi kontrol ediliyor...${NC}"
if ! gcloud config get-value project &>/dev/null; then
    echo -e "${RED}❌ HATA: Google Cloud projesi set edilmemiş${NC}"
    echo "   Şu komutu çalıştırın:"
    echo "   export GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
    echo "   gcloud config set project $PROJECT_ID"
    exit 1
fi

CURRENT_PROJECT=$(gcloud config get-value project)
echo -e "${GREEN}✅ Proje: $CURRENT_PROJECT${NC}"
echo ""

# Cloud Run servis kontrolü
echo -e "${YELLOW}🔍 Cloud Run servisi kontrol ediliyor...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
    echo -e "${RED}❌ HATA: Cloud Run servisi bulunamadı: $SERVICE_NAME${NC}"
    echo ""
    echo "   Önce deploy yapmanız gerekiyor:"
    echo "   cd web-admin"
    echo "   ./deploy.sh production"
    exit 1
fi

echo -e "${GREEN}✅ Cloud Run servisi bulundu${NC}"
echo -e "   URL: ${BLUE}$SERVICE_URL${NC}"
echo ""

# Domain'den sadece hostname'i çıkar (https:// ve path'i kaldır)
CLOUD_RUN_HOSTNAME=$(echo $SERVICE_URL | sed 's|https://||' | sed 's|/.*||')
echo -e "${GREEN}📝 Cloud Run Hostname: ${BLUE}$CLOUD_RUN_HOSTNAME${NC}"
echo ""

# Domain mapping kontrolü
echo -e "${YELLOW}🔍 Domain mapping kontrol ediliyor...${NC}"
DOMAIN_MAPPING_EXISTS=$(gcloud run domain-mappings describe $DOMAIN --region=$REGION --format='value(metadata.name)' 2>/dev/null || echo "")

if [ -z "$DOMAIN_MAPPING_EXISTS" ]; then
    echo -e "${YELLOW}⚠️  Domain mapping henüz oluşturulmamış${NC}"
    echo ""
    echo -e "${BLUE}📝 Domain mapping oluşturuluyor...${NC}"
    
    gcloud beta run domain-mappings create \
      --service=$SERVICE_NAME \
      --domain=$DOMAIN \
      --region=$REGION
    
    echo ""
    echo -e "${GREEN}✅ Domain mapping oluşturuldu${NC}"
    echo ""
    echo -e "${YELLOW}⏳ Domain mapping'in aktif olması için birkaç dakika bekleyin...${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Domain mapping zaten mevcut${NC}"
fi

# Domain mapping detaylarını al
echo -e "${YELLOW}📋 Domain mapping detayları alınıyor...${NC}"
MAPPING_STATUS=$(gcloud run domain-mappings describe $DOMAIN --region=$REGION --format='value(status.conditions[0].status)' 2>/dev/null || echo "UNKNOWN")
MAPPING_MESSAGE=$(gcloud run domain-mappings describe $DOMAIN --region=$REGION --format='value(status.conditions[0].message)' 2>/dev/null || echo "")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📋 GoDaddy DNS Kayıtları${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GoDaddy'de aşağıdaki DNS kayıtlarını ekleyin:"
echo ""
echo -e "${GREEN}1. CNAME Kaydı:${NC}"
echo "   ┌─────────────────────────────────────────────────────────────┐"
echo "   │ Type:    CNAME                                               │"
echo "   │ Name:    backoffice                                          │"
echo "   │ Value:   $CLOUD_RUN_HOSTNAME"
printf "   │ TTL:     600 (10 dakika)                                    │\n"
echo "   └─────────────────────────────────────────────────────────────┘"
echo ""

# Eğer verification gerekiyorsa
if [ "$MAPPING_STATUS" != "True" ] && [ -n "$MAPPING_MESSAGE" ]; then
    echo -e "${YELLOW}⚠️  Domain Verification Gerekli${NC}"
    echo ""
    echo "Google Cloud domain ownership verification yapıyor."
    echo "Aşağıdaki TXT kaydını eklemeniz gerekebilir:"
    echo ""
    echo -e "${GREEN}2. TXT Kaydı (Eğer verification gerekiyorsa):${NC}"
    echo "   ┌─────────────────────────────────────────────────────────────┐"
    echo "   │ Type:    TXT                                                │"
    echo "   │ Name:    backoffice                                          │"
    echo "   │ Value:   [Google Cloud'dan verilen verification değeri]    │"
    echo "   │ TTL:     600                                                 │"
    echo "   └─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "Verification değerini görmek için:"
    echo "   gcloud run domain-mappings describe $DOMAIN --region=$REGION"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}📝 GoDaddy'de Yapılacaklar:${NC}"
echo ""
echo "1. GoDaddy hesabınıza giriş yapın: https://www.godaddy.com"
echo "2. 'My Products' → 'Domains' → 'save-all.com' → 'DNS' sekmesine gidin"
echo "3. 'Add' butonuna tıklayın"
echo "4. CNAME kaydını ekleyin:"
echo "   - Type: CNAME"
echo "   - Name: backoffice"
echo "   - Value: $CLOUD_RUN_HOSTNAME"
echo "   - TTL: 600"
echo "5. 'Save' butonuna tıklayın"
echo ""
echo -e "${YELLOW}⏳ DNS propagation için 5-10 dakika bekleyin${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}🧪 Test Komutları:${NC}"
echo ""
echo "# DNS kaydını kontrol edin:"
echo "dig backoffice.save-all.com CNAME"
echo ""
echo "# Farklı DNS sunucularından kontrol:"
echo "dig @8.8.8.8 backoffice.save-all.com CNAME"
echo "dig @1.1.1.1 backoffice.save-all.com CNAME"
echo ""
echo "# Web sitesini test edin:"
echo "curl -I https://backoffice.save-all.com"
echo ""
echo "# Domain mapping durumunu kontrol edin:"
echo "gcloud run domain-mappings describe $DOMAIN --region=$REGION"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# DNS kaydını kontrol et
echo -e "${YELLOW}🔍 Mevcut DNS kaydını kontrol ediliyor...${NC}"
CURRENT_CNAME=$(dig +short backoffice.save-all.com CNAME 2>/dev/null || echo "")

if [ -n "$CURRENT_CNAME" ]; then
    echo -e "${GREEN}✅ DNS kaydı bulundu: $CURRENT_CNAME${NC}"
    
    # CNAME'in doğru olup olmadığını kontrol et
    if echo "$CURRENT_CNAME" | grep -q "$CLOUD_RUN_HOSTNAME"; then
        echo -e "${GREEN}✅ DNS kaydı doğru görünüyor${NC}"
    else
        echo -e "${YELLOW}⚠️  DNS kaydı farklı bir değere işaret ediyor${NC}"
        echo "   Mevcut: $CURRENT_CNAME"
        echo "   Beklenen: $CLOUD_RUN_HOSTNAME"
        echo "   GoDaddy'de DNS kaydını güncelleyin"
    fi
else
    echo -e "${YELLOW}⚠️  DNS kaydı henüz görünmüyor (propagation bekleniyor olabilir)${NC}"
fi

echo ""
echo -e "${GREEN}✅ DNS setup script'i tamamlandı!${NC}"
echo ""

