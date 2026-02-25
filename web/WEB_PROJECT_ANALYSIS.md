# 🌐 Web Projesi Analiz Raporu

## 📊 Mevcut Durum

### Teknoloji Stack
- **Framework:** Next.js 15.5.3 (App Router)
- **React:** 19.1.0
- **TypeScript:** 5.x
- **Styling:** Tailwind CSS 4
- **Internationalization:** next-intl 4.3.9 (kurulu ama kullanılmıyor)
- **Theme:** next-themes 0.4.6 (dark mode desteği)

### Mevcut İçerik
- ✅ Temel Next.js yapısı kurulu
- ✅ Dark/Light theme desteği aktif
- ✅ Basit auth test sayfası (`/src/app/page.tsx`)
  - Register
  - Email verification
  - Login
- ❌ Gerçek bir uygulama yok
- ❌ Backend API entegrasyonu yok (sadece test için)
- ❌ Routing yapısı yok
- ❌ Component library yok

### Backend API Durumu
Backend'de mevcut endpoint'ler:
- ✅ Auth (register, login, verify-email)
- ✅ Products (CRUD, feed, search, like, save, comments)
- ✅ Categories (tree, children, roots)
- ✅ Follows (follow, unfollow, check)
- ✅ Notifications
- ✅ Messages & Conversations
- ✅ AI Credits
- ✅ Photo Analysis
- ✅ User Preferences
- ✅ Privacy Policy
- ✅ Account Deletion

**Admin/Dashboard Endpoint'leri:**
- ⚠️ Sınırlı: PhotoAnalysisController'da `/metrics` endpoint'i var (Authorize gerekli)
- ❌ Genel admin dashboard endpoint'leri yok
- ❌ Kullanıcı yönetimi endpoint'leri yok
- ❌ Raporlama endpoint'leri yok

---

## 🎯 İki Web Arayüzü Planı

### 1️⃣ Public Web Arayüzü (Mobil Uygulama Kullanıcıları İçin)

**Hedef Kitle:** Mobil uygulama kullanıcıları
**Amaç:** Web üzerinden koleksiyonlarına erişim, paylaşım, keşif

#### Özellikler:
- ✅ **Authentication**
  - Login/Register
  - Email verification
  - Password reset
  - Social login (opsiyonel)

- ✅ **Feed & Discovery**
  - Public feed (ürünler)
  - Kategori bazlı keşif
  - Arama
  - Filtreleme (kategori, badge, fiyat)

- ✅ **Product Management**
  - Ürün görüntüleme (detay sayfası)
  - Ürün ekleme/düzenleme
  - Fotoğraf yükleme
  - AI analiz entegrasyonu
  - Badge yönetimi

- ✅ **Social Features**
  - Beğenme/yorum yapma
  - Kullanıcı profilleri
  - Takip/takipçi sistemi
  - Kaydedilen ürünler

- ✅ **User Profile**
  - Profil görüntüleme/düzenleme
  - Koleksiyon görüntüleme
  - İstatistikler (ürün sayısı, beğeni sayısı vb.)

- ✅ **Responsive Design**
  - Mobile-first yaklaşım
  - Tablet ve desktop uyumlu
  - PWA desteği (opsiyonel)

#### Teknik Gereksinimler:
- Next.js App Router
- API Routes (backend entegrasyonu)
- Server Components (performans için)
- Client Components (interaktif öğeler için)
- Image optimization (Next.js Image)
- SEO optimizasyonu

---

### 2️⃣ Admin Dashboard (Kontrol Paneli & Raporlama)

**Hedef Kitle:** Site yöneticileri, admin kullanıcılar
**Amaç:** Platform yönetimi, raporlama, analitik

#### Özellikler:

##### 📊 Dashboard Overview
- Genel istatistikler
  - Toplam kullanıcı sayısı
  - Toplam ürün sayısı
  - Günlük/haftalık/aylık aktivite
  - Yeni kayıtlar
  - Aktif kullanıcılar

- Grafikler ve görselleştirmeler
  - Kullanıcı büyüme grafiği
  - Ürün ekleme trendi
  - Kategori dağılımı
  - Beğeni/yorum istatistikleri

##### 👥 Kullanıcı Yönetimi
- Kullanıcı listesi (sayfalama, filtreleme, arama)
- Kullanıcı detayları
  - Profil bilgileri
  - Ürünleri
  - Aktivite geçmişi
  - AI kredi durumu
