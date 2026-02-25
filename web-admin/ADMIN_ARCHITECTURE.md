# 🎛️ Admin Web Projesi Mimari Dokümantasyonu

## 📋 Genel Bakış

Admin web projesi, platform yönetimi ve raporlama için ayrı bir Next.js uygulaması olacak. Subdomain üzerinde çalışacak (`admin.save-all.com` veya benzeri).

---

## 🏗️ Proje Yapısı

```
web-admin/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout (auth check)
│   │   ├── page.tsx                 # Redirect to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx             # Admin login
│   │   │
│   │   ├── (admin)/                 # Protected admin routes
│   │   │   ├── layout.tsx           # Admin layout (sidebar, header)
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx         # Dashboard overview
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── page.tsx         # User list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # User detail
│   │   │   │
│   │   │   ├── products/
│   │   │   │   ├── page.tsx         # Product list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Product detail
│   │   │   │
│   │   │   ├── categories/
│   │   │   │   └── page.tsx         # Category management
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx         # Reports overview
│   │   │   │   ├── users/
│   │   │   │   ├── products/
│   │   │   │   └── analytics/
│   │   │   │
│   │   │   ├── ai-credits/
│   │   │   │   ├── page.tsx         # AI Credits overview
│   │   │   │   ├── packages/
│   │   │   │   └── usage/
│   │   │   │
│   │   │   └── settings/
│   │   │       └── page.tsx         # System settings
│   │   │
│   │   └── api/                      # API routes (gerekirse)
│   │       └── auth/
│   │           └── logout/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Admin sidebar navigation
│   │   │   ├── Header.tsx            # Admin header (user menu, notifications)
│   │   │   └── AdminLayout.tsx      # Main admin layout wrapper
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx        # Statistic cards
│   │   │   ├── ActivityChart.tsx    # Activity charts
│   │   │   ├── RecentActivity.tsx   # Recent activity list
│   │   │   └── QuickActions.tsx     # Quick action buttons
│   │   │
│   │   ├── users/
│   │   │   ├── UserTable.tsx        # User data table
│   │   │   ├── UserFilters.tsx      # User filters
│   │   │   ├── UserDetail.tsx       # User detail view
│   │   │   └── UserActions.tsx      # User action buttons (suspend, delete)
│   │   │
│   │   ├── products/
│   │   │   ├── ProductTable.tsx
│   │   │   ├── ProductFilters.tsx
│   │   │   └── ProductDetail.tsx
│   │   │
│   │   ├── categories/
│   │   │   ├── CategoryTree.tsx     # Category tree view
│   │   │   ├── CategoryForm.tsx    # Add/edit category form
│   │   │   └── CategoryTranslations.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── ReportFilters.tsx    # Date range, filters
│   │   │   ├── ReportChart.tsx      # Chart component
│   │   │   ├── ReportTable.tsx      # Report data table
│   │   │   └── ExportButton.tsx    # Export to CSV/PDF
│   │   │
│   │   ├── ai-credits/
│   │   │   ├── CreditPackages.tsx
│   │   │   ├── CreditUsage.tsx
│   │   │   └── CreditMetrics.tsx
│   │   │
│   │   └── shared/
│   │       ├── Button.tsx           # Reusable button
│   │       ├── Input.tsx             # Form input
│   │       ├── Select.tsx            # Select dropdown
│   │       ├── Table.tsx             # Data table component
│   │       ├── Modal.tsx             # Modal dialog
│   │       ├── Toast.tsx             # Toast notifications
│   │       ├── Loading.tsx           # Loading spinner
│   │       ├── EmptyState.tsx        # Empty state
│   │       ├── DatePicker.tsx        # Date picker
│   │       └── Chart.tsx             # Chart wrapper
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts             # API client (axios/fetch wrapper)
│   │   │   ├── auth.ts               # Auth API calls
│   │   │   ├── admin/
│   │   │   │   ├── users.ts          # User management API
│   │   │   │   ├── products.ts       # Product management API
│   │   │   │   ├── categories.ts     # Category management API
│   │   │   │   ├── reports.ts        # Reports API
│   │   │   │   ├── statistics.ts     # Statistics API
│   │   │   │   └── ai-credits.ts    # AI Credits API
│   │   │   └── types.ts              # API response types
│   │   │
│   │   ├── auth/
│   │   │   ├── middleware.ts         # Auth middleware
│   │   │   ├── session.ts            # Session management
│   │   │   └── admin-check.ts        # Admin check utility
│   │   │
│   │   ├── utils/
│   │   │   ├── format.ts             # Format utilities (date, currency)
│   │   │   ├── validation.ts         # Validation utilities
│   │   │   └── export.ts             # Export utilities (CSV, PDF)
│   │   │
│   │   └── constants.ts             # Constants
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                # Auth hook
│   │   ├── useAdmin.ts               # Admin check hook
│   │   ├── useUsers.ts               # Users data hook
│   │   ├── useProducts.ts            # Products data hook
│   │   ├── useStatistics.ts          # Statistics hook
│   │   └── useReports.ts             # Reports hook
│   │
│   ├── types/
│   │   ├── user.ts                   # User types
│   │   ├── product.ts                # Product types
│   │   ├── admin.ts                  # Admin types
│   │   └── api.ts                    # API types
│   │
│   └── styles/
│       └── globals.css                # Global styles
│
├── public/
│   └── favicon.ico
│
├── .env.local                        # Environment variables
├── .env.example
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🔐 Authentication & Authorization

### Backend Değişiklikleri

#### 1. ApplicationUser'a IsAdmin Field Ekleme

```csharp
// Backend/HobbyCollection.Infrastructure/ApplicationUser.cs
public class ApplicationUser : IdentityUser
{
    // ... mevcut fields ...
    
