#!/bin/bash

# App Store Ekran Görüntüleri Alma Scripti
# Bu script iOS Simulator'da farklı cihazlarda ekran görüntüleri alır
# Production API'ye bağlanarak gerçek verilerle çalışır

set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production API URL
PRODUCTION_API_URL="https://api.save-all.com"

# Çıktı klasörü
OUTPUT_DIR="./screenshots"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FINAL_DIR="${OUTPUT_DIR}/${TIMESTAMP}"

# Kullanılacak cihazlar (App Store gereksinimleri için önemli boyutlar)
DEVICES=(
  "iPhone 15 Pro Max"           # 6.7" - 1290 x 2796
  "iPhone 15 Pro"               # 6.1" - 1179 x 2556
  "iPhone SE (3rd generation)"  # 4.7" - 750 x 1334
  "iPad Pro (12.9-inch) (6th generation)" # 12.9" - 2048 x 2732
)

echo -e "${BLUE}📸 App Store Ekran Görüntüleri Alma Scripti${NC}"
echo -e "${GREEN}🌐 Production API: $PRODUCTION_API_URL${NC}"
echo ""

# Çıktı klasörünü oluştur
mkdir -p "$FINAL_DIR"

echo -e "${YELLOW}ℹ️  Bu script şu adımları izler:${NC}"
echo "  1. Simulator'ı başlatır"
echo "  2. Production API'ye bağlanarak uygulamayı çalıştırır"
echo "  3. Sizden ekran görüntüsü almak için hazır olmanızı bekler"
echo "  4. Ekran görüntüsünü kaydeder"
echo ""
echo -e "${YELLOW}⚠️  Önemli: Production API kullanılıyor - gerçek verilerle çalışacaksınız!${NC}"
echo ""

# Her cihaz için işlem yap
for device in "${DEVICES[@]}"; do
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}📱 Cihaz: $device${NC}"
  echo ""
  
  # Cihazın var olup olmadığını kontrol et
  if ! xcrun simctl list devices available | grep -q "$device"; then
    echo -e "${YELLOW}⚠️  $device bulunamadı, atlanıyor...${NC}"
    echo ""
    continue
  fi
  
  # Simulator'ı başlat
  echo "🔄 Simulator başlatılıyor..."
  xcrun simctl boot "$device" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Simulator zaten çalışıyor veya başlatılamadı${NC}"
  }
  
  # Simulator uygulamasını aç (görsel olarak görmek için)
  open -a Simulator
  
  # Uygulamayı başlat
  echo "🚀 Uygulama başlatılıyor..."
  echo -e "${YELLOW}ℹ️  Uygulama yüklendikten sonra, istediğiniz ekrana gidin ve hazır olduğunuzda Enter'a basın${NC}"
  
  # Arka planda uygulamayı başlat (Production API ile)
  cd /Users/gokhanmemik/Dev/HobbyCollection/Mobile
  EXPO_PUBLIC_API_BASE_URL="$PRODUCTION_API_URL" npm run ios -- --simulator="$device" > /dev/null 2>&1 &
  APP_PID=$!
  
  # Uygulamanın yüklenmesini bekle
  echo "⏳ Uygulama yükleniyor... (10 saniye bekleniyor)"
  sleep 10
  
  # Kullanıcıdan onay bekle
  echo ""
  echo -e "${GREEN}✅ Uygulama hazır!${NC}"
  echo -e "${YELLOW}📸 İstediğiniz ekrana gidin ve hazır olduğunuzda Enter'a basın...${NC}"
  read -r
  
  # Ekran görüntüsü al
  DEVICE_NAME_CLEAN=$(echo "$device" | tr ' ' '_' | tr '(' '' | tr ')' '')
  SCREENSHOT_PATH="${FINAL_DIR}/${DEVICE_NAME_CLEAN}.png"
  
  echo "📸 Ekran görüntüsü alınıyor..."
  xcrun simctl io booted screenshot "$SCREENSHOT_PATH"
  
  if [ -f "$SCREENSHOT_PATH" ]; then
    echo -e "${GREEN}✅ Ekran görüntüsü kaydedildi: $SCREENSHOT_PATH${NC}"
  else
    echo -e "${YELLOW}⚠️  Ekran görüntüsü alınamadı${NC}"
  fi
  
  # Uygulama sürecini durdur
  kill $APP_PID 2>/dev/null || true
  
  # Simulator'ı kapat (opsiyonel - bir sonraki cihaz için açık bırakabilirsiniz)
  echo ""
  echo -e "${YELLOW}❓ Simulator'ı kapatmak ister misiniz? (y/n)${NC}"
  read -r CLOSE_SIM
  if [ "$CLOSE_SIM" = "y" ] || [ "$CLOSE_SIM" = "Y" ]; then
    xcrun simctl shutdown "$device" 2>/dev/null || true
  fi
  
  echo ""
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Tüm ekran görüntüleri tamamlandı!${NC}"
echo -e "${BLUE}📁 Konum: $FINAL_DIR${NC}"
echo ""
echo -e "${YELLOW}📝 Sonraki adımlar:${NC}"
echo "  1. Ekran görüntülerini kontrol edin"
echo "  2. Gerekirse düzenleyin (status bar temizleme, kırpma vb.)"
echo "  3. App Store Connect'e yükleyin"
echo ""
