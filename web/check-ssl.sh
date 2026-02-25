#!/bin/bash

# SSL Sertifikası Durum Kontrol Script'i

PROJECT_ID="fresh-inscriber-472521-t7"
REGION="europe-west1"

echo "🔒 SSL Sertifikası Durum Kontrolü"
echo "=================================="
echo ""

# Domain mapping durumlarını kontrol et
echo "📊 Domain Mapping Durumları:"
gcloud beta run domain-mappings list \
  --region $REGION \
  --project $PROJECT_ID \
  --format="table(name,status.conditions[0].status,status.conditions[0].message)" 2>&1

echo ""
echo "🌐 DNS Kayıtları Kontrolü:"
echo ""

# Root domain A Records
echo "Root Domain (save-all.com) A Records:"
ROOT_IPS=$(dig @8.8.8.8 save-all.com A +short | sort)
if [ -n "$ROOT_IPS" ]; then
  echo "$ROOT_IPS" | while read ip; do
    echo "  ✅ $ip"
  done
else
  echo "  ❌ A Records bulunamadı"
fi

echo ""
# www CNAME
echo "www Subdomain (www.save-all.com) CNAME:"
WWW_CNAME=$(dig @8.8.8.8 www.save-all.com CNAME +short)
if [ -n "$WWW_CNAME" ]; then
  echo "  ✅ $WWW_CNAME"
else
  echo "  ❌ CNAME bulunamadı"
fi

echo ""
echo "🔐 SSL Sertifikası Testi:"
echo ""

# www SSL test
echo "Testing https://www.save-all.com..."
WWW_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://www.save-all.com 2>/dev/null)
if [ "$WWW_HTTP_CODE" = "200" ] || [ "$WWW_HTTP_CODE" = "301" ] || [ "$WWW_HTTP_CODE" = "302" ]; then
  echo "  ✅ www.save-all.com SSL aktif (HTTP $WWW_HTTP_CODE)"
else
  echo "  ⏳ www.save-all.com SSL henüz aktif değil (HTTP $WWW_HTTP_CODE)"
fi

# Root domain SSL test
echo "Testing https://save-all.com..."
ROOT_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://save-all.com 2>/dev/null)
if [ "$ROOT_HTTP_CODE" = "200" ] || [ "$ROOT_HTTP_CODE" = "301" ] || [ "$ROOT_HTTP_CODE" = "302" ]; then
  echo "  ✅ save-all.com SSL aktif (HTTP $ROOT_HTTP_CODE)"
else
  echo "  ⏳ save-all.com SSL henüz aktif değil (HTTP $ROOT_HTTP_CODE)"
fi

echo ""
echo "=================================="
echo "💡 İpucu: SSL sertifikaları 5-15 dakika içinde otomatik olarak oluşturulur."
echo "   Bu script'i tekrar çalıştırarak durumu kontrol edebilirsiniz:"
echo "   ./check-ssl.sh"