    // Admin yetkisi (database'de manuel olarak true yapılacak)
    public bool IsAdmin { get; set; } = false;
}
```

#### 2. Migration Oluşturma

```bash
cd Backend/HobbyCollection.Infrastructure
dotnet ef migrations add AddIsAdminToUser
dotnet ef database update
```

#### 3. Admin Authorization Attribute

```csharp
// Backend/HobbyCollection.Api/Attributes/AdminAuthorizeAttribute.cs
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminAuthorizeAttribute : AuthorizeAttribute
{
    public AdminAuthorizeAttribute()
    {
        Policy = "AdminOnly";
    }
}
```

#### 4. Admin Policy Oluşturma

```csharp
// Backend/HobbyCollection.Api/Program.cs
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAssertion(context =>
        {
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return false;
            
            // Database'den kullanıcının IsAdmin durumunu kontrol et
            using var scope = builder.Services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = db.Users.Find(userId);
            return user?.IsAdmin == true;
        });
    });
});
```

#### 5. JWT Token'a Admin Claim Ekleme

```csharp
// Backend/HobbyCollection.Api/Controllers/AuthController.cs
private string GenerateJwt(ApplicationUser user, bool rememberMe = false)
{
    // ... mevcut kod ...
    
    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id),
        new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
        new("isAdmin", user.IsAdmin.ToString()) // Admin claim ekle
    };
    
    // ... rest of the code ...
}
```

### Frontend Authentication

#### 1. Auth Context

```typescript
// src/lib/auth/session.ts
export interface AdminSession {
  token: string;
  userId: string;
  email: string;
  isAdmin: boolean;
}

