#!/bin/bash

# iOS Simulator'ı Production API'ye bağlayarak başlatma scripti
# Bu script, gerçek verilerle ekran görüntüleri almak için kullanılır

set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PRODUCTION_API_URL="https://api.save-all.com"
DEFAULT_DEVICE="iPhone 15 Pro Max"

echo -e "${BLUE}🚀 iOS Simulator - Production API Bağlantısı${NC}"
echo ""

# Cihaz seçimi
if [ -n "$1" ]; then
  DEVICE="$1"
else
  DEVICE="$DEFAULT_DEVICE"
fi

echo -e "${GREEN}📱 Cihaz: $DEVICE${NC}"
echo -e "${GREEN}🌐 API: $PRODUCTION_API_URL${NC}"
echo ""

# Production API kontrolü
echo -e "${YELLOW}🔍 Production API kontrol ediliyor...${NC}"
if curl -s --head --request GET "$PRODUCTION_API_URL/api/photoanalysis/health" | grep "200 OK" > /dev/null; then
  echo -e "${GREEN}✅ Production API erişilebilir${NC}"
else
  echo -e "${YELLOW}⚠️  Production API kontrol edilemedi (devam ediliyor...)${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}ℹ️  Önemli Bilgiler:${NC}"
echo "  • Production API'ye bağlanacaksınız"
echo "  • Gerçek verilerle çalışacaksınız"
echo "  • Giriş yapmanız gerekecek"
echo ""
echo -e "${YELLOW}📸 Ekran Görüntüleri İçin:${NC}"
echo "  • Uygulama açıldıktan sonra giriş yapın"
echo "  • İstediğiniz ekrana gidin"
echo "  • Cmd + S ile ekran görüntüsü alın"
echo ""
echo -e "${YELLOW}🎥 Video Kaydı İçin:${NC}"
echo "  • Device > Record Screen ile başlatın"
echo "  • 15-30 saniye uygulamada gezin"
echo "  • Device > Stop Recording ile durdurun"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Kullanıcıdan onay bekle
echo -e "${YELLOW}Devam etmek için Enter'a basın...${NC}"
read -r

# Production API ile başlat
echo -e "${GREEN}🚀 Uygulama başlatılıyor...${NC}"
echo ""

cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile

EXPO_PUBLIC_API_BASE_URL="$PRODUCTION_API_URL" npm run ios -- --simulator="$DEVICE"