- Kullanıcı işlemleri
  - Hesap askıya alma/aktifleştirme
  - Hesap silme
  - Rol yönetimi (opsiyonel)

##### 📦 Ürün Yönetimi
- Ürün listesi
  - Tüm ürünler
  - Rapor edilen ürünler
  - Moderasyon gerektirenler
- Ürün detayları
- Ürün işlemleri
  - Silme
  - Gizleme/gösterme
  - Kategori değiştirme

##### 🏷️ Kategori Yönetimi
- Kategori ağacı görüntüleme
- Kategori ekleme/düzenleme/silme
- Çeviri yönetimi (TR/EN)
- Kategori istatistikleri

##### 💬 Moderasyon
- Yorum moderasyonu
  - Rapor edilen yorumlar
  - Yorum silme/onaylama
- Mesaj moderasyonu (gerekirse)
- Kullanıcı şikayetleri

##### 🤖 AI Credits Yönetimi
- AI kredi paketleri
  - Paket oluşturma/düzenleme
  - Fiyatlandırma
- Kullanıcı kredi durumları
- Kredi kullanım istatistikleri
- Analiz metrikleri (PhotoAnalysisController'dan)

##### 📈 Raporlama & Analitik
- Detaylı raporlar
  - Kullanıcı aktivite raporu
  - Ürün performans raporu
  - Kategori popülerlik raporu
  - AI kullanım raporu
- Export özellikleri (CSV, PDF)
- Tarih aralığı filtreleme
- Özelleştirilebilir raporlar

##### ⚙️ Sistem Ayarları
- Genel ayarlar
- Email ayarları
- API ayarları
- Backup yönetimi
- Log görüntüleme

#### Teknik Gereksinimler:
- **Authentication & Authorization**
  - Admin-only routes
  - Role-based access control (RBAC)
  - JWT token yönetimi

- **Data Visualization**
  - Chart.js veya Recharts
  - Table component (TanStack Table veya benzeri)
  - Date picker

- **UI Components**
  - Admin-friendly component library
  - Form components
  - Modal/Dialog components
  - Toast notifications

- **Backend Geliştirmeleri Gerekli**
  - Admin endpoint'leri
  - Raporlama endpoint'leri
  - İstatistik endpoint'leri
  - Export endpoint'leri

---

## 🏗️ Önerilen Proje Yapısı

```
web/
├── src/
│   ├── app/
│   │   ├── (public)/              # Public web arayüzü
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Feed/Home
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── products/
│   │   │   │   ├── [id]/
│   │   │   │   └── new/
│   │   │   ├── profile/
│   │   │   │   └── [userId]/
│   │   │   ├── search/
│   │   │   └── categories/
│   │   │
│   │   ├── (admin)/               # Admin dashboard
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── users/
│   │   │   ├── products/
│   │   │   ├── categories/
│   │   │   ├── reports/
│   │   │   ├── ai-credits/
│   │   │   └── settings/
│   │   │
│   │   └── api/                   # API routes (gerekirse)
│   │
│   ├── components/
│   │   ├── public/               # Public web components
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Feed.tsx
│   │   │   └── ...
│   │   │
│   │   ├── admin/                # Admin components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── UserTable.tsx
│   │   │   ├── ProductTable.tsx
│   │   │   ├── Charts/
│   │   │   └── ...
│   │   │
│   │   └── shared/               # Ortak components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── api/                  # API client functions
│   │   │   ├── auth.ts
│   │   │   ├── products.ts
│   │   │   ├── users.ts
│   │   │   └── admin.ts
│   │   │
│   │   ├── utils/
│   │   └── constants.ts
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProducts.ts
│   │   └── ...
│   │
│   └── types/                    # TypeScript types
│       ├── api.ts
│       ├── product.ts
│       └── user.ts
│
├── public/
└── package.json
```

---

## 🚀 Geliştirme Planı

### Faz 1: Temel Altyapı (1-2 hafta)
1. ✅ Proje yapısını oluştur
2. ✅ Routing yapısını kur (public/admin ayrımı)
3. ✅ API client library oluştur
4. ✅ Authentication context/hook oluştur
5. ✅ Temel component library kur
6. ✅ Environment variables yapılandır

### Faz 2: Public Web Arayüzü (3-4 hafta)
1. ✅ Authentication sayfaları (login, register)
2. ✅ Feed sayfası
3. ✅ Product detay sayfası
4. ✅ Product ekleme/düzenleme
5. ✅ Profile sayfası
6. ✅ Search & filter
7. ✅ Responsive design

### Faz 3: Admin Dashboard - Backend (2-3 hafta)
1. ⚠️ Admin endpoint'leri oluştur
   - User management endpoints
   - Statistics endpoints
   - Reporting endpoints
   - Export endpoints
2. ⚠️ Role-based authorization ekle
3. ⚠️ Admin user seeder oluştur

### Faz 4: Admin Dashboard - Frontend (3-4 hafta)
1. ✅ Admin authentication
2. ✅ Dashboard overview
3. ✅ User management
4. ✅ Product management
5. ✅ Category management
6. ✅ Reports & analytics
7. ✅ AI Credits management

### Faz 5: Polish & Optimization (1-2 hafta)
1. ✅ Performance optimization
2. ✅ SEO optimization
3. ✅ Error handling
4. ✅ Loading states
5. ✅ Testing

---

## 📋 Öncelikli Görevler

### Hemen Başlanabilir:
1. ✅ Proje yapısını oluştur
2. ✅ API client library oluştur
3. ✅ Authentication flow'u kur
4. ✅ Public web için temel sayfaları oluştur

### Backend Geliştirmeleri Gerekli:
1. ⚠️ Admin endpoint'leri
2. ⚠️ İstatistik endpoint'leri
3. ⚠️ Raporlama endpoint'leri
4. ⚠️ Role-based authorization

---

## 🔧 Teknik Öneriler

### Public Web İçin:
- **UI Library:** shadcn/ui (Tailwind tabanlı, özelleştirilebilir)
- **Form Handling:** React Hook Form + Zod
- **State Management:** React Context + SWR veya TanStack Query
- **Image Optimization:** Next.js Image component
- **SEO:** Next.js Metadata API

### Admin Dashboard İçin:
- **Charts:** Recharts veya Chart.js
- **Tables:** TanStack Table (React Table)
- **Date Picker:** react-datepicker veya date-fns
- **Export:** jsPDF + jsPDF-autotable (PDF), papaparse (CSV)
- **Admin UI:** shadcn/ui + custom admin components

### Ortak:
- **HTTP Client:** Axios veya fetch wrapper
- **Error Handling:** Error boundary + toast notifications
- **Loading States:** Skeleton loaders
- **Internationalization:** next-intl (zaten kurulu)

---

## ❓ Sorular & Kararlar Gerekli

1. **Admin Authentication:**
   - Ayrı admin login mi yoksa normal kullanıcılar admin rolü ile mi giriş yapacak?
   - Admin rolü nasıl belirlenecek? (Backend'de role field var mı?)

2. **Public Web:**
   - PWA desteği isteniyor mu?
   - Social login (Google, Apple) eklenmeli mi?
   - Web'den ürün ekleme zorunlu mu yoksa sadece görüntüleme mi?

3. **Admin Dashboard:**
   - Hangi raporlar öncelikli?
   - Export formatları? (CSV, PDF, Excel?)
   - Real-time updates gerekli mi? (WebSocket?)

4. **Deployment:**
   - Public web ve admin dashboard aynı domain'de mi olacak?
   - Admin dashboard subdomain'de mi olacak? (`admin.save-all.com`)

---

## 📝 Sonuç

Web projesi şu anda **çok temel bir durumda**. İki ayrı web arayüzü için:
- ✅ Temel altyapı hazır (Next.js, Tailwind, TypeScript)
- ⚠️ Backend'de admin endpoint'leri eksik
- ⚠️ Public web için component library ve sayfalar yok
- ⚠️ Admin dashboard için backend ve frontend geliştirmeleri gerekli

**Önerilen Yaklaşım:**
1. Önce public web arayüzünü geliştir (backend API'leri zaten mevcut)
2. Ardından admin dashboard için backend endpoint'lerini ekle
3. Son olarak admin dashboard frontend'ini geliştir

Bu şekilde adım adım ilerleyerek her iki arayüzü de sağlam bir şekilde oluşturabiliriz.