export function getSession(): AdminSession | null {
  // Cookie veya localStorage'dan token al
  // JWT decode edip admin bilgisini kontrol et
}
```

#### 2. Auth Middleware

```typescript
// src/lib/auth/middleware.ts
export function requireAdmin(request: NextRequest): NextResponse | null {
  const session = getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return null;
}
```

#### 3. Protected Route Layout

```typescript
// src/app/(admin)/layout.tsx
export default async function AdminLayout({ children }) {
  const session = await getServerSession();
  
  if (!session || !session.isAdmin) {
    redirect('/login');
  }
  
  return (
    <AdminLayoutComponent>
      {children}
    </AdminLayoutComponent>
  );
}
```

---

## 🔌 Backend API Endpoints

### Admin Controller Yapısı

```
/api/admin/
├── GET    /dashboard/stats          # Dashboard istatistikleri
├── GET    /users                   # Kullanıcı listesi (pagination, filter)
├── GET    /users/{id}              # Kullanıcı detayı
├── PUT    /users/{id}/suspend     # Kullanıcıyı askıya al
├── PUT    /users/{id}/activate     # Kullanıcıyı aktifleştir
├── DELETE /users/{id}               # Kullanıcıyı sil
├── PUT    /users/{id}/admin        # Admin yetkisi ver/al
├── GET    /products                # Ürün listesi
├── GET    /products/{id}           # Ürün detayı
├── DELETE /products/{id}            # Ürün sil
├── GET    /categories              # Kategori listesi
├── POST   /categories               # Kategori ekle
├── PUT    /categories/{id}         # Kategori düzenle
├── DELETE /categories/{id}          # Kategori sil
├── GET    /reports/users            # Kullanıcı raporu
├── GET    /reports/products         # Ürün raporu
├── GET    /reports/analytics        # Analitik raporu
├── GET    /ai-credits/packages      # AI kredi paketleri
├── POST   /ai-credits/packages      # Paket ekle
├── PUT    /ai-credits/packages/{id} # Paket düzenle
└── GET    /ai-credits/usage         # Kullanım istatistikleri
```

---

## 📊 Dashboard Özellikleri

### Overview Cards
- Toplam Kullanıcı Sayısı
- Toplam Ürün Sayısı
- Bugün Eklenen Ürünler
- Aktif Kullanıcılar (son 24 saat)
- Toplam Beğeni Sayısı
- Toplam Yorum Sayısı

### Charts
- Kullanıcı Büyüme Grafiği (aylık/haftalık/günlük)
- Ürün Ekleme Trendi
- Kategori Dağılımı (pie chart)
- Aktiflik Grafiği (günlük aktivite)

### Recent Activity
- Son kayıtlar
- Son eklenen ürünler
- Son yorumlar
- Sistem olayları

---

## 🎨 UI/UX Tasarım

### Design System
- **Color Scheme:** Dark mode öncelikli (admin için)
- **Component Library:** shadcn/ui (Tailwind tabanlı)
- **Icons:** Lucide React veya Heroicons
- **Charts:** Recharts
- **Tables:** TanStack Table (React Table)

### Layout
- **Sidebar:** Sol tarafta sabit sidebar (collapsible)
- **Header:** Üstte header (user menu, notifications)
- **Content:** Ana içerik alanı (scrollable)

### Responsive
- Desktop-first yaklaşım
- Tablet ve mobile için responsive (opsiyonel)

---

## 📦 Teknoloji Stack

### Core
- **Framework:** Next.js 15.5+ (App Router)
- **React:** 19.x
- **TypeScript:** 5.x
- **Styling:** Tailwind CSS 4

### UI Components
- **Component Library:** shadcn/ui
- **Icons:** Lucide React
- **Charts:** Recharts
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod
- **Date Picker:** react-datepicker veya date-fns

### State Management
- **Server State:** TanStack Query (React Query)
- **Client State:** React Context + useState
- **Form State:** React Hook Form

### HTTP Client
- **API Client:** Axios veya fetch wrapper
- **Error Handling:** Error boundary + toast

### Utilities
- **Date:** date-fns
- **Export:** jsPDF + jsPDF-autotable (PDF), papaparse (CSV)
- **Validation:** Zod

---

## 🚀 Geliştirme Planı

### Faz 1: Temel Altyapı (1 hafta)
1. ✅ Proje oluştur (Next.js)
2. ✅ Temel yapıyı kur
3. ✅ Authentication altyapısı
4. ✅ API client library
5. ✅ Temel layout (sidebar, header)

### Faz 2: Backend Geliştirmeleri (1 hafta)
1. ⚠️ ApplicationUser'a IsAdmin field ekle
2. ⚠️ Migration oluştur
3. ⚠️ Admin authorization policy
4. ⚠️ AdminController oluştur
5. ⚠️ Admin endpoint'leri implement et

### Faz 3: Dashboard (1 hafta)
1. ✅ Dashboard overview sayfası
2. ✅ Statistics cards
3. ✅ Charts
4. ✅ Recent activity

### Faz 4: User Management (1 hafta)
1. ✅ User list sayfası
2. ✅ User detail sayfası
3. ✅ User actions (suspend, delete, admin)
4. ✅ Filters ve search

### Faz 5: Product Management (1 hafta)
1. ✅ Product list sayfası
2. ✅ Product detail sayfası
3. ✅ Product actions (delete, hide)
4. ✅ Filters ve search

### Faz 6: Category Management (3-4 gün)
1. ✅ Category tree view
2. ✅ Category CRUD
3. ✅ Translation management

### Faz 7: Reports & Analytics (1 hafta)
1. ✅ Reports overview
2. ✅ User reports
3. ✅ Product reports
4. ✅ Analytics charts
5. ✅ Export functionality

### Faz 8: AI Credits Management (3-4 gün)
1. ✅ Package management
2. ✅ Usage statistics
3. ✅ Metrics display

### Faz 9: Polish & Testing (1 hafta)
1. ✅ Error handling
2. ✅ Loading states
3. ✅ Responsive design
4. ✅ Testing
5. ✅ Performance optimization

---

## 🔒 Güvenlik

### Backend
- ✅ Admin-only endpoints (AdminAuthorize attribute)
- ✅ JWT token validation
- ✅ IsAdmin field kontrolü
- ✅ Rate limiting (opsiyonel)

### Frontend
- ✅ Protected routes (middleware)
- ✅ Token storage (httpOnly cookies önerilir)
- ✅ Token refresh mechanism
- ✅ CSRF protection

---

## 📝 Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=https://api.save-all.com
NEXT_PUBLIC_ADMIN_SUBDOMAIN=admin.save-all.com

# JWT secret (backend ile aynı olmalı)
JWT_SECRET=your-secret-key
```

---

## 🎯 Sonraki Adımlar

1. ✅ Admin web projesi oluştur
2. ✅ Temel yapıyı kur
3. ⚠️ Backend'de IsAdmin field ekle
4. ⚠️ Admin authorization implement et
5. ⚠️ AdminController oluştur
6. ✅ Frontend authentication kur
7. ✅ Dashboard sayfasını oluştur

---

## 📚 Referanslar

- Next.js App Router: https://nextjs.org/docs/app
- shadcn/ui: https://ui.shadcn.com
- TanStack Query: https://tanstack.com/query
- Recharts: https://recharts.org
- TanStack Table: https://tanstack.com/table

