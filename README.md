# HobbyCollection Monorepo

## Yapı
- `Backend/`: .NET 8 Web API (Identity + SQLite)
- `Mobile/`: Expo React Native (TypeScript, tema + i18n)
- `web/`: Next.js (TS, App Router, Tailwind, next-intl, next-themes)
- `Database/`: SQLite dosyası (`app.db`)

## Çalıştırma
### Backend
```bash
cd Backend
# İlk çalıştırma veritabanını oluşturur (EnsureCreated)
dotnet run --project HobbyCollection.Api
```
Varsayılan bağlantı: `Data Source=/Users/gokhanmemik/Desktop/HobbyCollection/Database/app.db`

### Mobile
```bash
cd Mobile
npm install
npm run ios # veya npm run android / npm run web
```

### Web
```bash
cd web
npm run dev
```

## Kimlik Doğrulama (modern email-code)
- Register: `POST /api/auth/register` body: `{ "email": "user@example.com" }`
  - Dönüş: doğrulama kodu (geliştirme amaçlı response içinde)
- Verify: `POST /api/auth/verify-email` body: `{ "email": "...", "code": "..." }`
- Login: `POST /api/auth/login` body: `{ "email": "..." }` → JWT `accessToken`

## Notlar
- Çok dillilik (10+ dil) temel altyapı hazır: Mobile (i18next), Web (next-intl)
- Tema: Mobile `ThemeContext`, Web `next-themes` ile dark/light destekli
- SQLite verisi `Database/app.db` içinde tutulur
