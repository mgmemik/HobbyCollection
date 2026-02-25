# 🚀 Backend Çalıştırma Kılavuzu

## Hızlı Başlangıç

### 1. Backend'i Çalıştırma

```bash
cd Backend/HobbyCollection.Api
dotnet run
```

Backend varsayılan olarak şu adreste çalışacak:
- **HTTP:** http://localhost:5014
- **HTTPS:** https://localhost:5015

### 2. Swagger UI'ya Erişim

Backend çalıştıktan sonra Swagger UI'ya erişebilirsiniz:
- **Swagger:** http://localhost:5014/swagger

### 3. Test Endpoint'leri

#### Admin Login (Token almak için)
```bash
curl -X POST http://localhost:5014/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "gmemik@gmail.com"}'
```

Response:
```json
{
  "message": "Login successful.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Admin Categories Endpoint (Token ile)
```bash
curl -X GET http://localhost:5014/api/admin/categories \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Gereksinimler

### PostgreSQL
Backend PostgreSQL kullanıyor. PostgreSQL'in çalıştığından emin olun:

```bash
# PostgreSQL servisini başlat
brew services start postgresql@16

# Veya manuel başlat
pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

### Environment Variables
Development ortamı için gerekli ayarlar `appsettings.Development.json` dosyasında.

## Sorun Giderme

### Port Zaten Kullanılıyor
Eğer port 5014 zaten kullanılıyorsa:
```bash
# Process'i bul ve durdur
lsof -ti:5014 | xargs kill -9

# Veya farklı port kullan
dotnet run --urls "http://localhost:5016"
```

### Database Bağlantı Hatası
PostgreSQL'in çalıştığından emin olun:
```bash
# PostgreSQL durumunu kontrol et
brew services list | grep postgresql

# Database'e bağlanmayı test et
psql -h localhost -U gokhanmemik -d hobbycollection_dev
```

### Migration Hatası
Eğer migration uygulanmamışsa:
```bash
# Migration'ları kontrol et
cd Backend/HobbyCollection.Infrastructure
dotnet ef migrations list --startup-project ../HobbyCollection.Api

# Migration uygula (gerekirse)
dotnet ef database update --startup-project ../HobbyCollection.Api
```

## Browser'dan Test Etme

### 1. Swagger UI Kullan
En kolay yöntem Swagger UI:
1. Backend'i çalıştır: `dotnet run`
2. Browser'da aç: http://localhost:5014/swagger
3. `/api/auth/login` endpoint'ine tıkla
4. "Try it out" butonuna tıkla
5. Email gir: `gmemik@gmail.com`
6. "Execute" butonuna tıkla
7. Token'ı kopyala
8. Üstteki "Authorize" butonuna tıkla
9. Token'ı yapıştır: `Bearer YOUR_TOKEN`
10. Admin endpoint'lerini test et

### 2. Postman/Insomnia Kullan
- **Postman:** https://www.postman.com/
- **Insomnia:** https://insomnia.rest/

### 3. Browser Console (JavaScript)
```javascript
// 1. Login yap ve token al
fetch('http://localhost:5014/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'gmemik@gmail.com' })
})
.then(r => r.json())
.then(data => {
  const token = data.accessToken;
  console.log('Token:', token);
  
  // 2. Admin endpoint'ini çağır
  return fetch('http://localhost:5014/api/admin/categories', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
})
.then(r => r.json())
.then(data => console.log('Categories:', data));
```

## Önemli Notlar

- ✅ Backend çalışırken terminal açık kalmalı
- ✅ PostgreSQL servisi çalışıyor olmalı
- ✅ Admin endpoint'leri için token gereklidir
- ✅ Token'ı Authorization header'ında göndermelisiniz: `Bearer TOKEN`

