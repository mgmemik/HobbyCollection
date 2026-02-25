# 🔐 Admin Authorization Planı

## 📋 Genel Bakış

Backend'de admin yetkilendirmesi için gerekli değişiklikler ve implementasyon planı.

---

## 🔧 Yapılacak Değişiklikler

### 1. ApplicationUser'a IsAdmin Field Ekleme

**Dosya:** `Backend/HobbyCollection.Infrastructure/ApplicationUser.cs`

```csharp
public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public string? UiLanguage { get; set; }
    public string? AiLanguage { get; set; } = "en";
    public string? Currency { get; set; } = "TRY";
    public bool IsPrivateAccount { get; set; } = false;
    
    // ✅ YENİ: Admin yetkisi
    public bool IsAdmin { get; set; } = false;
}
```

### 2. Migration Oluşturma

```bash
cd Backend/HobbyCollection.Infrastructure
dotnet ef migrations add AddIsAdminToUser
dotnet ef database update
```

### 3. Admin Authorization Policy

**Dosya:** `Backend/HobbyCollection.Api/Program.cs`

```csharp
// Authorization policies ekle
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
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

**Not:** Bu yaklaşım her request'te database sorgusu yapar. Performans için cache kullanılabilir.

### 4. Admin Authorization Attribute

**Dosya:** `Backend/HobbyCollection.Api/Attributes/AdminAuthorizeAttribute.cs` (YENİ)

```csharp
using Microsoft.AspNetCore.Authorization;

namespace HobbyCollection.Api.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminAuthorizeAttribute : AuthorizeAttribute
{
    public AdminAuthorizeAttribute()
    {
        Policy = "AdminOnly";
    }
}
```

### 5. JWT Token'a Admin Claim Ekleme

**Dosya:** `Backend/HobbyCollection.Api/Controllers/AuthController.cs`

```csharp
private string GenerateJwt(ApplicationUser user, bool rememberMe = false)
{
    // ... mevcut kod ...
    
    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id),
        new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
        new("isAdmin", user.IsAdmin.ToString().ToLower()) // ✅ Admin claim ekle
    };
    
    // ... rest of the code ...
}
```

### 6. Admin Check Helper Method

**Dosya:** `Backend/HobbyCollection.Api/Helpers/AdminHelper.cs` (YENİ)

```csharp
using System.Security.Claims;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Helpers;

public static class AdminHelper
{
    public static async Task<bool> IsAdminAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return false;
        
