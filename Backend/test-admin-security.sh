#!/bin/bash

# Admin Güvenlik Test Script'i
# Bu script admin olmayan bir kullanıcı token'ı ile admin endpoint'lerine erişim denemesi yapar

API_BASE_URL="${API_BASE_URL:-http://localhost:5015}"

echo "🔒 Admin Güvenlik Test Başlatılıyor..."
echo "API Base URL: $API_BASE_URL"
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test sonuçları
PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local token=$3
    local description=$4
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            "$API_BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d '{}' \
            "$API_BASE_URL$endpoint")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d '{}' \
            "$API_BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            "$API_BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # 401 veya 403 bekliyoruz (güvenli)
    if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    elif [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code - GÜVENLİK AÇIĞI!)"
        echo "  Response: $body"
        ((FAILED++))
        return 1
    else
        echo -e "${YELLOW}? UNEXPECTED${NC} (HTTP $http_code)"
        echo "  Response: $body"
        return 2
    fi
}

test_no_token() {
    local method=$1
    local endpoint=$2
    local description=$3
    
    echo -n "Testing: $description (No Token) ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "Content-Type: application/json" \
            "$API_BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d '{}' \
            "$API_BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    
    # 401 bekliyoruz
    if [ "$http_code" = "401" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code - Token olmadan erişim mümkün!)"
        ((FAILED++))
        return 1
    fi
}

# Kullanıcıdan normal kullanıcı token'ı al
echo "⚠️  ÖNEMLİ: Bu test için normal bir kullanıcı token'ına ihtiyacınız var."
echo "   Normal bir kullanıcı ile giriş yapıp token'ı alın."
echo ""
read -p "Normal kullanıcı token'ını girin (veya Enter'a basarak test edilecek endpoint'leri gösterin): " NORMAL_USER_TOKEN

if [ -z "$NORMAL_USER_TOKEN" ]; then
    echo ""
    echo "📋 Test Edilecek Endpoint'ler:"
    echo ""
    echo "Category Endpoints:"
    echo "  GET    /api/admin/categories"
    echo "  POST   /api/admin/categories"
    echo "  PUT    /api/admin/categories/{id}"
    echo "  DELETE /api/admin/categories/{id}"
    echo "  POST   /api/admin/categories/{id}/move"
    echo ""
    echo "User Endpoints:"
    echo "  GET    /api/admin/users"
    echo "  GET    /api/admin/users/{id}"
    echo "  PUT    /api/admin/users/{id}"
    echo "  GET    /api/admin/users/statistics"
    echo ""
    echo "Product Endpoints:"
    echo "  GET    /api/admin/products"
    echo "  GET    /api/admin/products/{id}"
    echo "  PUT    /api/admin/products/{id}"
    echo "  DELETE /api/admin/products/{id}"
    echo "  GET    /api/admin/products/statistics"
    echo ""
    echo "Test'i çalıştırmak için normal kullanıcı token'ı ile tekrar çalıştırın."
    exit 0
fi

echo ""
echo "🧪 Testler başlatılıyor..."
echo ""

# Category Endpoints
test_endpoint "GET" "/api/admin/categories" "$NORMAL_USER_TOKEN" "GET /api/admin/categories"
test_endpoint "POST" "/api/admin/categories" "$NORMAL_USER_TOKEN" "POST /api/admin/categories"
test_endpoint "PUT" "/api/admin/categories/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "PUT /api/admin/categories/{id}"
test_endpoint "DELETE" "/api/admin/categories/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "DELETE /api/admin/categories/{id}"
test_endpoint "POST" "/api/admin/categories/00000000-0000-0000-0000-000000000001/move" "$NORMAL_USER_TOKEN" "POST /api/admin/categories/{id}/move"

# User Endpoints
test_endpoint "GET" "/api/admin/users" "$NORMAL_USER_TOKEN" "GET /api/admin/users"
test_endpoint "GET" "/api/admin/users/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "GET /api/admin/users/{id}"
test_endpoint "PUT" "/api/admin/users/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "PUT /api/admin/users/{id}"
test_endpoint "GET" "/api/admin/users/statistics" "$NORMAL_USER_TOKEN" "GET /api/admin/users/statistics"

# Product Endpoints
test_endpoint "GET" "/api/admin/products" "$NORMAL_USER_TOKEN" "GET /api/admin/products"
test_endpoint "GET" "/api/admin/products/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "GET /api/admin/products/{id}"
test_endpoint "PUT" "/api/admin/products/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "PUT /api/admin/products/{id}"
test_endpoint "DELETE" "/api/admin/products/00000000-0000-0000-0000-000000000001" "$NORMAL_USER_TOKEN" "DELETE /api/admin/products/{id}"
test_endpoint "GET" "/api/admin/products/statistics" "$NORMAL_USER_TOKEN" "GET /api/admin/products/statistics"

# Token olmadan testler
echo ""
echo "🔐 Token olmadan testler..."
test_no_token "GET" "/api/admin/categories" "GET /api/admin/categories (No Token)"
test_no_token "GET" "/api/admin/users" "GET /api/admin/users (No Token)"
test_no_token "GET" "/api/admin/products" "GET /api/admin/products (No Token)"

# Özet
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Özeti:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Başarılı: $PASSED${NC}"
echo -e "${RED}✗ Başarısız (Güvenlik Açığı): $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Tüm testler başarılı! Güvenlik açığı bulunamadı.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  GÜVENLİK AÇIĞI TESPİT EDİLDİ!${NC}"
    echo "   Admin olmayan kullanıcılar admin endpoint'lerine erişebiliyor."
    exit 1
fi

