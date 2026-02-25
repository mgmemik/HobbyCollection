#!/bin/bash
# HobbyCollection - GitHub'a gönderme scripti
# Önce: gh auth login ile giriş yapın (henüz yapmadıysanız)

set -e
cd "$(dirname "$0")"

echo "=== GitHub Repo Oluşturma ==="

# gh auth durumunu kontrol et
if ! gh auth status &>/dev/null; then
    echo ""
    echo "GitHub CLI ile giriş yapmanız gerekiyor. Şimdi açılacak tarayıcıda giriş yapın:"
    echo ""
    gh auth login
fi

# Repo oluştur (yoksa) ve push et
echo ""
echo "Repo oluşturuluyor ve push ediliyor..."
gh repo create gmemik/HobbyCollection --public --source=. --remote=origin --push

echo ""
echo "✅ Tamamlandı! Projeniz GitHub'da: https://github.com/gmemik/HobbyCollection"