        var appUser = await db.Users.FindAsync(userId);
        return appUser?.IsAdmin == true;
    }
    
    public static bool IsAdmin(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return false;
        
        var appUser = db.Users.Find(userId);
        return appUser?.IsAdmin == true;
    }
}
```

---

## 🎯 Admin Controller Yapısı

### AdminController Oluşturma

**Dosya:** `Backend/HobbyCollection.Api/Controllers/AdminController.cs` (YENİ)

```csharp
using HobbyCollection.Api.Attributes;
using HobbyCollection.Api.Helpers;
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/admin")]
[AdminAuthorize] // Tüm endpoint'ler admin-only
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AppDbContext db, ILogger<AdminController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // Dashboard Statistics
    [HttpGet("dashboard/stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var totalUsers = await _db.Users.CountAsync();
        var totalProducts = await _db.Products.CountAsync();
        var todayProducts = await _db.Products
            .Where(p => p.CreatedAt.Date == DateTime.UtcNow.Date)
            .CountAsync();
        var activeUsers = await _db.Users
            .Where(u => u.Products.Any(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-1)))
            .CountAsync();
        
        return Ok(new
        {
            totalUsers,
            totalProducts,
            todayProducts,
            activeUsers
        });
    }

    // User Management
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var query = _db.Users.AsQueryable();
        
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(u => 
                u.Email!.Contains(search) || 
                (u.DisplayName != null && u.DisplayName.Contains(search)));
        }
        
        var total = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.DisplayName,
                u.IsAdmin,
                u.IsPrivateAccount,
                u.CreatedAt,
                ProductCount = u.Products.Count,
                IsEmailConfirmed = u.EmailConfirmed
            })
            .ToListAsync();
        
        return Ok(new
        {
            total,
            page,
            pageSize,
            items = users
        });
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        var user = await _db.Users
            .Where(u => u.Id == id)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.DisplayName,
                u.IsAdmin,
                u.IsPrivateAccount,
                u.UiLanguage,
                u.Currency,
                u.CreatedAt,
                u.EmailConfirmed,
                ProductCount = u.Products.Count,
                Products = u.Products.Select(p => new
                {
                    p.Id,
                    p.Title,
                    p.CreatedAt
                }).Take(10)
            })
            .FirstOrDefaultAsync();
        
        if (user == null) return NotFound();
        
        return Ok(user);
    }

    [HttpPut("users/{id}/admin")]
    public async Task<IActionResult> ToggleAdmin(string id, [FromBody] bool isAdmin)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        
        user.IsAdmin = isAdmin;
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("User {UserId} admin status changed to {IsAdmin}", id, isAdmin);
        
        return Ok(new { message = "Admin status updated", isAdmin });
    }

    // Product Management
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var query = _db.Products.Include(p => p.User).AsQueryable();
        
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(p => p.Title.Contains(search));
        }
        
        var total = await query.CountAsync();
        var products = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.CreatedAt,
                UserId = p.UserId,
                UserEmail = p.User!.Email,
                LikeCount = p.Likes.Count,
                CommentCount = p.Comments.Count
            })
            .ToListAsync();
        
        return Ok(new
        {
            total,
            page,
            pageSize,
            items = products
        });
    }

    [HttpDelete("products/{id}")]
    public async Task<IActionResult> DeleteProduct(Guid id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null) return NotFound();
        
        _db.Products.Remove(product);
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Product {ProductId} deleted by admin", id);
        
        return Ok(new { message = "Product deleted" });
    }

    // Statistics & Reports
    [HttpGet("statistics/users")]
    public async Task<IActionResult> GetUserStatistics(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var start = startDate ?? DateTime.UtcNow.AddDays(-30);
        var end = endDate ?? DateTime.UtcNow;
        
        var registrations = await _db.Users
            .Where(u => u.CreatedAt >= start && u.CreatedAt <= end)
            .GroupBy(u => u.CreatedAt.Date)
            .Select(g => new
            {
                Date = g.Key,
                Count = g.Count()
            })
            .OrderBy(x => x.Date)
            .ToListAsync();
        
        return Ok(registrations);
    }

    [HttpGet("statistics/products")]
    public async Task<IActionResult> GetProductStatistics(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var start = startDate ?? DateTime.UtcNow.AddDays(-30);
        var end = endDate ?? DateTime.UtcNow;
        
        var products = await _db.Products
            .Where(p => p.CreatedAt >= start && p.CreatedAt <= end)
            .GroupBy(p => p.CreatedAt.Date)
            .Select(g => new
            {
                Date = g.Key,
                Count = g.Count()
            })
            .OrderBy(x => x.Date)
            .ToListAsync();
        
        return Ok(products);
    }
}
```

---

## 📝 Admin Kullanıcı Oluşturma

### Manuel Olarak (SQL)

```sql
-- PostgreSQL
UPDATE "AspNetUsers" 
SET "IsAdmin" = true 
WHERE "Email" = 'admin@save-all.com';
```

### Seeder Oluşturma (Opsiyonel)

**Dosya:** `Backend/HobbyCollection.Api/Seeders/AdminSeeder.cs` (YENİ)

```csharp
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Seeders;

public static class AdminSeeder
{
    public static async Task SeedAdminAsync(IServiceProvider serviceProvider)
    {
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var db = serviceProvider.GetRequiredService<AppDbContext>();
        
        var adminEmail = "admin@save-all.com";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        
        if (adminUser != null && !adminUser.IsAdmin)
        {
            adminUser.IsAdmin = true;
            await userManager.UpdateAsync(adminUser);
            Console.WriteLine($"Admin status granted to {adminEmail}");
        }
        else if (adminUser == null)
        {
            Console.WriteLine($"Admin user {adminEmail} not found. Please create user first.");
        }
    }
}
```

**Program.cs'de çağır:**

```csharp
// Development ortamında admin seed
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    await AdminSeeder.SeedAdminAsync(scope.ServiceProvider);
}
```

---

## ✅ Test Senaryoları

1. ✅ Normal kullanıcı admin endpoint'lerine erişememeli
2. ✅ Admin kullanıcı admin endpoint'lerine erişebilmeli
3. ✅ IsAdmin field false olan kullanıcı admin olamamalı
4. ✅ JWT token'da isAdmin claim doğru olmalı
5. ✅ Admin yetkisi verildiğinde token yenilenmeli (opsiyonel)

---

## 🚀 Implementasyon Sırası

1. ✅ ApplicationUser'a IsAdmin field ekle
2. ✅ Migration oluştur ve uygula
3. ✅ Admin authorization policy oluştur
4. ✅ AdminAuthorizeAttribute oluştur
5. ✅ JWT token'a isAdmin claim ekle
6. ✅ AdminController oluştur
7. ✅ Admin endpoint'lerini implement et
8. ✅ Test et
9. ✅ Admin kullanıcı oluştur (manuel veya seeder)

---

## 📚 Notlar

- **Performance:** Her request'te database sorgusu yapılıyor. İleride cache eklenebilir.
- **Security:** Admin yetkisi sadece database'deki IsAdmin field'ına göre belirleniyor.
- **Token Refresh:** Admin yetkisi değiştiğinde kullanıcının token'ı yenilemesi gerekebilir.
- **Audit Log:** Admin işlemleri için audit log eklenebilir.

