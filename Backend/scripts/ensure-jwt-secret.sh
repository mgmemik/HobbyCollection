#!/bin/bash

# JWT Key Secret'ını Google Cloud Secret Manager'da kontrol eder ve gerekirse oluşturur
# Bu script, JWT key'in sabit kalmasını garanti eder

set -e

PROJECT_ID="fresh-inscriber-472521-t7"
SECRET_NAME="jwt-key"

echo "🔐 JWT Key Secret Kontrolü Başlatılıyor..."
echo "Project: $PROJECT_ID"
echo "Secret Name: $SECRET_NAME"
echo ""

# Google Cloud projesini ayarla
gcloud config set project $PROJECT_ID

# Secret Manager API'sini etkinleştir
echo "📋 Secret Manager API kontrol ediliyor..."
gcloud services enable secretmanager.googleapis.com 2>/dev/null || true

# Secret'ın var olup olmadığını kontrol et
echo "🔍 Secret kontrol ediliyor..."
if gcloud secrets describe $SECRET_NAME &>/dev/null; then
    echo "✅ Secret '$SECRET_NAME' zaten mevcut"
    
    # Mevcut secret'ın versiyonlarını listele
    echo ""
    echo "📊 Mevcut secret versiyonları:"
    gcloud secrets versions list $SECRET_NAME --format="table(name,state,createTime)" --limit=5
    
    # Latest versiyonun değerini göster (ilk 20 karakter)
    echo ""
    echo "🔑 Latest versiyon key (ilk 20 karakter):"
    LATEST_KEY=$(gcloud secrets versions access latest --secret=$SECRET_NAME 2>/dev/null | head -c 20)
    echo "$LATEST_KEY..."
    
    echo ""
    echo "✅ JWT Key Secret mevcut ve sabit. Yeni versiyon oluşturulmayacak."
    echo "⚠️  ÖNEMLİ: Bu secret'ın değeri değiştirilmemeli!"
    echo "   Eğer değiştirilirse, tüm mevcut token'lar geçersiz olur."
    
else
    echo "⚠️  Secret '$SECRET_NAME' bulunamadı!"
    echo ""
    echo "🔐 Yeni JWT Key oluşturuluyor..."
    
    # 64 karakterlik güvenli random key oluştur
    JWT_KEY=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
    
    echo "✅ JWT Key oluşturuldu (64 karakter)"
    echo ""
    echo "📤 Secret Manager'a ekleniyor..."
    
    # Secret'ı oluştur
    echo -n "$JWT_KEY" | gcloud secrets create $SECRET_NAME \
        --data-file=- \
        --replication-policy="automatic"
    
    echo ""
    echo "✅ Secret başarıyla oluşturuldu!"
    echo ""
    echo "⚠️  ÖNEMLİ NOTLAR:"
    echo "   1. Bu key'i bir yere kaydedin (güvenli bir yerde)"
    echo "   2. Bu key'i ASLA değiştirmeyin (tüm token'lar geçersiz olur)"
    echo "   3. Bu key'i ASLA git'e eklemeyin"
    echo ""
    echo "🔑 Key (ilk 20 karakter): $(echo $JWT_KEY | head -c 20)..."
fi

echo ""
echo "✅ İşlem tamamlandı!"
echo ""
echo "📝 Secret bilgileri:"
gcloud secrets describe $SECRET_NAME --format="yaml(name,createTime,replication.automatic)"

