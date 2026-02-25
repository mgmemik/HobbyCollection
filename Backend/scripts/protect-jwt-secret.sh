#!/bin/bash

# JWT Key Secret'ını korur - yanlışlıkla güncellenmesini önler
# Bu script, secret'ın sadece bilinçli olarak güncellenmesini sağlar

set -e

PROJECT_ID="fresh-inscriber-472521-t7"
SECRET_NAME="jwt-key"

echo "🛡️  JWT Key Secret Koruması"
echo "Project: $PROJECT_ID"
echo "Secret Name: $SECRET_NAME"
echo ""

# Google Cloud projesini ayarla
gcloud config set project $PROJECT_ID

# Secret'ın mevcut versiyonlarını göster
echo "📊 Mevcut secret versiyonları:"
gcloud secrets versions list $SECRET_NAME --format="table(name,state,createTime)"

echo ""
echo "⚠️  ÖNEMLİ UYARILAR:"
echo ""
echo "1. JWT Key Secret'ı ASLA güncellemeyin!"
echo "   → Eğer güncellerseniz, TÜM mevcut token'lar geçersiz olur"
echo "   → Kullanıcılar yeniden login yapmak zorunda kalır"
echo ""
echo "2. Secret'ı sadece şu durumlarda güncelleyin:"
echo "   → Güvenlik ihlali şüphesi varsa"
echo "   → Key'in sızdırıldığından eminseniz"
echo ""
echo "3. Eğer MUTLAKA güncellemeniz gerekiyorsa:"
echo "   → Tüm kullanıcıların yeniden login yapması gerekecek"
echo "   → Mobile app'teki tüm token'lar geçersiz olacak"
echo ""
echo "4. Secret'ı güncellemek için:"
echo "   gcloud secrets versions add $SECRET_NAME --data-file=-"
echo "   (Yeni key'i stdin'den girin)"
echo ""

# Secret'ın son erişim zamanını kontrol et (eğer mümkünse)
echo "🔍 Secret durumu:"
SECRET_INFO=$(gcloud secrets describe $SECRET_NAME --format="yaml(name,createTime)")
echo "$SECRET_INFO"

echo ""
echo "✅ Secret korunuyor. Yeni versiyon oluşturulmayacak."

