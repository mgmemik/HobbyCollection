using HobbyCollection.Api.Attributes;
using HobbyCollection.Api.Services;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Services;
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

namespace HobbyCollection.Api.Controllers;

/// <summary>
/// Admin-only endpoint'ler için controller
/// Kategori yönetimi öncelikli
/// </summary>
[ApiController]
[Route("api/admin")]
[AdminAuthorize] // Tüm endpoint'ler admin-only
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICategoryService _categoryService;
    private readonly IAICreditService _aiCreditService;
    private readonly ILogger<AdminController> _logger;
    private readonly PushNotificationService? _pushNotificationService;
    private readonly INotificationService _notificationService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEntitlementService _entitlementService;
    private readonly UsernameService _usernameService;

    public AdminController(
        AppDbContext db, 
        ICategoryService categoryService,
        IAICreditService aiCreditService,
        ILogger<AdminController> logger,
        INotificationService notificationService,
        IServiceScopeFactory scopeFactory,
        IEntitlementService entitlementService,
        UsernameService usernameService,
        PushNotificationService? pushNotificationService = null)
    {
        _db = db;
        _categoryService = categoryService;
        _aiCreditService = aiCreditService;
        _logger = logger;
        _pushNotificationService = pushNotificationService;
        _notificationService = notificationService;
        _scopeFactory = scopeFactory;
        _entitlementService = entitlementService;
        _usernameService = usernameService;
    }

    #region Category Management

    /// <summary>
    /// Tüm kategorileri tree yapısında getirir (admin için)
    /// </summary>
    [HttpGet("categories")]
    public async Task<IActionResult> GetAllCategories([FromQuery] string? language = null)
    {
        var categories = await _db.Categories
            .Include(c => c.Translations)
            .OrderBy(c => c.Name)
            .ToListAsync();

        // Çeviri desteği
        if (!string.IsNullOrEmpty(language) && (language == "en" || language == "tr"))
        {
            var translatedCategories = categories.Select(c =>
            {
                var translation = c.Translations?.FirstOrDefault(t => t.LanguageCode == language);
                return new
                {
                    c.Id,
                    Name = translation?.Name ?? c.Name,
                    Description = translation?.Description ?? c.Description,
                    c.Slug,
                    c.IsActive,
                    c.ParentId,
                    c.CreatedAtUtc,
                    ProductCount = _db.Products.Count(p => p.CategoryId == c.Id),
                    HasTranslations = c.Translations != null && c.Translations.Any()
                };
            }).ToList();

            return Ok(translatedCategories);
        }

        var result = categories.Select(c => new
        {
            c.Id,
            c.Name,
            c.Description,
            c.Slug,
            c.IsActive,
            c.ParentId,
            c.CreatedAtUtc,
            ProductCount = _db.Products.Count(p => p.CategoryId == c.Id),
            Translations = (c.Translations != null && c.Translations.Any()) 
                ? c.Translations.Select(t => new
                {
                    t.LanguageCode,
                    t.Name,
                    t.Description
                }).Cast<object>().ToList()
                : new List<object>()
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Kategori detayını getirir
    /// </summary>
    [HttpGet("categories/{id}")]
    public async Task<IActionResult> GetCategory(Guid id)
    {
        var category = await _db.Categories
            .Include(c => c.Translations)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null) return NotFound();

        var productCount = await _db.Products.CountAsync(p => p.CategoryId == id);
        var childrenCount = await _db.Categories.CountAsync(c => c.ParentId == id);

        return Ok(new
        {
            category.Id,
            category.Name,
            category.Description,
            category.Slug,
            category.IsActive,
            category.ParentId,
            category.CreatedAtUtc,
            ProductCount = productCount,
            ChildrenCount = childrenCount,
            Translations = (category.Translations != null && category.Translations.Any())
                ? category.Translations.Select(t => new
                {
                    t.Id,
                    t.LanguageCode,
                    t.Name,
                    t.Description
                }).Cast<object>().ToList()
                : new List<object>()
        });
    }

    /// <summary>
    /// Yeni kategori oluşturur
    /// </summary>
    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Kategori adı gereklidir" });
        }

        // Parent kontrolü
        if (request.ParentId.HasValue)
        {
            var parentExists = await _db.Categories.AnyAsync(c => c.Id == request.ParentId.Value);
            if (!parentExists)
            {
                return BadRequest(new { message = "Geçersiz parent kategori" });
            }
        }

        try
        {
            var category = await _categoryService.CreateAsync(
                request.Name, 
                request.ParentId, 
                request.Description);

            _logger.LogInformation("Admin created category: {CategoryId} - {CategoryName}", category.Id, category.Name);

            return Ok(new
            {
                category.Id,
                category.Name,
                category.Description,
                category.Slug,
                category.IsActive,
                category.ParentId,
                category.CreatedAtUtc
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating category");
            return StatusCode(500, new { message = "Kategori oluşturulurken hata oluştu" });
        }
    }

    /// <summary>
    /// Kategoriyi günceller
    /// </summary>
    [HttpPut("categories/{id}")]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] UpdateCategoryRequest request)
    {
        var category = await _db.Categories.FindAsync(id);
        if (category == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            category.Name = request.Name;
            category.Slug = request.Name.ToLower().Replace(' ', '-');
        }

        if (request.Description != null)
        {
            category.Description = request.Description;
        }

        if (request.IsActive.HasValue)
        {
            category.IsActive = request.IsActive.Value;
        }

        if (request.ParentId != null)
        {
            // Parent'ın kendisi veya alt kategorisi olamaz (circular reference önleme)
            if (request.ParentId == id)
            {
                return BadRequest(new { message = "Kategori kendi parent'ı olamaz" });
            }

            // Parent'ın alt kategorisi olup olmadığını kontrol et
            var isDescendant = await _db.CategoryClosures
                .AnyAsync(cc => cc.AncestorId == id && cc.DescendantId == request.ParentId.Value && cc.Distance > 0);
            
            if (isDescendant)
            {
                return BadRequest(new { message = "Kategori kendi alt kategorisinin parent'ı olamaz" });
            }

            var parentExists = await _db.Categories.AnyAsync(c => c.Id == request.ParentId.Value);
            if (!parentExists)
            {
                return BadRequest(new { message = "Geçersiz parent kategori" });
            }

            category.ParentId = request.ParentId;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Admin updated category: {CategoryId}", id);

        return Ok(new
        {
            category.Id,
            category.Name,
            category.Description,
            category.Slug,
            category.IsActive,
            category.ParentId,
            category.CreatedAtUtc
        });
    }

    /// <summary>
    /// Kategoriyi başka bir kategorinin altına veya ana kategori olarak taşır
    /// </summary>
    [HttpPut("categories/{id}/move")]
    public async Task<IActionResult> MoveCategory(Guid id, [FromBody] MoveCategoryRequest request)
    {
        var category = await _db.Categories.FindAsync(id);
        if (category == null) return NotFound();

        // Circular reference kontrolü
        if (request.NewParentId.HasValue)
        {
            // Kendi parent'ı olamaz
            if (request.NewParentId == id)
            {
                return BadRequest(new { message = "Kategori kendi parent'ı olamaz" });
            }

            // Parent'ın alt kategorisi olamaz (circular reference)
            var isDescendant = await _db.CategoryClosures
                .AnyAsync(cc => cc.AncestorId == id && cc.DescendantId == request.NewParentId.Value && cc.Distance > 0);
            
            if (isDescendant)
            {
                return BadRequest(new { message = "Kategori kendi alt kategorisinin parent'ı olamaz" });
            }

            // Parent'ın var olduğunu kontrol et
            var parentExists = await _db.Categories.AnyAsync(c => c.Id == request.NewParentId.Value);
            if (!parentExists)
            {
                return BadRequest(new { message = "Geçersiz parent kategori" });
            }
        }

        // Alt kategorileri bul (taşınan kategorinin alt kategorileri) - önce bul çünkü closure'ları silmeden önce lazım
        var descendants = await _db.CategoryClosures
            .Where(cc => cc.AncestorId == id && cc.Distance > 0)
            .Select(cc => cc.DescendantId)
            .Distinct()
            .ToListAsync();

        // Alt kategoriler için distance bilgilerini önce al (closure'ları silmeden önce)
        var descendantDistances = new Dictionary<Guid, int>();
        foreach (var descendantId in descendants)
        {
            var distance = await _db.CategoryClosures
                .Where(cc => cc.AncestorId == id && cc.DescendantId == descendantId && cc.Distance > 0)
                .Select(cc => cc.Distance)
                .FirstOrDefaultAsync();
            if (distance > 0)
            {
                descendantDistances[descendantId] = distance;
            }
        }

        // Eski CategoryClosure'ları sil (kategori ve tüm alt kategorileri için)
        // Önce kategori için olan closure'ları sil (self closure hariç)
        var oldClosuresForCategory = await _db.CategoryClosures
            .Where(cc => cc.DescendantId == id && cc.Distance > 0) // Kategori için olan closure'lar (self hariç)
            .ToListAsync();
        
        // Alt kategoriler için olan closure'ları da sil (kategori ile ilgili olanlar)
        var oldClosuresForDescendants = await _db.CategoryClosures
            .Where(cc => cc.AncestorId == id && cc.Distance > 0) // Kategori alt kategoriler için olan closure'lar
            .ToListAsync();

        // Tüm eski closure'ları sil (self closure hariç)
        var closuresToRemove = oldClosuresForCategory.Concat(oldClosuresForDescendants).ToList();
        if (closuresToRemove.Any())
        {
            _db.CategoryClosures.RemoveRange(closuresToRemove);
        }

        // ParentId'yi güncelle
        category.ParentId = request.NewParentId;
        await _db.SaveChangesAsync();

        // Mevcut closure'ları kontrol etmek için bir set oluştur (duplicate kontrolü için)
        var allAffectedIds = new List<Guid> { id };
        allAffectedIds.AddRange(descendants);
        
        var existingClosures = await _db.CategoryClosures
            .Where(cc => allAffectedIds.Contains(cc.DescendantId))
            .Select(cc => new { cc.AncestorId, cc.DescendantId, cc.Distance })
            .ToListAsync();
        
        var existingClosureSet = existingClosures
            .Select(cc => (cc.AncestorId, cc.DescendantId, cc.Distance))
            .ToHashSet();

        // Yeni CategoryClosure'ları oluştur
        var newClosures = new List<CategoryClosure>();
        
        // Self closure (her zaman olmalı) - duplicate kontrolü ile
        var selfClosureKey = (id, id, 0);
        if (!existingClosureSet.Contains(selfClosureKey))
        {
            newClosures.Add(new CategoryClosure 
            { 
                AncestorId = id, 
                DescendantId = id, 
                Distance = 0 
            });
        }

        // Eğer parent varsa, parent'ın tüm ancestor'ları için closure oluştur
        if (request.NewParentId.HasValue)
        {
            // Parent'ın tüm ancestor'larını bul (parent dahil)
            var parentAncestors = await _db.CategoryClosures
                .Where(cc => cc.DescendantId == request.NewParentId.Value)
                .ToListAsync();

            // Kategori için parent'ın ancestor'larına closure ekle (duplicate kontrolü ile)
            foreach (var ancestor in parentAncestors)
            {
                var closureKey = (ancestor.AncestorId, id, ancestor.Distance + 1);
                if (!existingClosureSet.Contains(closureKey))
                {
                    newClosures.Add(new CategoryClosure
                    {
                        AncestorId = ancestor.AncestorId,
                        DescendantId = id,
                        Distance = ancestor.Distance + 1
                    });
                }
            }

            // Alt kategoriler için de closure'ları güncelle
            foreach (var descendantId in descendants)
            {
                // Self closure (duplicate kontrolü ile)
                var descendantSelfClosureKey = (descendantId, descendantId, 0);
                if (!existingClosureSet.Contains(descendantSelfClosureKey))
                {
                    newClosures.Add(new CategoryClosure
                    {
                        AncestorId = descendantId,
                        DescendantId = descendantId,
                        Distance = 0
                    });
                }

                // Parent'ın ancestor'ları için alt kategoriler için closure ekle
                foreach (var ancestor in parentAncestors)
                {
                    // Alt kategori ile kategori arasındaki mesafeyi bul (önceden kaydedilmiş)
                    if (descendantDistances.TryGetValue(descendantId, out var descendantDistance))
                    {
                        var closureKey = (ancestor.AncestorId, descendantId, ancestor.Distance + descendantDistance + 1);
                        if (!existingClosureSet.Contains(closureKey))
                        {
                            newClosures.Add(new CategoryClosure
                            {
                                AncestorId = ancestor.AncestorId,
                                DescendantId = descendantId,
                                Distance = ancestor.Distance + descendantDistance + 1
                            });
                        }
                    }
                }
            }
        }
        else
        {
            // Ana kategori olarak taşınıyorsa, sadece self closure ve direkt alt kategoriler için closure oluştur
            foreach (var descendantId in descendants)
            {
                // Self closure (duplicate kontrolü ile)
                var descendantSelfClosureKey = (descendantId, descendantId, 0);
                if (!existingClosureSet.Contains(descendantSelfClosureKey))
                {
                    newClosures.Add(new CategoryClosure
                    {
                        AncestorId = descendantId,
                        DescendantId = descendantId,
                        Distance = 0
                    });
                }

                // Kategori ile direkt alt kategorileri arasındaki closure (duplicate kontrolü ile)
                var directChildClosureKey = (id, descendantId, 1);
                var directChildExists = await _db.CategoryClosures
                    .AnyAsync(cc => cc.AncestorId == id && cc.DescendantId == descendantId && cc.Distance == 1);

                if (directChildExists && !existingClosureSet.Contains(directChildClosureKey))
                {
                    newClosures.Add(new CategoryClosure
                    {
                        AncestorId = id,
                        DescendantId = descendantId,
                        Distance = 1
                    });
                }
            }
        }

        // Yeni closure'ları ekle (sadece gerçekten yeni olanlar)
        if (newClosures.Any())
        {
            await _db.CategoryClosures.AddRangeAsync(newClosures);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Added {Count} new CategoryClosure entries for category {CategoryId}", newClosures.Count, id);
        }
        else
        {
            _logger.LogInformation("No new CategoryClosure entries needed for category {CategoryId}", id);
        }

        _logger.LogInformation("Admin moved category: {CategoryId} to parent: {NewParentId}", id, request.NewParentId);

        return Ok(new { 
            message = request.NewParentId.HasValue 
                ? "Kategori başarıyla taşındı" 
                : "Kategori ana kategori olarak taşındı",
            categoryId = id,
            newParentId = request.NewParentId
        });
    }

    /// <summary>
    /// Kategoriyi siler (alt kategoriler varsa hata döner, ürünlerin kategori bilgileri temizlenir)
    /// </summary>
    [HttpDelete("categories/{id}")]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var category = await _db.Categories.FindAsync(id);
        if (category == null) return NotFound();

        // Alt kategori kontrolü
        var hasChildren = await _db.Categories.AnyAsync(c => c.ParentId == id);
        if (hasChildren)
        {
            return BadRequest(new { message = "Alt kategorileri olan kategori silinemez. Önce alt kategorileri silin." });
        }

        // Ürünlerin kategori bilgilerini temizle (CategoryId = null yap)
        var productsWithCategory = await _db.Products
            .Where(p => p.CategoryId == id)
            .ToListAsync();
        
        var productCount = productsWithCategory.Count;
        if (productCount > 0)
        {
            foreach (var product in productsWithCategory)
            {
                product.CategoryId = null;
            }
            await _db.SaveChangesAsync();
            _logger.LogInformation("Admin cleared category from {ProductCount} products before deleting category: {CategoryId} - {CategoryName}", 
                productCount, id, category.Name);
        }

        // Çevirileri sil
        var translations = await _db.CategoryTranslations
            .Where(t => t.CategoryId == id)
            .ToListAsync();
        _db.CategoryTranslations.RemoveRange(translations);

        // CategoryClosure'ları sil
        var closures = await _db.CategoryClosures
            .Where(cc => cc.AncestorId == id || cc.DescendantId == id)
            .ToListAsync();
        _db.CategoryClosures.RemoveRange(closures);

        // Kategoriyi sil
        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Admin deleted category: {CategoryId} - {CategoryName} (cleared from {ProductCount} products)", 
            id, category.Name, productCount);

        return Ok(new { 
            message = productCount > 0 
                ? $"Kategori silindi. {productCount} ürünün kategori bilgisi temizlendi." 
                : "Kategori silindi",
            productsCleared = productCount
        });
    }

    /// <summary>
    /// Kategori çevirisi ekler veya günceller
    /// </summary>
    [HttpPost("categories/{id}/translations")]
    public async Task<IActionResult> UpsertCategoryTranslation(
        Guid id, 
        [FromBody] UpsertTranslationRequest request)
    {
        var category = await _db.Categories.FindAsync(id);
        if (category == null) return NotFound();

        if (request.LanguageCode != "tr" && request.LanguageCode != "en")
        {
            return BadRequest(new { message = "Geçersiz dil kodu. Sadece 'tr' veya 'en' kullanılabilir." });
        }

        var existingTranslation = await _db.CategoryTranslations
            .FirstOrDefaultAsync(t => t.CategoryId == id && t.LanguageCode == request.LanguageCode);

        if (existingTranslation != null)
        {
            // Güncelle
            existingTranslation.Name = request.Name;
            if (request.Description != null)
            {
                existingTranslation.Description = request.Description;
            }
        }
        else
        {
            // Yeni ekle
            var translation = new CategoryTranslation
            {
                CategoryId = id,
                LanguageCode = request.LanguageCode,
                Name = request.Name,
                Description = request.Description
            };
            _db.CategoryTranslations.Add(translation);
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Admin updated category translation: {CategoryId} - {LanguageCode}", id, request.LanguageCode);

        return Ok(new { message = "Çeviri güncellendi" });
    }

    /// <summary>
    /// Kategori çevirisini siler
    /// </summary>
    [HttpDelete("categories/{id}/translations/{languageCode}")]
    public async Task<IActionResult> DeleteCategoryTranslation(Guid id, string languageCode)
    {
        var translation = await _db.CategoryTranslations
            .FirstOrDefaultAsync(t => t.CategoryId == id && t.LanguageCode == languageCode);

        if (translation == null) return NotFound();

        _db.CategoryTranslations.Remove(translation);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Admin deleted category translation: {CategoryId} - {LanguageCode}", id, languageCode);

        return Ok(new { message = "Çeviri silindi" });
    }

    /// <summary>
    /// Kategori istatistiklerini getirir
    /// </summary>
    [HttpGet("categories/statistics")]
    public async Task<IActionResult> GetCategoryStatistics()
    {
        var totalCategories = await _db.Categories.CountAsync();
        var rootCategories = await _db.Categories.CountAsync(c => c.ParentId == null);
        var categoriesWithProducts = await _db.Categories
            .Where(c => _db.Products.Any(p => p.CategoryId == c.Id))
            .CountAsync();
        var categoriesWithTranslations = await _db.Categories
            .Where(c => _db.CategoryTranslations.Any(t => t.CategoryId == c.Id))
            .CountAsync();

        var topCategories = await _db.Categories
            .Select(c => new
            {
                c.Id,
                c.Name,
                ProductCount = _db.Products.Count(p => p.CategoryId == c.Id)
            })
            .OrderByDescending(x => x.ProductCount)
            .Take(10)
            .ToListAsync();

        return Ok(new
        {
            TotalCategories = totalCategories,
            RootCategories = rootCategories,
            CategoriesWithProducts = categoriesWithProducts,
            CategoriesWithTranslations = categoriesWithTranslations,
            TopCategories = topCategories
        });
    }

    #endregion

    #region Request Models

    public record CreateCategoryRequest(
        string Name,
        Guid? ParentId = null,
        string? Description = null);

    public record UpdateCategoryRequest(
        string? Name = null,
        Guid? ParentId = null,
        string? Description = null,
        bool? IsActive = null);

    public record UpsertTranslationRequest(
        string LanguageCode,
        string Name,
        string? Description = null);

    public record MoveCategoryRequest(
        Guid? NewParentId = null); // null = ana kategori olarak taşı

    public record UpdateUserRequest(
        bool? IsAdmin = null,
        bool? IsPrivateAccount = null,
        bool? IsWebProfilePublic = null,
        bool? EmailConfirmed = null,
        bool? LockoutEnabled = null,
        string? Username = null);

    public record AdminNotificationFilters(
        string? Search = null,
        bool? IsAdmin = null,
        bool? EmailConfirmed = null,
        bool? IsPrivateAccount = null,
        int? ActiveDays = null,
        int? LoginDays = null,
        bool? HasProducts = null,
        bool? HasNotificationPermission = null,
        bool? HasPushToken = null,
        int? MinActivePushTokensLast30Days = null
    );

    public record SendAdminNotificationRequest(
        string Title,
        string? Message,
        bool SendInApp,
        bool SendPush,
        string Target, // "all" | "filtered"
        AdminNotificationFilters? Filters = null,
        bool DryRun = false
    );

    #endregion

    #region User Management

    /// <summary>
    /// Kullanıcıları listeler (sayfalama, arama, filtreleme ile)
    /// </summary>
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] bool? isAdmin = null,
        [FromQuery] bool? emailConfirmed = null,
        [FromQuery] bool? isPrivateAccount = null,
        [FromQuery] int? activeDays = null,
        [FromQuery] int? loginDays = null,
        [FromQuery] bool? hasProducts = null,
        [FromQuery] string? planStatus = null) // "all", "standard", "premium"
    {
        var query = _db.Users.AsQueryable();

        // Arama filtresi
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.ToLower();
            query = query.Where(u =>
                (u.Email != null && u.Email.ToLower().Contains(searchTerm)) ||
                (u.UserName != null && u.UserName.ToLower().Contains(searchTerm)) ||
                (_db.Users.OfType<ApplicationUser>().Any(au => au.Id == u.Id && au.UserName != null && au.UserName.ToLower().Contains(searchTerm))) // DisplayName kaldırıldı, UserName kullanılıyor
            );
        }

        // Admin filtresi
        if (isAdmin.HasValue)
        {
            query = query.Where(u => _db.Users.OfType<ApplicationUser>().Any(au => au.Id == u.Id && au.IsAdmin == isAdmin.Value));
        }

        // Email onay filtresi
        if (emailConfirmed.HasValue)
        {
            query = query.Where(u => u.EmailConfirmed == emailConfirmed.Value);
        }

        // Private account filtresi
        if (isPrivateAccount.HasValue)
        {
            query = query.Where(u => _db.Users.OfType<ApplicationUser>().Any(au => au.Id == u.Id && au.IsPrivateAccount == isPrivateAccount.Value));
        }

        // Aktif kullanıcı filtresi (son X gün içinde ürün ekleyenler)
        if (activeDays.HasValue && activeDays.Value > 0)
        {
            var activeCutoff = DateTime.UtcNow.AddDays(-activeDays.Value);
            var activeUserIds = await _db.Products
                .Where(p => p.CreatedAt >= activeCutoff)
                .Select(p => p.UserId)
                .Distinct()
                .ToListAsync();
            query = query.Where(u => activeUserIds.Contains(u.Id));
        }

        // Son X gün içinde başarılı login olan kullanıcılar
        if (loginDays.HasValue && loginDays.Value > 0)
        {
            var loginCutoff = DateTime.UtcNow.AddDays(-loginDays.Value);
            query = query.Where(u =>
                _db.LoginLogs.Any(l =>
                    l.IsSuccessful &&
                    l.CreatedAtUtc >= loginCutoff &&
                    (l.UserId == u.Id || (u.Email != null && l.Email == u.Email))
                )
            );
        }

        // Ürünlü / ürünsüz kullanıcı filtresi
        if (hasProducts.HasValue)
        {
            if (hasProducts.Value)
            {
                query = query.Where(u => _db.Products.Any(p => p.UserId == u.Id));
            }
            else
            {
                query = query.Where(u => !_db.Products.Any(p => p.UserId == u.Id));
            }
        }

        // Plan durumu filtresi
        var now = DateTime.UtcNow;
        HashSet<string>? premiumUserIdsFilter = null;

        if (!string.IsNullOrEmpty(planStatus) && planStatus != "all")
        {
            premiumUserIdsFilter = (await _db.UserEntitlements
                .Where(e => e.EntitlementType == Domain.Entities.EntitlementType.Premium &&
                            (e.Status == Domain.Entities.EntitlementStatus.Active || e.Status == Domain.Entities.EntitlementStatus.Grace) &&
                            (e.EndsAtUtc == null || e.EndsAtUtc > now))
                .Select(e => e.UserId)
                .Distinct()
                .ToListAsync()).ToHashSet();

            if (planStatus == "premium")
            {
                query = query.Where(u => premiumUserIdsFilter.Contains(u.Id));
            }
            else if (planStatus == "standard")
            {
                query = query.Where(u => !premiumUserIdsFilter.Contains(u.Id));
            }
        }

        var total = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.Id) // En yeni kayıtlar önce
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Kullanıcı istatistiklerini topla
        var userIds = users.Select(u => u.Id).ToList();
        
        var productCounts = await _db.Products
            .Where(p => userIds.Contains(p.UserId))
            .GroupBy(p => p.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();
        var productCountMap = productCounts.ToDictionary(x => x.UserId, x => x.Count);

        var likeCounts = await (from l in _db.ProductLikes
                                join p in _db.Products on l.ProductId equals p.Id
                                where userIds.Contains(p.UserId)
                                group l by p.UserId into g
                                select new { UserId = g.Key, Count = g.Count() })
                                .ToListAsync();
        var likeCountMap = likeCounts.ToDictionary(x => x.UserId, x => x.Count);

        var followerCounts = await _db.Follows
            .Where(f => userIds.Contains(f.FollowingId) && f.Status == Domain.Entities.FollowStatus.Accepted)
            .GroupBy(f => f.FollowingId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();
        var followerCountMap = followerCounts.ToDictionary(x => x.UserId, x => x.Count);

        var followingCounts = await _db.Follows
            .Where(f => userIds.Contains(f.FollowerId) && f.Status == Domain.Entities.FollowStatus.Accepted)
            .GroupBy(f => f.FollowerId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();
        var followingCountMap = followingCounts.ToDictionary(x => x.UserId, x => x.Count);

        var commentCounts = await _db.Comments
            .Where(c => userIds.Contains(c.UserId))
            .GroupBy(c => c.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();
        var commentCountMap = commentCounts.ToDictionary(x => x.UserId, x => x.Count);

        // Push / bildirim durumu özetleri (UserDeviceInfos üzerinden)
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var deviceRows = await _db.UserDeviceInfos
            .Where(d => userIds.Contains(d.UserId))
            .Select(d => new
            {
                d.UserId,
                d.HasNotificationPermission,
                HasPushToken = !string.IsNullOrEmpty(d.PushToken),
                d.LastUpdatedUtc
            })
            .ToListAsync();

        var deviceSummaryMap = deviceRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => new
            {
                DeviceCount = g.Count(),
                HasPermission = g.Any(x => x.HasNotificationPermission),
                HasPushToken = g.Any(x => x.HasPushToken),
                ActiveTokenCount = g.Count(x => x.HasNotificationPermission && x.HasPushToken && x.LastUpdatedUtc >= cutoff),
                LastUpdatedUtc = g.Max(x => x.LastUpdatedUtc)
            });

        // Premium kullanıcıları kontrol et (aktif entitlement olanlar)
        var premiumUserIds = await _db.UserEntitlements
            .Where(e => userIds.Contains(e.UserId) &&
                        e.EntitlementType == Domain.Entities.EntitlementType.Premium &&
                        (e.Status == Domain.Entities.EntitlementStatus.Active || e.Status == Domain.Entities.EntitlementStatus.Grace) &&
                        (e.EndsAtUtc == null || e.EndsAtUtc > now))
            .Select(e => e.UserId)
            .Distinct()
            .ToListAsync();
        var premiumUserSet = premiumUserIds.ToHashSet();

        var result = users.Select(u =>
        {
            var appUser = u as ApplicationUser;
            return new
            {
                id = u.Id,
                email = u.Email,
                userName = u.UserName,
                displayName = appUser?.UserName, // DisplayName kaldırıldı, UserName kullanılıyor
                isAdmin = appUser?.IsAdmin ?? false,
                isPrivateAccount = appUser?.IsPrivateAccount ?? false,
                isWebProfilePublic = appUser?.IsWebProfilePublic ?? false,
                emailConfirmed = u.EmailConfirmed,
                lockoutEnabled = u.LockoutEnabled,
                lockoutEnd = u.LockoutEnd,
                createdAt = u.Id, // Identity'de CreatedAt yok, Id'den tahmin edilebilir
                uiLanguage = appUser?.UiLanguage,
                aiLanguage = appUser?.AiLanguage,
                currency = appUser?.Currency,
                productCount = productCountMap.ContainsKey(u.Id) ? productCountMap[u.Id] : 0,
                likeCount = likeCountMap.ContainsKey(u.Id) ? likeCountMap[u.Id] : 0,
                followerCount = followerCountMap.ContainsKey(u.Id) ? followerCountMap[u.Id] : 0,
                followingCount = followingCountMap.ContainsKey(u.Id) ? followingCountMap[u.Id] : 0,
                commentCount = commentCountMap.ContainsKey(u.Id) ? commentCountMap[u.Id] : 0,

                // Bildirim durumu (admin listesi için)
                notificationDeviceCount = deviceSummaryMap.ContainsKey(u.Id) ? deviceSummaryMap[u.Id].DeviceCount : 0,
                notificationHasPermission = deviceSummaryMap.ContainsKey(u.Id) && deviceSummaryMap[u.Id].HasPermission,
                notificationHasPushToken = deviceSummaryMap.ContainsKey(u.Id) && deviceSummaryMap[u.Id].HasPushToken,
                notificationActiveTokenCount = deviceSummaryMap.ContainsKey(u.Id) ? deviceSummaryMap[u.Id].ActiveTokenCount : 0,
                notificationLastUpdatedUtc = deviceSummaryMap.ContainsKey(u.Id) ? deviceSummaryMap[u.Id].LastUpdatedUtc : (DateTime?)null,

                // Premium durumu
                isPremium = premiumUserSet.Contains(u.Id),
                
                // Plan durumu: "premium" veya "standard"
                planStatus = premiumUserSet.Contains(u.Id) ? "premium" : "standard",
            };
        }).ToList();

        return Ok(new
        {
            total,
            page,
            pageSize,
            items = result
        });
    }

    /// <summary>
    /// Kullanıcı detayını getirir
    /// </summary>
    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        // İstatistikler
        var productCount = await _db.Products.CountAsync(p => p.UserId == id);
        var likeCount = await _db.ProductLikes
            .CountAsync(l => _db.Products.Any(p => p.Id == l.ProductId && p.UserId == id));
        var followerCount = await _db.Follows.CountAsync(f => f.FollowingId == id && f.Status == Domain.Entities.FollowStatus.Accepted);
        var followingCount = await _db.Follows.CountAsync(f => f.FollowerId == id && f.Status == Domain.Entities.FollowStatus.Accepted);
        var commentCount = await _db.Comments.CountAsync(c => c.UserId == id);
        var saveCount = await _db.ProductSaves.CountAsync(s => s.UserId == id);

        // Son aktivite (en son ürün ekleme tarihi)
        var lastActivity = await _db.Products
            .Where(p => p.UserId == id)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        // Login logları (son 50 kayıt)
        var loginLogs = await _db.LoginLogs
            .Where(l => l.UserId == id || l.Email == user.Email)
            .OrderByDescending(l => l.CreatedAtUtc)
            .Take(50)
            .Select(l => new
            {
                id = l.Id,
                userId = l.UserId,
                email = l.Email,
                ipAddress = l.IpAddress,
                userAgent = l.UserAgent,
                isSuccessful = l.IsSuccessful,
                failureReason = l.FailureReason,
                createdAtUtc = l.CreatedAtUtc
            })
            .ToListAsync();

        // Cihaz bilgileri
        var deviceInfos = await _db.UserDeviceInfos
            .Where(d => d.UserId == id)
            .OrderByDescending(d => d.LastUpdatedUtc)
            .Select(d => new
            {
                id = d.Id,
                platform = d.Platform,
                osVersion = d.OsVersion,
                appVersion = d.AppVersion,
                buildNumber = d.BuildNumber,
                deviceModel = d.DeviceModel,
                deviceManufacturer = d.DeviceManufacturer,
                deviceName = d.DeviceName,
                hasNotificationPermission = d.HasNotificationPermission,
                hasPushToken = !string.IsNullOrEmpty(d.PushToken),
                // Admin debug için maskelenmiş token (tam token'ı göstermiyoruz)
                pushTokenMasked = string.IsNullOrEmpty(d.PushToken)
                    ? null
                    : (d.PushToken.Length <= 18
                        ? d.PushToken
                        : d.PushToken.Substring(0, 12) + "…" + d.PushToken.Substring(d.PushToken.Length - 6)),
                ipAddress = d.IpAddress,
                userAgent = d.UserAgent,
                lastUpdatedUtc = d.LastUpdatedUtc,
                createdAtUtc = d.CreatedAtUtc,
                isActive = d.IsActive
            })
            .ToListAsync();

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            userName = user.UserName,
            displayName = user.UserName, // DisplayName kaldırıldı, UserName kullanılıyor
            isAdmin = user.IsAdmin,
            isPrivateAccount = user.IsPrivateAccount,
            isWebProfilePublic = user.IsWebProfilePublic,
            emailConfirmed = user.EmailConfirmed,
            lockoutEnabled = user.LockoutEnabled,
            lockoutEnd = user.LockoutEnd,
            uiLanguage = user.UiLanguage,
            aiLanguage = user.AiLanguage,
            currency = user.Currency,
            productCount,
            likeCount,
            followerCount,
            followingCount,
            commentCount,
            saveCount,
            lastActivity,
            loginLogs,
            deviceInfos
        });
    }

    public record SendTestPushRequest(string? Title = null, string? Body = null);

    public record UpdateNotificationPermissionRequest(bool Enabled);

    /// <summary>
    /// Kullanıcının tüm cihazlarında notification permission'ı manuel olarak enable/disable yapar (admin)
    /// </summary>
    [HttpPost("users/{id}/notification-permission")]
    public async Task<IActionResult> UpdateNotificationPermission(string id, [FromBody] UpdateNotificationPermissionRequest request)
    {
        var user = await _db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

        // Kullanıcının tüm cihazlarını bul ve notification permission'ı güncelle
        var devices = await _db.UserDeviceInfos
            .Where(d => d.UserId == id)
            .ToListAsync();

        if (!devices.Any())
        {
            return Ok(new
            {
                updated = 0,
                message = "Bu kullanıcı için cihaz kaydı bulunamadı."
            });
        }

        foreach (var device in devices)
        {
            device.HasNotificationPermission = request.Enabled;
            device.LastUpdatedUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            updated = devices.Count,
            enabled = request.Enabled,
            message = $"Bildirim izni {devices.Count} cihaz için {(request.Enabled ? "açıldı" : "kapatıldı")}."
        });
    }

    /// <summary>
    /// Kullanıcıya test push notification gönderir (admin)
    /// </summary>
    [HttpPost("users/{id}/test-push")]
    public async Task<IActionResult> SendTestPush(string id, [FromBody] SendTestPushRequest request)
    {
        _logger.LogInformation("Test push request received for user {UserId}", id);
        
        try
        {
            var user = await _db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null)
            {
                _logger.LogWarning("User not found for test push: {UserId}", id);
                return NotFound(new { message = "Kullanıcı bulunamadı." });
            }

            var cutoff = DateTime.UtcNow.AddDays(-30);
            // IsActive computed property olduğu için EF Core bunu SQL'e çeviremez
            // Bu yüzden direkt LastUpdatedUtc >= cutoff kontrolünü kullanıyoruz
            var activeDevices = await _db.UserDeviceInfos
                .Where(d => d.UserId == id
                    && !string.IsNullOrEmpty(d.PushToken)
                    && d.HasNotificationPermission
                    && d.LastUpdatedUtc >= cutoff) // IsActive kontrolü yerine direkt tarih kontrolü
                .ToListAsync();

            var tokenCount = activeDevices.Select(d => d.PushToken!).Distinct().Count();
            _logger.LogInformation("Found {TokenCount} active push tokens for user {UserId}", tokenCount, id);

            if (_pushNotificationService == null)
            {
                _logger.LogError("PushNotificationService is null for user {UserId}", id);
                return StatusCode(500, new { message = "PushNotificationService yapılandırılmamış." });
            }

            var title = string.IsNullOrWhiteSpace(request.Title) ? "Test Bildirimi" : request.Title!.Trim();
            var body = string.IsNullOrWhiteSpace(request.Body) ? "Bu bir test push bildirimi." : request.Body!.Trim();

            _logger.LogInformation("Sending test push to user {UserId}: Title={Title}, Body={Body}", id, title, body);

            var result = await _pushNotificationService.SendPushNotificationDetailedAsync(
                id,
                title,
                body,
                new Dictionary<string, object>
                {
                    { "type", "test" },
                    { "sentAtUtc", DateTime.UtcNow.ToString("o") }
                }
            );

            _logger.LogInformation("Test push result for user {UserId}: Success={Success}, Sent={SentCount}, Failed={FailedCount}, TotalDevices={TotalDevices}", 
                id, result.Success, result.SentCount, result.FailedCount, result.TotalDevices);

            // Detaylı cihaz bilgilerini logla
            foreach (var deviceResult in result.DeviceResults)
            {
                if (deviceResult.Status == "ok")
                {
                    _logger.LogInformation("Device push success - Token: {TokenMasked}, Platform: {Platform}, TicketId: {TicketId}",
                        deviceResult.Token.Length > 20 ? deviceResult.Token.Substring(0, 20) + "..." : deviceResult.Token,
                        deviceResult.Platform,
                        deviceResult.ExpoTicketId);
                }
                else
                {
                    _logger.LogWarning("Device push failed - Token: {TokenMasked}, Platform: {Platform}, Status: {Status}, Error: {Error}",
                        deviceResult.Token.Length > 20 ? deviceResult.Token.Substring(0, 20) + "..." : deviceResult.Token,
                        deviceResult.Platform,
                        deviceResult.Status,
                        deviceResult.ErrorMessage);
                }
            }

            var message = result.Success 
                ? $"Test bildirimi başarıyla gönderildi ({result.SentCount} cihaz)."
                : result.TotalDevices == 0
                    ? "Bu kullanıcı için aktif push token bulunamadı."
                    : $"Test bildirimi gönderilirken hata oluştu. Başarılı: {result.SentCount}, Başarısız: {result.FailedCount}";

            return Ok(new
            {
                sent = result.Success,
                activeTokenCount = result.ActiveTokenCount,
                totalDevices = result.TotalDevices,
                sentCount = result.SentCount,
                failedCount = result.FailedCount,
                message = message,
                errorMessage = result.ErrorMessage,
                expoApiResponse = result.ExpoApiResponse,
                deviceResults = result.DeviceResults.Select(d => new
                {
                    tokenMasked = d.Token.Length > 20 ? d.Token.Substring(0, 20) + "..." : d.Token,
                    platform = d.Platform,
                    status = d.Status,
                    errorMessage = d.ErrorMessage,
                    expoTicketId = d.ExpoTicketId
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test push to user {UserId}", id);
            return StatusCode(500, new { message = $"Test bildirimi gönderilirken hata oluştu: {ex.Message}" });
        }
    }

    /// <summary>
    /// Kullanıcının login loglarını getirir
    /// </summary>
    [HttpGet("users/{id}/login-logs")]
    public async Task<IActionResult> GetUserLoginLogs(
        string id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool? isSuccessful = null)
    {
        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        var query = _db.LoginLogs
            .Where(l => l.UserId == id || l.Email == user.Email)
            .AsQueryable();

        if (isSuccessful.HasValue)
        {
            query = query.Where(l => l.IsSuccessful == isSuccessful.Value);
        }

        var total = await query.CountAsync();

        var loginLogs = await query
            .OrderByDescending(l => l.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                id = l.Id,
                userId = l.UserId,
                email = l.Email,
                ipAddress = l.IpAddress,
                userAgent = l.UserAgent,
                isSuccessful = l.IsSuccessful,
                failureReason = l.FailureReason,
                createdAtUtc = l.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(new
        {
            total,
            page,
            pageSize,
            items = loginLogs
        });
    }

    /// <summary>
    /// Kullanıcı bilgilerini günceller
    /// </summary>
    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
    {
        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        if (request.IsAdmin.HasValue)
        {
            user.IsAdmin = request.IsAdmin.Value;
            _logger.LogInformation("Admin changed user {UserId} admin status to {IsAdmin}", id, request.IsAdmin.Value);
            
            // Admin yapıldığında EmailConfirmed'i de true yap (admin kullanıcılar email doğrulaması yapmış sayılır)
            if (request.IsAdmin.Value && !user.EmailConfirmed)
            {
                user.EmailConfirmed = true;
                _logger.LogInformation("Admin user {UserId} email confirmed automatically", id);
            }
        }

        if (request.IsPrivateAccount.HasValue)
        {
            user.IsPrivateAccount = request.IsPrivateAccount.Value;
            
            // Eğer uygulama profili kapatılıyorsa, web profili de otomatik kapansın
            if (user.IsPrivateAccount && user.IsWebProfilePublic == true)
            {
                user.IsWebProfilePublic = false;
                _logger.LogInformation("Admin changed user {UserId} - Auto-disabled web profile because app profile is private", id);
            }
        }

        if (request.IsWebProfilePublic.HasValue)
        {
            // Web profil görünürlüğü için kontroller
            if (request.IsWebProfilePublic.Value)
            {
                // Önce uygulama profilinin açık olması gerekli
                if (user.IsPrivateAccount)
                {
                    return BadRequest(new { 
                        error = "APP_PROFILE_PRIVATE",
                        message = "Önce uygulama profilini herkese açık yapmalısınız. Web profili sadece uygulama profili açık olduğunda aktif edilebilir."
                    });
                }
                
                // Sadece premium üyeler web profilini açabilir
                var isPremium = await _entitlementService.IsPremiumAsync(id);
                if (!isPremium)
                {
                    return BadRequest(new { 
                        error = "PREMIUM_REQUIRED",
                        message = "Web profil görünürlüğü sadece premium üyeler için kullanılabilir. Standart kullanıcılar web profilini açamaz."
                    });
                }
                
                user.IsWebProfilePublic = true;
                _logger.LogInformation("Admin enabled web profile for user {UserId}", id);
            }
            else
            {
                // Kapatma her zaman serbest
                user.IsWebProfilePublic = false;
                _logger.LogInformation("Admin disabled web profile for user {UserId}", id);
            }
        }

        if (request.EmailConfirmed.HasValue)
        {
            user.EmailConfirmed = request.EmailConfirmed.Value;
        }

        if (request.LockoutEnabled.HasValue)
        {
            user.LockoutEnabled = request.LockoutEnabled.Value;
            if (!request.LockoutEnabled.Value)
            {
                user.LockoutEnd = null; // Lockout kapatılırsa lockout end'i de temizle
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            // Username'i slug'a çevir
            var slug = _usernameService.CreateSlugFromTextPublic(request.Username);
            
            // Eğer slug boşsa hata döndür
            if (string.IsNullOrWhiteSpace(slug))
            {
                return BadRequest(new { error = "INVALID_USERNAME", message = "Geçerli bir kullanıcı adı giriniz" });
            }
            
            // Mevcut username ile aynıysa değişiklik yapma
            if (user.UserName?.Equals(slug, StringComparison.OrdinalIgnoreCase) == true)
            {
                _logger.LogInformation("Admin attempted to change user {UserId} username to same value '{Username}' - skipping", id, slug);
            }
            else
            {
                // Validasyon
                var (isValid, errorMessage) = _usernameService.ValidateUsername(slug);
                if (!isValid)
                {
                    return BadRequest(new { error = "INVALID_USERNAME", message = errorMessage });
                }
                
                // Unique kontrolü (mevcut kullanıcı hariç)
                if (await _usernameService.IsUsernameTakenAsync(slug, user.Id))
                {
                    // Unique hale getir
                    slug = await _usernameService.EnsureUniqueUsernameAsync(slug);
                }
                
                var oldUsername = user.UserName;
                user.UserName = slug;
                _logger.LogInformation("Admin changed user {UserId} username from '{OldUsername}' to '{NewUsername}'", id, oldUsername, slug);
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Kullanıcı güncellendi" });
    }

    /// <summary>
    /// Kullanıcı istatistiklerini getirir
    /// </summary>
    [HttpGet("users/statistics")]
    public async Task<IActionResult> GetUserStatistics()
    {
        var totalUsers = await _db.Users.CountAsync();
        var adminUsers = await _db.Users.OfType<ApplicationUser>().CountAsync(u => u.IsAdmin);
        var emailConfirmedUsers = await _db.Users.CountAsync(u => u.EmailConfirmed);
        var privateAccountUsers = await _db.Users.OfType<ApplicationUser>().CountAsync(u => u.IsPrivateAccount);
        var usersWithProducts = await _db.Products.Select(p => p.UserId).Distinct().CountAsync();
        var activeUsersLast30Days = await _db.Products
            .Where(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .Select(p => p.UserId)
            .Distinct()
            .CountAsync();
        var loggedInUsersLast30Days = await _db.LoginLogs
            .Where(l => l.IsSuccessful && l.CreatedAtUtc >= DateTime.UtcNow.AddDays(-30) && l.UserId != "")
            .Select(l => l.UserId)
            .Distinct()
            .CountAsync();

        // Premium kullanıcı sayısı
        var now = DateTime.UtcNow;
        var premiumUserIdsList = await _db.UserEntitlements
            .Where(e => e.EntitlementType == Domain.Entities.EntitlementType.Premium &&
                        (e.Status == Domain.Entities.EntitlementStatus.Active || e.Status == Domain.Entities.EntitlementStatus.Grace) &&
                        (e.EndsAtUtc == null || e.EndsAtUtc > now))
            .Select(e => e.UserId)
            .Distinct()
            .ToListAsync();
        var premiumUsers = premiumUserIdsList.Count;

        return Ok(new
        {
            totalUsers,
            adminUsers,
            emailConfirmedUsers,
            privateAccountUsers,
            usersWithProducts,
            activeUsersLast30Days,
            loggedInUsersLast30Days,
            premiumUsers,
        });
    }

    /// <summary>
    /// Kullanıcının AI kredi özetini ve işlem geçmişini getirir (admin için)
    /// </summary>
    [HttpGet("users/{id}/ai-credits")]
    public async Task<IActionResult> GetUserAICredits(string id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        try
        {
            var summary = await _aiCreditService.GetUserCreditSummaryAsync(id);
            var (transactions, totalCount) = await _aiCreditService.GetUserTransactionHistoryAsync(id, page, pageSize);
            var operationCosts = await _aiCreditService.GetOperationCostsAsync();

            return Ok(new
            {
                summary = new
                {
                    currentBalance = summary.CurrentBalance,
                    totalEarned = summary.TotalEarned,
                    totalSpent = summary.TotalSpent,
                    lastRechargeDate = summary.LastRechargeDate,
                    nextRechargeDate = summary.NextRechargeDate,
                    packageName = summary.PackageName,
                    monthlyCredits = summary.MonthlyCredits,
                    daysUntilNextRecharge = summary.DaysUntilNextRecharge
                },
                transactions = transactions.Select(t => new
                {
                    id = t.Id,
                    userId = t.UserId,
                    transactionType = t.TransactionType,
                    amount = t.Amount,
                    balanceBefore = t.BalanceBefore,
                    balanceAfter = t.BalanceAfter,
                    operationType = t.OperationType,
                    description = t.Description,
                    productId = t.ProductId,
                    isSuccessful = t.IsSuccessful,
                    createdAt = t.CreatedAt
                }).ToList(),
                operationCosts = operationCosts.Select(c => new
                {
                    id = c.Id,
                    operationType = c.OperationType,
                    description = c.Description,
                    creditCost = c.CreditCost
                }).ToList(),
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kullanıcı AI kredi bilgileri alınırken hata oluştu. UserId: {UserId}", id);
            return StatusCode(500, new { message = "AI kredi bilgileri alınamadı." });
        }
    }

    public record ManualAICreditChargeRequest(int Amount, string Reason);

    /// <summary>
    /// Admin: Kullanıcıya manuel AI kredisi yükler (sadece preset miktarlar ve açıklamalar)
    /// </summary>
    [HttpPost("users/{id}/ai-credits/manual-charge")]
    public async Task<IActionResult> ManualChargeUserAICredits(string id, [FromBody] ManualAICreditChargeRequest request)
    {
        var user = await _db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

        var allowedAmounts = new HashSet<int> { 50, 100, 200, 300 };
        if (!allowedAmounts.Contains(request.Amount))
        {
            return BadRequest(new { message = "Geçersiz kredi miktarı. Sadece 50, 100, 200, 300 seçilebilir." });
        }

        var reasonMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["support"] = "Destek / telafi",
            ["promo"] = "Kampanya / promosyon",
            ["test"] = "Test / deneme",
            ["refund"] = "Hata telafisi",
            ["adjustment"] = "Manuel düzeltme"
        };

        if (string.IsNullOrWhiteSpace(request.Reason) || !reasonMap.TryGetValue(request.Reason, out var reasonText))
        {
            return BadRequest(new { message = "Geçersiz açıklama seçimi." });
        }

        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown-admin";
        var description = $"Admin manuel yükleme ({adminId}): {reasonText}";

        try
        {
            var tx = await _aiCreditService.ChargeCreditsAsync(id, request.Amount, description);

            // Kullanıcının dil tercihini al
            var appUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == id);
            var userLanguage = appUser?.UiLanguage ?? "en";
            var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
            
            // Yeni kredi yüklendiğinde: push + app (dil desteği ile)
            var title = isTurkish 
                ? "AI krediniz yüklendi" 
                : "AI credits loaded";
            
            var message = isTurkish
                ? $"{tx.Amount} kredi hesabınıza eklendi. Yeni bakiye: {tx.BalanceAfter}."
                : $"{tx.Amount} credits have been added to your account. New balance: {tx.BalanceAfter}.";
            
            await _notificationService.NotifyAsync(
                NotificationEventType.AICreditCharged,
                new NotificationPayload(
                    RecipientUserId: id,
                    Title: title,
                    Message: message
                )
            );

            return Ok(new
            {
                message = "Kredi başarıyla yüklendi.",
                transactionId = tx.Id,
                amount = tx.Amount,
                balanceAfter = tx.BalanceAfter
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Admin manuel kredi yükleme başarısız oldu. UserId: {UserId}, Amount: {Amount}", id, request.Amount);
            return StatusCode(500, new { message = "Kredi yüklenirken hata oluştu." });
        }
    }

    /// <summary>
    /// Dashboard için genel istatistikleri getirir
    /// </summary>
    [HttpGet("dashboard/stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        try
        {
            // Kullanıcı istatistikleri
            var totalUsers = await _db.Users.CountAsync();
            var adminUsers = await _db.Users.OfType<ApplicationUser>().CountAsync(u => u.IsAdmin);
            var emailConfirmedUsers = await _db.Users.CountAsync(u => u.EmailConfirmed);
            var activeUsersLast30Days = await _db.Products
                .Where(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-30))
                .Select(p => p.UserId)
                .Distinct()
                .CountAsync();
            // Identity'de CreatedAt yok, bu yüzden login loglarından tahmin ediyoruz
            var newUsersToday = await _db.LoginLogs
                .Where(l => l.CreatedAtUtc.Date == DateTime.UtcNow.Date && l.IsSuccessful)
                .Select(l => l.UserId)
                .Distinct()
                .CountAsync();
            
            // Bugün eklenen onaylı kullanıcılar
            var emailConfirmedUsersToday = await _db.Users
                .OfType<ApplicationUser>()
                .Where(u => u.EmailConfirmed && u.CreatedAt.Date == DateTime.UtcNow.Date)
                .CountAsync();

            // Ürün istatistikleri
            var totalProducts = await _db.Products.CountAsync();
            var publicProducts = await _db.Products.CountAsync(p => p.IsPublic);
            var privateProducts = await _db.Products.CountAsync(p => !p.IsPublic);
            var productsToday = await _db.Products
                .CountAsync(p => p.CreatedAt.Date == DateTime.UtcNow.Date);
            var productsLast7Days = await _db.Products
                .CountAsync(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-7));
            var productsLast30Days = await _db.Products
                .CountAsync(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-30));

            // Kategori istatistikleri
            var totalCategories = await _db.Categories.CountAsync();
            var categoriesWithProducts = await _db.Categories
                .CountAsync(c => _db.Products.Any(p => p.CategoryId == c.Id));

            // Etkileşim istatistikleri
            var totalLikes = await _db.ProductLikes.CountAsync();
            var totalComments = await _db.Comments.CountAsync();
            var totalSaves = await _db.ProductSaves.CountAsync();
            var likesToday = await _db.ProductLikes
                .CountAsync(l => l.CreatedAt.Date == DateTime.UtcNow.Date);
            var commentsToday = await _db.Comments
                .CountAsync(c => c.CreatedAt.Date == DateTime.UtcNow.Date);
            var savesToday = await _db.ProductSaves
                .CountAsync(s => s.CreatedAt.Date == DateTime.UtcNow.Date);

            // Son aktiviteler
            var recentProducts = await _db.Products
                .OrderByDescending(p => p.CreatedAt)
                .Take(10)
                .Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    userId = p.UserId,
                    createdAt = p.CreatedAt,
                    isPublic = p.IsPublic
                })
                .ToListAsync();

            var recentUsers = await _db.Users
                .OfType<ApplicationUser>()
                .OrderByDescending(u => u.Id) // Identity'de CreatedAt yok, Id'ye göre sırala
                .Take(10)
                .Select(u => new
                {
                    id = u.Id,
                    email = u.Email,
                    displayName = u.UserName, // DisplayName kaldırıldı, UserName kullanılıyor
                    isAdmin = u.IsAdmin,
                    emailConfirmed = u.EmailConfirmed
                })
                .ToListAsync();

            // Son 30 günlük ürün ekleme trendi (günlük)
            var dailyProductCounts = new List<object>();
            for (int i = 29; i >= 0; i--)
            {
                var date = DateTime.UtcNow.AddDays(-i).Date;
                var count = await _db.Products
                    .CountAsync(p => p.CreatedAt.Date == date);
                dailyProductCounts.Add(new { date = date.ToString("yyyy-MM-dd"), count });
            }

            // Son 7 günlük login istatistikleri
            var dailyLoginCounts = new List<object>();
            for (int i = 6; i >= 0; i--)
            {
                var date = DateTime.UtcNow.AddDays(-i).Date;
                var successfulLogins = await _db.LoginLogs
                    .CountAsync(l => l.IsSuccessful && l.CreatedAtUtc.Date == date);
                var failedLogins = await _db.LoginLogs
                    .CountAsync(l => !l.IsSuccessful && l.CreatedAtUtc.Date == date);
                dailyLoginCounts.Add(new 
                { 
                    date = date.ToString("yyyy-MM-dd"), 
                    successful = successfulLogins,
                    failed = failedLogins
                });
            }

            return Ok(new
            {
                users = new
                {
                    total = totalUsers,
                    admin = adminUsers,
                    emailConfirmed = emailConfirmedUsers,
                    activeLast30Days = activeUsersLast30Days,
                    newToday = newUsersToday,
                    emailConfirmedToday = emailConfirmedUsersToday
                },
                products = new
                {
                    total = totalProducts,
                    @public = publicProducts,
                    @private = privateProducts,
                    today = productsToday,
                    last7Days = productsLast7Days,
                    last30Days = productsLast30Days
                },
                categories = new
                {
                    total = totalCategories,
                    withProducts = categoriesWithProducts
                },
                engagement = new
                {
                    totalLikes,
                    totalComments,
                    totalSaves,
                    likesToday,
                    commentsToday,
                    savesToday
                },
                recentProducts,
                recentUsers,
                trends = new
                {
                    dailyProductCounts,
                    dailyLoginCounts
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard istatistikleri alınırken hata oluştu");
            return StatusCode(500, new { message = "Dashboard istatistikleri alınamadı." });
        }
    }

    /// <summary>
    /// Kullanıcı aktivite analizini getirir (kullanım pattern'leri)
    /// </summary>
    [HttpGet("users/{id}/activity")]
    public async Task<IActionResult> GetUserActivity(string id)
    {
        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        // Ürün istatistikleri
        var totalProducts = await _db.Products.CountAsync(p => p.UserId == id);
        var publicProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsPublic);
        var privateProducts = await _db.Products.CountAsync(p => p.UserId == id && !p.IsPublic);
        var productsWithPrice = await _db.Products.CountAsync(p => p.UserId == id && p.Price.HasValue);
        var productsWithCategory = await _db.Products.CountAsync(p => p.UserId == id && p.CategoryId.HasValue);
        var featuredProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsFeatured);

        // Aktivite zamanlaması
        var firstProductDate = await _db.Products
            .Where(p => p.UserId == id)
            .OrderBy(p => p.CreatedAt)
            .Select(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        var lastProductDate = await _db.Products
            .Where(p => p.UserId == id)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        var daysSinceFirstProduct = firstProductDate != default 
            ? (DateTime.UtcNow - firstProductDate).Days 
            : 0;
        var daysSinceLastProduct = lastProductDate != default 
            ? (DateTime.UtcNow - lastProductDate).Days 
            : 0;

        // Son 30 günde eklenen ürün sayısı
        var productsLast30Days = await _db.Products.CountAsync(p => 
            p.UserId == id && p.CreatedAt >= DateTime.UtcNow.AddDays(-30));

        // Kategori dağılımı
        var categoryDistribution = await _db.Products
            .Where(p => p.UserId == id && p.CategoryId.HasValue)
            .GroupBy(p => p.CategoryId)
            .Select(g => new
            {
                CategoryId = g.Key,
                Count = g.Count()
            })
            .OrderByDescending(x => x.Count)
            .Take(10)
            .ToListAsync();

        var categoryIds = categoryDistribution.Select(c => c.CategoryId!.Value).ToList();
        var categories = await _db.Categories
            .Where(c => categoryIds.Contains(c.Id))
            .ToListAsync();
        var categoryDict = categories.ToDictionary(c => c.Id);

        var categoryStats = categoryDistribution.Select(c => new
        {
            categoryId = c.CategoryId,
            categoryName = categoryDict.ContainsKey(c.CategoryId!.Value) 
                ? categoryDict[c.CategoryId.Value].Name 
                : "Bilinmeyen",
            count = c.Count,
            percentage = totalProducts > 0 ? Math.Round((double)c.Count / totalProducts * 100, 1) : 0
        }).ToList();

        // Fiyat analizi
        var productsWithPrices = await _db.Products
            .Where(p => p.UserId == id && p.Price.HasValue)
            .Select(p => p.Price!.Value)
            .ToListAsync();

        var priceStats = productsWithPrices.Any() ? new
        {
            min = productsWithPrices.Min(),
            max = productsWithPrices.Max(),
            avg = productsWithPrices.Average(),
            total = productsWithPrices.Sum(),
            count = productsWithPrices.Count
        } : null;

        // Badge kullanımı
        var rareProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsRare);
        var mintProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsMint);
        var gradedProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsGraded);
        var signedProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsSigned);
        var limitedProducts = await _db.Products.CountAsync(p => p.UserId == id && p.IsLimited);

        // Etkileşim istatistikleri
        var userProductIds = await _db.Products.Where(p => p.UserId == id).Select(p => p.Id).ToListAsync();
        var totalLikesReceived = await _db.ProductLikes.CountAsync(l => userProductIds.Contains(l.ProductId));
        var totalCommentsReceived = await _db.Comments.CountAsync(c => userProductIds.Contains(c.ProductId));
        var totalSavesReceived = await _db.ProductSaves.CountAsync(s => userProductIds.Contains(s.ProductId));

        // Kullanıcı tarih bilgileri
        var userCreatedDate = user.CreatedAt;
        
        // İlk başarılı login tarihi (aktivated date)
        var activatedDate = await _db.LoginLogs
            .Where(l => (l.UserId == id || l.Email == user.Email) && l.IsSuccessful)
            .OrderBy(l => l.CreatedAtUtc)
            .Select(l => l.CreatedAtUtc)
            .FirstOrDefaultAsync();
        
        // Son başarılı login tarihi
        var lastLoginDate = await _db.LoginLogs
            .Where(l => (l.UserId == id || l.Email == user.Email) && l.IsSuccessful)
            .OrderByDescending(l => l.CreatedAtUtc)
            .Select(l => l.CreatedAtUtc)
            .FirstOrDefaultAsync();

        // Kullanım pattern analizi
        var usagePattern = "normal"; // normal, collector, seller, casual
        var patternReasons = new List<string>();

        if (totalProducts >= 50 && productsWithPrice > totalProducts * 0.7)
        {
            usagePattern = "seller";
            patternReasons.Add("Yüksek ürün sayısı ve fiyat girme oranı");
        }
        else if (totalProducts >= 30 && rareProducts + mintProducts + gradedProducts > totalProducts * 0.3)
        {
            usagePattern = "collector";
            patternReasons.Add("Yüksek badge kullanımı (nadir, mint, graded)");
        }
        else if (totalProducts < 5 && daysSinceFirstProduct > 30)
        {
            usagePattern = "casual";
            patternReasons.Add("Düşük ürün sayısı ve uzun süreli pasiflik");
        }
        else if (productsLast30Days > 10)
        {
            usagePattern = "active";
            patternReasons.Add("Son 30 günde yüksek aktivite");
        }

        return Ok(new
        {
            userId = id,
            totalProducts,
            publicProducts,
            privateProducts,
            productsWithPrice,
            productsWithCategory,
            featuredProducts,
            firstProductDate,
            lastProductDate,
            daysSinceFirstProduct,
            daysSinceLastProduct,
            productsLast30Days,
            userCreatedDate,
            activatedDate = activatedDate != default ? activatedDate : (DateTime?)null,
            lastLoginDate = lastLoginDate != default ? lastLoginDate : (DateTime?)null,
            categoryDistribution = categoryStats,
            priceStatistics = priceStats,
            priceCurrency = user?.Currency ?? "TRY",
            badgeUsage = new
            {
                rare = rareProducts,
                mint = mintProducts,
                graded = gradedProducts,
                signed = signedProducts,
                limited = limitedProducts
            },
            engagement = new
            {
                totalLikesReceived,
                totalCommentsReceived,
                totalSavesReceived,
                avgLikesPerProduct = totalProducts > 0 ? Math.Round((double)totalLikesReceived / totalProducts, 2) : 0,
                avgCommentsPerProduct = totalProducts > 0 ? Math.Round((double)totalCommentsReceived / totalProducts, 2) : 0
            },
            usagePattern,
            patternReasons
        });
    }

    #endregion

    #region Admin Notifications

    /// <summary>
    /// Admin panelden genel / filtreli gruba notification göndermeyi sağlar.
    /// - InApp: Notifications tablosuna kayıt atar (type = "admin_broadcast")
    /// - Push: Push token + izin + uygulama içi bildirim ayarı olan cihazlara push dispatch eder
    /// </summary>
    [HttpPost("notifications/send")]
    public async Task<IActionResult> SendAdminNotification([FromBody] SendAdminNotificationRequest request, CancellationToken ct)
    {
        if (request == null) return BadRequest(new { message = "Geçersiz istek" });

        var title = (request.Title ?? string.Empty).Trim();
        var message = string.IsNullOrWhiteSpace(request.Message) ? null : request.Message.Trim();

        if (string.IsNullOrWhiteSpace(title))
        {
            return BadRequest(new { message = "Başlık zorunludur" });
        }

        if (!request.SendInApp && !request.SendPush)
        {
            return BadRequest(new { message = "En az bir kanal seçmelisiniz (in-app veya push)" });
        }

        var target = (request.Target ?? string.Empty).Trim().ToLowerInvariant();
        if (target != "all" && target != "filtered")
        {
            return BadRequest(new { message = "Target alanı 'all' veya 'filtered' olmalıdır" });
        }

        var filters = request.Filters;
        var userQuery = _db.Users.OfType<ApplicationUser>().AsNoTracking().AsQueryable();

        // Filtreli hedefse (grup) kullanıcı filtrelerini uygula
        if (target == "filtered" && filters != null)
        {
            // Arama
            if (!string.IsNullOrWhiteSpace(filters.Search))
            {
                var searchTerm = filters.Search.Trim().ToLower();
                userQuery = userQuery.Where(u =>
                    (u.Email != null && u.Email.ToLower().Contains(searchTerm)) ||
                    (u.UserName != null && u.UserName.ToLower().Contains(searchTerm)) ||
                    (u.UserName != null && u.UserName.ToLower().Contains(searchTerm))); // DisplayName kaldırıldı, UserName kullanılıyor
            }

            if (filters.IsAdmin.HasValue)
            {
                userQuery = userQuery.Where(u => u.IsAdmin == filters.IsAdmin.Value);
            }

            if (filters.EmailConfirmed.HasValue)
            {
                userQuery = userQuery.Where(u => u.EmailConfirmed == filters.EmailConfirmed.Value);
            }

            if (filters.IsPrivateAccount.HasValue)
            {
                userQuery = userQuery.Where(u => u.IsPrivateAccount == filters.IsPrivateAccount.Value);
            }

            // Aktif kullanıcı filtresi (son X gün içinde ürün ekleyenler)
            if (filters.ActiveDays.HasValue && filters.ActiveDays.Value > 0)
            {
                var activeCutoff = DateTime.UtcNow.AddDays(-filters.ActiveDays.Value);
                var activeUserIds = await _db.Products
                    .Where(p => p.CreatedAt >= activeCutoff)
                    .Select(p => p.UserId)
                    .Distinct()
                    .ToListAsync(ct);
                userQuery = userQuery.Where(u => activeUserIds.Contains(u.Id));
            }

            // Son X gün içinde başarılı login olan kullanıcılar
            if (filters.LoginDays.HasValue && filters.LoginDays.Value > 0)
            {
                var loginCutoff = DateTime.UtcNow.AddDays(-filters.LoginDays.Value);
                userQuery = userQuery.Where(u =>
                    _db.LoginLogs.Any(l =>
                        l.IsSuccessful &&
                        l.CreatedAtUtc >= loginCutoff &&
                        (l.UserId == u.Id || (u.Email != null && l.Email == u.Email))
                    )
                );
            }

            // Ürünlü / ürünsüz kullanıcı filtresi
            if (filters.HasProducts.HasValue)
            {
                if (filters.HasProducts.Value)
                {
                    userQuery = userQuery.Where(u => _db.Products.Any(p => p.UserId == u.Id));
                }
                else
                {
                    userQuery = userQuery.Where(u => !_db.Products.Any(p => p.UserId == u.Id));
                }
            }

            // Cihaz/push filtreleri
            if (filters.HasNotificationPermission.HasValue)
            {
                if (filters.HasNotificationPermission.Value)
                {
                    userQuery = userQuery.Where(u => _db.UserDeviceInfos.Any(d => d.UserId == u.Id && d.HasNotificationPermission));
                }
                else
                {
                    userQuery = userQuery.Where(u => !_db.UserDeviceInfos.Any(d => d.UserId == u.Id && d.HasNotificationPermission));
                }
            }

            if (filters.HasPushToken.HasValue)
            {
                if (filters.HasPushToken.Value)
                {
                    userQuery = userQuery.Where(u => _db.UserDeviceInfos.Any(d => d.UserId == u.Id && !string.IsNullOrEmpty(d.PushToken)));
                }
                else
                {
                    userQuery = userQuery.Where(u => !_db.UserDeviceInfos.Any(d => d.UserId == u.Id && !string.IsNullOrEmpty(d.PushToken)));
                }
            }

            if (filters.MinActivePushTokensLast30Days.HasValue && filters.MinActivePushTokensLast30Days.Value > 0)
            {
                var cutoff = DateTime.UtcNow.AddDays(-30);
                var min = filters.MinActivePushTokensLast30Days.Value;
                userQuery = userQuery.Where(u =>
                    _db.UserDeviceInfos.Count(d =>
                        d.UserId == u.Id &&
                        d.HasNotificationPermission &&
                        d.NotificationsEnabled &&
                        !string.IsNullOrEmpty(d.PushToken) &&
                        d.LastUpdatedUtc >= cutoff
                    ) >= min
                );
            }
        }

        var recipientIds = await userQuery.Select(u => u.Id).ToListAsync(ct);
        var recipientCount = recipientIds.Count;

        if (recipientCount == 0)
        {
            return Ok(new
            {
                recipientCount = 0,
                inAppCreatedCount = 0,
                pushEnqueued = false
            });
        }

        // Push hedef kitlesi: token+izin+enabled + (aktif) filtresi
        List<string> pushRecipientIds = new();
        if (request.SendPush)
        {
            var cutoff = DateTime.UtcNow.AddDays(-30);
            pushRecipientIds = await _db.UserDeviceInfos
                .Where(d =>
                    recipientIds.Contains(d.UserId) &&
                    d.HasNotificationPermission &&
                    d.NotificationsEnabled &&
                    !string.IsNullOrEmpty(d.PushToken) &&
                    d.LastUpdatedUtc >= cutoff
                )
                .Select(d => d.UserId)
                .Distinct()
                .ToListAsync(ct);
        }

        if (request.DryRun)
        {
            return Ok(new
            {
                recipientCount,
                inAppCreatedCount = 0,
                pushEnqueued = false
            });
        }

        var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
        var inAppCreated = 0;

        if (request.SendInApp)
        {
            const int batchSize = 500;
            for (var i = 0; i < recipientIds.Count; i += batchSize)
            {
                var batch = recipientIds.Skip(i).Take(batchSize).ToList();
                var notifications = batch.Select(userId => new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Type = "admin_broadcast",
                    Title = title,
                    Message = message,
                    IsRead = false,
                    CreatedAt = now,
                }).ToList();

                _db.Notifications.AddRange(notifications);
                await _db.SaveChangesAsync(ct);
                inAppCreated += notifications.Count;
            }
        }

        var pushEnqueued = false;
        if (request.SendPush && pushRecipientIds.Count > 0)
        {
            pushEnqueued = true;
            var pushTitle = title;
            var pushBody = message ?? title;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var push = scope.ServiceProvider.GetService<PushNotificationService>();
                    if (push == null) return;

                    var data = new Dictionary<string, object>
                    {
                        ["type"] = "admin_broadcast"
                    };

                    await push.SendPushNotificationsAsync(pushRecipientIds, pushTitle, pushBody, data);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Admin push broadcast failed");
                }
            });
        }

        return Ok(new
        {
            recipientCount,
            inAppCreatedCount = inAppCreated,
            pushEnqueued
        });
    }

    #endregion

    #region Product Management

    /// <summary>
    /// Ürünleri listeler (sayfalama, arama, filtreleme ile)
    /// </summary>
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? userId = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? isPublic = null,
        [FromQuery] int? createdDays = null,
        [FromQuery] string? sortBy = "createdAt",
        [FromQuery] string? sortOrder = "desc")
    {
        // Not: collection include + Skip/Take + custom ordering bazı durumlarda pagination'ı bozabilir.
        // Admin listesi için minimal alanları select ederek ilerliyoruz.
        var query = _db.Products.AsNoTracking().AsQueryable();

        // Arama filtresi
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.ToLower();
            // @ işareti ile başlıyorsa sadece kullanıcı araması yap
            var isUserSearch = searchTerm.StartsWith("@");
            var cleanSearchTerm = isUserSearch ? searchTerm.Substring(1).Trim() : searchTerm;

            if (isUserSearch && !string.IsNullOrWhiteSpace(cleanSearchTerm))
            {
                // Sadece kullanıcı adı/email ile arama
                var matchingUserIds = await _db.Users.OfType<ApplicationUser>()
                    .Where(u => 
                        (u.UserName != null && u.UserName.ToLower().Contains(cleanSearchTerm)) || // DisplayName kaldırıldı, UserName kullanılıyor
                        (u.Email != null && u.Email.ToLower().Contains(cleanSearchTerm)) ||
                        (u.UserName != null && u.UserName.ToLower().Contains(cleanSearchTerm))
                    )
                    .Select(u => u.Id)
                    .ToListAsync();

                if (matchingUserIds.Any())
                {
                    query = query.Where(p => matchingUserIds.Contains(p.UserId));
                }
                else
                {
                    // Eşleşen kullanıcı yoksa boş sonuç döndür
                    query = query.Where(p => false);
                }
            }
            else
            {
                // Ürün bilgilerinde arama + kullanıcı bilgilerinde de arama
                var matchingUserIds = await _db.Users.OfType<ApplicationUser>()
                    .Where(u => 
                        // DisplayName kaldırıldı, UserName zaten kontrol ediliyor
                        (u.Email != null && u.Email.ToLower().Contains(searchTerm)) ||
                        (u.UserName != null && u.UserName.ToLower().Contains(searchTerm))
                    )
                    .Select(u => u.Id)
                    .ToListAsync();

                query = query.Where(p =>
                    p.Title.ToLower().Contains(searchTerm) ||
                    (p.Description != null && p.Description.ToLower().Contains(searchTerm)) ||
                    (p.Hashtags != null && p.Hashtags.ToLower().Contains(searchTerm)) ||
                    matchingUserIds.Contains(p.UserId)
                );
            }
        }

        // Kullanıcı filtresi
        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(p => p.UserId == userId);
        }

        // Kategori filtresi
        if (categoryId.HasValue)
        {
            // Kategori ve tüm alt kategorilerini bul
            var categoryIds = new List<Guid> { categoryId.Value };
            var descendants = await _db.CategoryClosures
                .Where(cc => cc.AncestorId == categoryId.Value && cc.Distance > 0)
                .Select(cc => cc.DescendantId)
                .ToListAsync();
            categoryIds.AddRange(descendants);
            query = query.Where(p => p.CategoryId.HasValue && categoryIds.Contains(p.CategoryId.Value));
        }

        // Public/Private filtresi
        if (isPublic.HasValue)
        {
            query = query.Where(p => p.IsPublic == isPublic.Value);
        }

        // Son X günde eklenen filtresi (UTC)
        if (createdDays.HasValue && createdDays.Value > 0)
        {
            var cutoff = DateTime.UtcNow.AddDays(-createdDays.Value);
            query = query.Where(p => p.CreatedAt >= cutoff);
        }

        // Sıralama
        switch (sortBy?.ToLower())
        {
            case "title":
                query = sortOrder?.ToLower() == "asc" 
                    ? query.OrderBy(p => p.Title)
                    : query.OrderByDescending(p => p.Title);
                break;
            // Filtre: yorum alan ürünler + sıralama: yorum sayısı yüksekten düşüğe
            case "commentcount":
                query = query
                    .Where(p => _db.Comments.Any(c => c.ProductId == p.Id))
                    .OrderByDescending(p => _db.Comments.Count(c => c.ProductId == p.Id));
                break;
            // Filtre: beğeni alan ürünler + sıralama: beğeni sayısı yüksekten düşüğe
            case "likecount":
                query = query
                    .Where(p => _db.ProductLikes.Any(l => l.ProductId == p.Id))
                    .OrderByDescending(p => _db.ProductLikes.Count(l => l.ProductId == p.Id));
                break;
            // Filtre: kayıt alan ürünler + sıralama: kayıt sayısı yüksekten düşüğe
            case "savecount":
                query = query
                    .Where(p => _db.ProductSaves.Any(s => s.ProductId == p.Id))
                    .OrderByDescending(p => _db.ProductSaves.Count(s => s.ProductId == p.Id));
                break;
            case "createdat":
            default:
                query = sortOrder?.ToLower() == "asc"
                    ? query.OrderBy(p => p.CreatedAt)
                    : query.OrderByDescending(p => p.CreatedAt);
                break;
        }

        var total = await query.CountAsync();

        var products = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Description,
                p.Hashtags,
                p.CategoryId,
                p.Price,
                p.IsPublic,
                p.CommentsEnabled,
                p.CreatedAt,
                p.UserId,
                p.IsRare,
                p.IsMint,
                p.IsGraded,
                p.IsSigned,
                p.IsLimited,
                p.IsFeatured,
                PhotoCount = _db.ProductPhotos.Count(ph => ph.ProductId == p.Id),
                FirstPhotoUrl = _db.ProductPhotos
                    .Where(ph => ph.ProductId == p.Id)
                    .OrderBy(ph => ph.Order)
                    .Select(ph => ph.BlobUrl)
                    .FirstOrDefault(),
                LikeCount = _db.ProductLikes.Count(l => l.ProductId == p.Id),
                CommentCount = _db.Comments.Count(c => c.ProductId == p.Id),
                SaveCount = _db.ProductSaves.Count(s => s.ProductId == p.Id),
            })
            .ToListAsync();

        // Kullanıcı bilgilerini topla
        var userIds = products.Select(p => p.UserId).Distinct().ToList();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();
        var userDict = users.ToDictionary(u => u.Id);

        // Kategori adlarını al (leaf category)
        var productCategoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var categoryNameMap = productCategoryIds.Any()
            ? await _db.Categories
                .Where(c => productCategoryIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Name)
            : new Dictionary<Guid, string>();

        // Kategori hiyerarşik path'lerini hazırla (categoryId -> "Saat - Kol Saati" formatında)
        var categoryPathMap = new Dictionary<Guid, string>();
        if (productCategoryIds.Any())
        {
            // Her kategori için: ancestor'ları (distance > 0, yani root'tan leaf'e) + kendisi (leaf)
            var closureData = await _db.CategoryClosures
                .Where(cc => productCategoryIds.Contains(cc.DescendantId) && cc.Distance > 0)
                .Select(cc => new { cc.DescendantId, cc.AncestorId, cc.Distance })
                .ToListAsync();

            var categoryIdsInPaths = closureData.Select(c => c.AncestorId).Concat(productCategoryIds).Distinct().ToList();
            var categoriesInPaths = await _db.Categories.Where(c => categoryIdsInPaths.Contains(c.Id)).ToDictionaryAsync(c => c.Id);

            foreach (var catId in productCategoryIds)
            {
                // Bu kategorinin path'ini oluştur: ancestor'lar (distance asc, root'tan leaf'e) + kendisi (leaf category)
                var pathIds = closureData
                    .Where(cc => cc.DescendantId == catId)
                    .OrderBy(cc => cc.Distance)
                    .Select(cc => cc.AncestorId)
                    .Concat(new[] { catId })
                    .ToList();

                var pathNames = pathIds
                    .Where(id => categoriesInPaths.ContainsKey(id))
                    .Select(id => categoriesInPaths[id].Name)
                    .ToList();

                if (pathNames.Any())
                    categoryPathMap[catId] = string.Join(" - ", pathNames);
            }
        }

        var result = products.Select(p =>
        {
            var user = userDict.ContainsKey(p.UserId) ? userDict[p.UserId] : null;
            var displayName = !string.IsNullOrWhiteSpace(user?.UserName) 
                ? user.UserName // DisplayName kaldırıldı, UserName kullanılıyor 
                : user?.Email?.Split('@')[0] 
                ?? p.UserId.Substring(0, Math.Min(8, p.UserId.Length));

            // Hiyerarşik kategori path'i (örn: "Saat - Kol Saati")
            var categoryPath = p.CategoryId.HasValue && categoryPathMap.ContainsKey(p.CategoryId.Value)
                ? categoryPathMap[p.CategoryId.Value]
                : null;

            return new
            {
                id = p.Id,
                title = p.Title,
                description = p.Description,
                hashtags = p.Hashtags,
                categoryId = p.CategoryId,
                categoryName = p.CategoryId.HasValue && categoryNameMap.ContainsKey(p.CategoryId.Value)
                    ? categoryNameMap[p.CategoryId.Value]
                    : null,
                categoryPath,
                price = p.Price,
                userCurrency = user?.Currency ?? "TRY", // Kullanıcının para birimi tercihi
                isPublic = p.IsPublic,
                commentsEnabled = p.CommentsEnabled,
                createdAt = p.CreatedAt,
                userId = p.UserId,
                userEmail = user?.Email,
                userDisplayName = displayName,
                photoCount = p.PhotoCount,
                firstPhotoUrl = p.FirstPhotoUrl,
                likeCount = p.LikeCount,
                commentCount = p.CommentCount,
                saveCount = p.SaveCount,
                isRare = p.IsRare,
                isMint = p.IsMint,
                isGraded = p.IsGraded,
                isSigned = p.IsSigned,
                isLimited = p.IsLimited,
                isFeatured = p.IsFeatured,
            };
        }).ToList();

        return Ok(new
        {
            total,
            page,
            pageSize,
            items = result
        });
    }

    /// <summary>
    /// Ürün detayını getirir
    /// </summary>
    [HttpGet("products/{id}")]
    public async Task<IActionResult> GetProduct(Guid id)
    {
        var product = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Include(p => p.Badges)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product == null) return NotFound();

        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == product.UserId);
        var displayName = !string.IsNullOrWhiteSpace(user?.UserName)
            ? user.UserName // DisplayName kaldırıldı, UserName kullanılıyor
            : product.UserId.Substring(0, Math.Min(8, product.UserId.Length));

        var likeCount = await _db.ProductLikes.CountAsync(l => l.ProductId == id);
        var commentCount = await _db.Comments.CountAsync(c => c.ProductId == id);
        var saveCount = await _db.ProductSaves.CountAsync(s => s.ProductId == id);

        return Ok(new
        {
            id = product.Id,
            title = product.Title,
            description = product.Description,
            hashtags = product.Hashtags,
            categoryId = product.CategoryId,
            categoryName = product.Category?.Name,
            price = product.Price,
            isPublic = product.IsPublic,
            commentsEnabled = product.CommentsEnabled,
            createdAt = product.CreatedAt,
            userId = product.UserId,
            userEmail = user?.Email,
            userDisplayName = displayName,
            photos = product.Photos.Select(ph => new
            {
                ph.Id,
                ph.BlobUrl,
                ph.Order,
                ph.ContentType,
                ph.SizeBytes
            }),
            likeCount,
            commentCount,
            saveCount,
            isRare = product.IsRare,
            isMint = product.IsMint,
            isGraded = product.IsGraded,
            isSigned = product.IsSigned,
            isLimited = product.IsLimited,
            isFeatured = product.IsFeatured,
            badges = product.Badges.Select(b => new
            {
                b.Badge,
                b.ExpiresAt
            })
        });
    }

    /// <summary>
    /// Ürün bilgilerini günceller
    /// </summary>
    [HttpPut("products/{id}")]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null) return NotFound();

        if (request.IsPublic.HasValue)
        {
            product.IsPublic = request.IsPublic.Value;
        }

        if (request.CommentsEnabled.HasValue)
        {
            product.CommentsEnabled = request.CommentsEnabled.Value;
        }

        if (request.CategoryId.HasValue)
        {
            // Kategori var mı kontrol et
            if (request.CategoryId.Value != Guid.Empty)
            {
                var categoryExists = await _db.Categories.AnyAsync(c => c.Id == request.CategoryId.Value);
                if (!categoryExists)
                {
                    return BadRequest(new { message = "Geçersiz kategori" });
                }
            }
            product.CategoryId = request.CategoryId.Value == Guid.Empty ? null : request.CategoryId;
        }

        if (request.IsFeatured.HasValue)
        {
            product.IsFeatured = request.IsFeatured.Value;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Admin updated product: {ProductId}", id);

        return Ok(new { message = "Ürün güncellendi" });
    }

    /// <summary>
    /// Ürünü siler
    /// </summary>
    [HttpDelete("products/{id}")]
    public async Task<IActionResult> DeleteProduct(Guid id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null) return NotFound();

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Admin deleted product: {ProductId} - {ProductTitle}", id, product.Title);

        return Ok(new { message = "Ürün silindi" });
    }

    /// <summary>
    /// Ürün istatistiklerini getirir
    /// </summary>
    [HttpGet("products/statistics")]
    public async Task<IActionResult> GetProductStatistics()
    {
        var totalProducts = await _db.Products.CountAsync();
        var publicProducts = await _db.Products.CountAsync(p => p.IsPublic);
        var privateProducts = await _db.Products.CountAsync(p => !p.IsPublic);
        var todayProducts = await _db.Products.CountAsync(p => p.CreatedAt.Date == DateTime.UtcNow.Date);
        var last5DaysProducts = await _db.Products.CountAsync(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-5));
        var last7DaysProducts = await _db.Products.CountAsync(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-7));
        var last30DaysProducts = await _db.Products.CountAsync(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-30));
        var productsWithPhotos = await _db.Products.CountAsync(p => p.Photos.Any());
        var productsWithPrice = await _db.Products.CountAsync(p => p.Price.HasValue);
        var featuredProducts = await _db.Products.CountAsync(p => p.IsFeatured);
        var totalLikes = await _db.ProductLikes.CountAsync();
        var totalComments = await _db.Comments.CountAsync();
        var totalSaves = await _db.ProductSaves.CountAsync();

        // En çok beğenilen ürünler
        var topLikedProducts = await _db.ProductLikes
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(5)
            .ToListAsync();

        var topLikedProductIds = topLikedProducts.Select(x => x.ProductId).ToList();
        var topLikedProductDetails = await _db.Products
            .Where(p => topLikedProductIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Title, p.UserId })
            .ToListAsync();

        var topLiked = topLikedProducts.Select(x =>
        {
            var product = topLikedProductDetails.FirstOrDefault(p => p.Id == x.ProductId);
            return new
            {
                productId = x.ProductId,
                title = product?.Title ?? "Bilinmeyen",
                userId = product?.UserId,
                likeCount = x.Count
            };
        }).ToList();

        return Ok(new
        {
            totalProducts,
            publicProducts,
            privateProducts,
            todayProducts,
            last5DaysProducts,
            last7DaysProducts,
            last30DaysProducts,
            productsWithPhotos,
            productsWithPrice,
            featuredProducts,
            totalLikes,
            totalComments,
            totalSaves,
            topLikedProducts = topLiked
        });
    }

    #endregion

    #region Request Models

    public record UpdateProductRequest(
        bool? IsPublic = null,
        bool? CommentsEnabled = null,
        Guid? CategoryId = null,
        bool? IsFeatured = null);

    #endregion

    #region Reports

    /// <summary>
    /// Arama loglarını getirir (pagination ve filtreleme ile)
    /// </summary>
    [HttpGet("reports/search-logs")]
    public async Task<IActionResult> GetSearchLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? searchType = null,
        [FromQuery] string? userId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var query = _db.SearchLogs.AsQueryable();

        // Filtreler
        if (!string.IsNullOrWhiteSpace(searchType))
        {
            query = query.Where(s => s.SearchType == searchType);
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(s => s.UserId == userId);
        }

        if (startDate.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc <= endDate.Value);
        }

        var total = await query.CountAsync();

        var logs = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                id = s.Id,
                userId = s.UserId,
                searchType = s.SearchType,
                query = s.Query,
                categoryId = s.CategoryId,
                resultCount = s.ResultCount,
                ipAddress = s.IpAddress,
                userAgent = s.UserAgent,
                language = s.Language,
                createdAtUtc = s.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(new
        {
            total,
            page,
            pageSize,
            items = logs
        });
    }

    /// <summary>
    /// Arama istatistiklerini getirir
    /// </summary>
    [HttpGet("reports/search-statistics")]
    public async Task<IActionResult> GetSearchStatistics(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var query = _db.SearchLogs.AsQueryable();

        if (startDate.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(s => s.CreatedAtUtc <= endDate.Value);
        }

        var totalSearches = await query.CountAsync();
        var productSearches = await query.CountAsync(s => s.SearchType == SearchType.Products);
        var userSearches = await query.CountAsync(s => s.SearchType == SearchType.Users);
        var anonymousSearches = await query.CountAsync(s => s.UserId == null);
        var authenticatedSearches = await query.CountAsync(s => s.UserId != null);

        // En çok aranan sorgular (top 20)
        var topQueries = await query
            .Where(s => !string.IsNullOrWhiteSpace(s.Query))
            .GroupBy(s => s.Query)
            .Select(g => new
            {
                query = g.Key,
                count = g.Count()
            })
            .OrderByDescending(x => x.count)
            .Take(20)
            .ToListAsync();

        // En çok aranan kategoriler (top 20)
        var topCategories = await query
            .Where(s => s.CategoryId.HasValue)
            .GroupBy(s => s.CategoryId)
            .Select(g => new
            {
                categoryId = g.Key,
                count = g.Count()
            })
            .OrderByDescending(x => x.count)
            .Take(20)
            .ToListAsync();

        // Kategori isimlerini al
        var categoryIds = topCategories.Select(tc => tc.categoryId!.Value).ToList();
        var categories = await _db.Categories
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);

        var topCategoriesWithNames = topCategories.Select(tc => new
        {
            categoryId = tc.categoryId,
            categoryName = tc.categoryId.HasValue && categories.ContainsKey(tc.categoryId.Value) 
                ? categories[tc.categoryId.Value] 
                : "Unknown",
            count = tc.count
        }).ToList();

        // Günlük arama trendi (son 30 gün)
        var dailySearchCounts = new List<object>();
        var daysToShow = 30;
        for (int i = daysToShow - 1; i >= 0; i--)
        {
            var date = DateTime.UtcNow.AddDays(-i).Date;
            var count = await query
                .CountAsync(s => s.CreatedAtUtc.Date == date);
            dailySearchCounts.Add(new { date = date.ToString("yyyy-MM-dd"), count });
        }

        // Arama tipine göre günlük trend (son 7 gün)
        var dailySearchByType = new List<object>();
        for (int i = 6; i >= 0; i--)
        {
            var date = DateTime.UtcNow.AddDays(-i).Date;
            var productCount = await query
                .CountAsync(s => s.SearchType == SearchType.Products && s.CreatedAtUtc.Date == date);
            var userCount = await query
                .CountAsync(s => s.SearchType == SearchType.Users && s.CreatedAtUtc.Date == date);
            dailySearchByType.Add(new 
            { 
                date = date.ToString("yyyy-MM-dd"), 
                products = productCount,
                users = userCount
            });
        }

        // Ortalama sonuç sayısı
        var avgResultCount = await query
            .Where(s => s.ResultCount > 0)
            .AverageAsync(s => (double?)s.ResultCount) ?? 0;

        return Ok(new
        {
            totalSearches,
            productSearches,
            userSearches,
            anonymousSearches,
            authenticatedSearches,
            topQueries,
            topCategories = topCategoriesWithNames,
            dailySearchCounts,
            dailySearchByType,
            avgResultCount = Math.Round(avgResultCount, 2)
        });
    }

    #endregion

    #region Premium Management

    /// <summary>
    /// Kullanıcının premium plan durumunu getir
    /// </summary>
    [HttpGet("users/{userId}/plan")]
    public async Task<IActionResult> GetUserPlan(string userId)
    {
        var user = await _db.Users.OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        
        var details = await _entitlementService.GetPlanDetailsAsync(userId);
        var activeEntitlement = await _entitlementService.GetActiveEntitlementAsync(userId);
        
        // Entitlement geçmişi
        var history = await _db.UserEntitlements
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAtUtc)
            .Select(e => new
            {
                e.Id,
                e.EntitlementType,
                e.Source,
                e.Status,
                e.StartsAtUtc,
                e.EndsAtUtc,
                e.CreatedAtUtc,
                e.Notes,
                e.GrantedByUserId,
            })
            .ToListAsync();
        
        return Ok(new
        {
            userId,
            displayName = user.UserName, // DisplayName kaldırıldı, UserName kullanılıyor
            email = user.Email,
            plan = details,
            activeEntitlementId = activeEntitlement?.Id,
            history,
        });
    }

    /// <summary>
    /// Kullanıcıya premium ver
    /// </summary>
    [HttpPost("users/{userId}/plan/grant")]
    public async Task<IActionResult> GrantPremium(string userId, [FromBody] AdminGrantPremiumRequest request)
    {
        var user = await _db.Users.OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        
        var adminUserId = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
        
        TimeSpan? duration = request.DurationDays.HasValue 
            ? TimeSpan.FromDays(request.DurationDays.Value) 
            : null; // null = lifetime
        
        var entitlement = await _entitlementService.GrantPremiumAsync(new GrantPremiumRequest
        {
            UserId = userId,
            Duration = duration,
            Source = HobbyCollection.Domain.Entities.EntitlementSource.AdminGrant,
            GrantedByUserId = adminUserId,
            Notes = request.Notes,
        });
        
        _logger.LogInformation(
            "Admin {AdminId} granted premium to user {UserId}. Duration: {Duration} days", 
            adminUserId, userId, request.DurationDays ?? -1);
        
        return Ok(new
        {
            message = "Premium başarıyla verildi.",
            entitlementId = entitlement.Id,
            endsAt = entitlement.EndsAtUtc,
            isLifetime = entitlement.EndsAtUtc == null,
        });
    }

    /// <summary>
    /// Kullanıcının premium hakkını iptal et
    /// </summary>
    [HttpPost("users/{userId}/plan/revoke")]
    public async Task<IActionResult> RevokePremium(string userId, [FromBody] AdminRevokePremiumRequest? request = null)
    {
        var user = await _db.Users.OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        
        var activeEntitlement = await _entitlementService.GetActiveEntitlementAsync(userId);
        if (activeEntitlement == null)
            return BadRequest(new { message = "Kullanıcının aktif premium aboneliği yok." });
        
        var adminUserId = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
        
        await _entitlementService.RevokePremiumAsync(userId, adminUserId, request?.Reason);
        
        _logger.LogInformation(
            "Admin {AdminId} revoked premium from user {UserId}. Reason: {Reason}", 
            adminUserId, userId, request?.Reason ?? "N/A");
        
        return Ok(new { message = "Premium başarıyla iptal edildi." });
    }

    /// <summary>
    /// Kullanıcının premium süresini uzat
    /// </summary>
    [HttpPost("users/{userId}/plan/extend")]
    public async Task<IActionResult> ExtendPremium(string userId, [FromBody] AdminExtendPremiumRequest request)
    {
        var user = await _db.Users.OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        
        if (request.Days <= 0)
            return BadRequest(new { message = "Gün sayısı 0'dan büyük olmalı." });
        
        var adminUserId = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
        
        await _entitlementService.ExtendPremiumAsync(
            userId, 
            TimeSpan.FromDays(request.Days), 
            adminUserId, 
            request.Notes);
        
        var details = await _entitlementService.GetPlanDetailsAsync(userId);
        
        _logger.LogInformation(
            "Admin {AdminId} extended premium for user {UserId} by {Days} days", 
            adminUserId, userId, request.Days);
        
        return Ok(new
        {
            message = $"Premium {request.Days} gün uzatıldı.",
            newEndsAt = details?.EndsAtUtc,
        });
    }

    /// <summary>
    /// Premium kullanıcı listesi
    /// </summary>
    [HttpGet("premium-users")]
    public async Task<IActionResult> GetPremiumUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = "active")
    {
        var query = _db.UserEntitlements
            .AsNoTracking()
            .Where(e => e.EntitlementType == HobbyCollection.Domain.Entities.EntitlementType.Premium);
        
        if (status == "active")
        {
            var now = DateTime.UtcNow;
            query = query.Where(e => 
                (e.Status == HobbyCollection.Domain.Entities.EntitlementStatus.Active || 
                 e.Status == HobbyCollection.Domain.Entities.EntitlementStatus.Grace) &&
                (e.EndsAtUtc == null || e.EndsAtUtc > now));
        }
        else if (status == "expired")
        {
            query = query.Where(e => 
                e.Status == HobbyCollection.Domain.Entities.EntitlementStatus.Expired);
        }
        else if (status == "cancelled")
        {
            query = query.Where(e => 
                e.Status == HobbyCollection.Domain.Entities.EntitlementStatus.Cancelled);
        }
        
        var totalCount = await query.CountAsync();
        
        var entitlements = await query
            .OrderByDescending(e => e.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        
        var userIds = entitlements.Select(e => e.UserId).Distinct().ToList();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new { u.UserName, u.Email }); // DisplayName kaldırıldı
        
        var result = entitlements.Select(e => new
        {
            e.Id,
            e.UserId,
            displayName = users.TryGetValue(e.UserId, out var u) ? u.UserName : "Unknown", // DisplayName kaldırıldı, UserName kullanılıyor
            email = users.TryGetValue(e.UserId, out var u2) ? u2.Email : null,
            e.Source,
            e.Status,
            e.StartsAtUtc,
            e.EndsAtUtc,
            e.CreatedAtUtc,
            isLifetime = e.EndsAtUtc == null,
            daysRemaining = e.EndsAtUtc.HasValue 
                ? (int)Math.Ceiling((e.EndsAtUtc.Value - DateTime.UtcNow).TotalDays) 
                : (int?)null,
        });
        
        return Ok(new
        {
            items = result,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
        });
    }

    /// <summary>
    /// Premium kullanıcıları kategorize ederek getirir
    /// </summary>
    [HttpGet("premium")]
    public async Task<IActionResult> GetPremiumUsersCategorized(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var now = DateTime.UtcNow;
        var sevenDaysFromNow = now.AddDays(7);

        // 1. Premium kullanıcılar (aktif, kalan günleri ile)
        var activePremiumEntitlements = await _db.UserEntitlements
            .AsNoTracking()
            .Where(e => e.EntitlementType == Domain.Entities.EntitlementType.Premium)
            .Where(e => (e.Status == Domain.Entities.EntitlementStatus.Active || 
                         e.Status == Domain.Entities.EntitlementStatus.Grace) &&
                        (e.EndsAtUtc == null || e.EndsAtUtc > now))
            .ToListAsync();

        // 2. Premium'dan düşecek kullanıcılar (7 gün içinde bitecek)
        var expiringSoonEntitlements = activePremiumEntitlements
            .Where(e => e.EndsAtUtc.HasValue && 
                       e.EndsAtUtc.Value > now && 
                       e.EndsAtUtc.Value <= sevenDaysFromNow)
            .ToList();

        // 3. Premium'dan düşmüş kullanıcılar (expired)
        var expiredEntitlements = await _db.UserEntitlements
            .AsNoTracking()
            .Where(e => e.EntitlementType == Domain.Entities.EntitlementType.Premium)
            .Where(e => e.Status == Domain.Entities.EntitlementStatus.Expired)
            .OrderByDescending(e => e.EndsAtUtc ?? e.CreatedAtUtc)
            .ToListAsync();

        // 4. Standart kullanıcılar (premium olmayan)
        var allPremiumUserIds = await _db.UserEntitlements
            .AsNoTracking()
            .Where(e => e.EntitlementType == Domain.Entities.EntitlementType.Premium)
            .Where(e => e.Status == Domain.Entities.EntitlementStatus.Active || 
                       e.Status == Domain.Entities.EntitlementStatus.Grace)
            .Where(e => e.EndsAtUtc == null || e.EndsAtUtc > now)
            .Select(e => e.UserId)
            .Distinct()
            .ToListAsync();
        
        var standardUsersQuery = _db.Users.OfType<ApplicationUser>()
            .AsNoTracking()
            .Where(u => !allPremiumUserIds.Contains(u.Id));
        
        var totalStandardUsers = await standardUsersQuery.CountAsync();
        var standardUsers = await standardUsersQuery
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Tüm kullanıcı ID'lerini topla
        var allUserIds = activePremiumEntitlements.Select(e => e.UserId)
            .Concat(expiredEntitlements.Select(e => e.UserId))
            .Concat(standardUsers.Select(u => u.Id))
            .Distinct()
            .ToList();

        // Kullanıcı bilgilerini al
        var users = await _db.Users.OfType<ApplicationUser>()
            .AsNoTracking()
            .Where(u => allUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u);

        // AI kredi bilgilerini al
        var aiCredits = await _db.UserAICredits
            .AsNoTracking()
            .Where(c => allUserIds.Contains(c.UserId))
            .ToDictionaryAsync(c => c.UserId, c => c.CurrentBalance);

        // Gizli ürün sayılarını al
        var privateProductCounts = await _db.Products
            .AsNoTracking()
            .Where(p => allUserIds.Contains(p.UserId) && p.IsPublic == false)
            .GroupBy(p => p.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        // Premium kullanıcıları formatla
        var premiumUsers = activePremiumEntitlements.Select(e =>
        {
            var user = users.TryGetValue(e.UserId, out var u) ? u : null;
            var daysRemaining = e.EndsAtUtc.HasValue
                ? (int?)Math.Ceiling((e.EndsAtUtc.Value - now).TotalDays)
                : null;
            
            return new
            {
                userId = e.UserId,
                userName = user?.UserName ?? "Unknown",
                email = user?.Email,
                isPrivateAccount = user?.IsPrivateAccount ?? false,
                isWebProfilePublic = user?.IsWebProfilePublic,
                privateProductCount = privateProductCounts.TryGetValue(e.UserId, out var ppc) ? ppc : 0,
                aiCreditBalance = aiCredits.TryGetValue(e.UserId, out var balance) ? balance : 0,
                entitlementId = e.Id,
                source = e.Source.ToString(),
                status = e.Status.ToString(),
                startsAtUtc = e.StartsAtUtc,
                endsAtUtc = e.EndsAtUtc,
                isLifetime = e.EndsAtUtc == null,
                daysRemaining = daysRemaining,
                category = "active"
            };
        }).ToList();

        // Premium'dan düşecek kullanıcıları formatla
        var expiringSoonUsers = expiringSoonEntitlements.Select(e =>
        {
            var user = users.TryGetValue(e.UserId, out var u) ? u : null;
            var daysRemaining = e.EndsAtUtc.HasValue
                ? (int?)Math.Ceiling((e.EndsAtUtc.Value - now).TotalDays)
                : null;
            
            return new
            {
                userId = e.UserId,
                userName = user?.UserName ?? "Unknown",
                email = user?.Email,
                isPrivateAccount = user?.IsPrivateAccount ?? false,
                isWebProfilePublic = user?.IsWebProfilePublic,
                privateProductCount = privateProductCounts.TryGetValue(e.UserId, out var ppc) ? ppc : 0,
                aiCreditBalance = aiCredits.TryGetValue(e.UserId, out var balance) ? balance : 0,
                entitlementId = e.Id,
                source = e.Source.ToString(),
                status = e.Status.ToString(),
                startsAtUtc = e.StartsAtUtc,
                endsAtUtc = e.EndsAtUtc,
                isLifetime = e.EndsAtUtc == null,
                daysRemaining = daysRemaining,
                category = "expiring_soon"
            };
        }).ToList();

        // Premium'dan düşmüş kullanıcıları formatla
        var expiredUsers = expiredEntitlements.Select(e =>
        {
            var user = users.TryGetValue(e.UserId, out var u) ? u : null;
            
            return new
            {
                userId = e.UserId,
                userName = user?.UserName ?? "Unknown",
                email = user?.Email,
                isPrivateAccount = user?.IsPrivateAccount ?? false,
                isWebProfilePublic = user?.IsWebProfilePublic,
                privateProductCount = privateProductCounts.TryGetValue(e.UserId, out var ppc) ? ppc : 0,
                aiCreditBalance = aiCredits.TryGetValue(e.UserId, out var balance) ? balance : 0,
                entitlementId = e.Id,
                source = e.Source.ToString(),
                status = e.Status.ToString(),
                startsAtUtc = e.StartsAtUtc,
                endsAtUtc = e.EndsAtUtc,
                expiredAt = e.EndsAtUtc ?? e.UpdatedAtUtc ?? e.CreatedAtUtc,
                category = "expired"
            };
        }).ToList();

        // Standart kullanıcıları formatla
        var standardUsersList = standardUsers.Select(u =>
        {
            return new
            {
                userId = u.Id,
                userName = u.UserName ?? "Unknown",
                email = u.Email,
                isPrivateAccount = u.IsPrivateAccount,
                isWebProfilePublic = u.IsWebProfilePublic,
                privateProductCount = privateProductCounts.TryGetValue(u.Id, out var ppc) ? ppc : 0,
                aiCreditBalance = aiCredits.TryGetValue(u.Id, out var balance) ? balance : 0,
                category = "standard"
            };
        }).ToList();

        return Ok(new
        {
            premium = new
            {
                items = premiumUsers,
                totalCount = premiumUsers.Count
            },
            expiringSoon = new
            {
                items = expiringSoonUsers,
                totalCount = expiringSoonUsers.Count
            },
            expired = new
            {
                items = expiredUsers,
                totalCount = expiredUsers.Count
            },
            standard = new
            {
                items = standardUsersList,
                totalCount = totalStandardUsers,
                page = page,
                pageSize = pageSize,
                totalPages = (int)Math.Ceiling((double)totalStandardUsers / pageSize)
            }
        });
    }

    public record AdminGrantPremiumRequest(int? DurationDays, string? Notes);
    public record AdminRevokePremiumRequest(string? Reason);
    public record AdminExtendPremiumRequest(int Days, string? Notes);

    /// <summary>
    /// Kullanıcının neden silinmediğini kontrol et (debug endpoint)
    /// </summary>
    [HttpGet("debug/user-deletion-status")]
    public async Task<IActionResult> CheckUserDeletionStatus([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { message = "Email parametresi gereklidir." });
        }

        var user = await _db.Users
            .OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return NotFound(new { message = $"Kullanıcı bulunamadı: {email}" });
        }

        var now = DateTime.UtcNow;
        var cutoffDate = now.AddHours(-24);
        var age = now - user.CreatedAt;
        var isOlderThan24Hours = user.CreatedAt < cutoffDate;

        // İlişkili verileri kontrol et
        var hasProducts = await _db.Products.AnyAsync(p => p.UserId == user.Id);
        var hasComments = await _db.Comments.AnyAsync(c => c.UserId == user.Id);
        var hasLikes = await _db.ProductLikes.AnyAsync(pl => pl.UserId == user.Id);
        var hasSaves = await _db.ProductSaves.AnyAsync(ps => ps.UserId == user.Id);
        var hasFollows = await _db.Follows.AnyAsync(f => f.FollowerId == user.Id || f.FollowingId == user.Id);
        var hasConversations = await _db.Conversations.AnyAsync(c => c.User1Id == user.Id || c.User2Id == user.Id);
        var hasMessages = await _db.Messages.AnyAsync(m => m.SenderId == user.Id || m.ReceiverId == user.Id);

        // Silinme kriterlerine uyuyor mu?
        var shouldBeDeleted = !user.EmailConfirmed && isOlderThan24Hours;

        var reasons = new List<string>();
        if (user.EmailConfirmed)
        {
            reasons.Add("EmailConfirmed = true (Email onaylanmış, bu yüzden silinmez)");
        }
        if (!isOlderThan24Hours)
        {
            reasons.Add($"CreatedAt ({user.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC) < cutoffDate ({cutoffDate:yyyy-MM-dd HH:mm:ss} UTC) değil (Son 24 saat içinde oluşturulmuş)");
        }

        return Ok(new
        {
            email = user.Email,
            userId = user.Id,
            emailConfirmed = user.EmailConfirmed,
            createdAt = user.CreatedAt,
            age = new
            {
                totalHours = Math.Round(age.TotalHours, 2),
                totalDays = Math.Round(age.TotalDays, 2),
                formatted = $"{age.Days} gün, {age.Hours} saat, {age.Minutes} dakika"
            },
            cutoffDate = cutoffDate,
            isOlderThan24Hours = isOlderThan24Hours,
            shouldBeDeleted = shouldBeDeleted,
            reasons = reasons,
            relatedData = new
            {
                hasProducts = hasProducts,
                hasComments = hasComments,
                hasLikes = hasLikes,
                hasSaves = hasSaves,
                hasFollows = hasFollows,
                hasConversations = hasConversations,
                hasMessages = hasMessages
            },
            summary = shouldBeDeleted
                ? (reasons.Any() 
                    ? "Silinme kriterlerine uyuyor, ancak yukarıdaki nedenlerle silinmemiş olabilir."
                    : "Silinme kriterlerine uyuyor. Service henüz çalışmamış olabilir veya silme işlemi başarısız olmuş olabilir.")
                : "Silinme kriterlerine uymuyor. Yukarıdaki nedenlerden dolayı silinmez."
        });
    }

    #endregion

    #region Content Reports (Şikayetler)

    /// <summary>
    /// Şikayetleri listeler (pagination ve filtreleme ile)
    /// </summary>
    [HttpGet("content-reports")]
    public async Task<IActionResult> GetContentReports(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = null,
        [FromQuery] string? contentType = null,
        [FromQuery] string? reason = null)
    {
        var query = _db.ContentReports.AsQueryable();

        // Filtreler
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status == status.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(contentType))
        {
            query = query.Where(r => r.ContentType == contentType.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(reason))
        {
            query = query.Where(r => r.Reason == reason.ToLower());
        }

        var total = await query.CountAsync();

        var reports = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Reporter ve reviewed by kullanıcı bilgilerini al
        var reporterUserIds = reports.Select(r => r.ReporterUserId).Distinct().ToList();
        var reviewedByUserIds = reports.Where(r => !string.IsNullOrEmpty(r.ReviewedByUserId))
            .Select(r => r.ReviewedByUserId!).Distinct().ToList();
        var allUserIds = reporterUserIds.Concat(reviewedByUserIds).Distinct().ToList();

        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => allUserIds.Contains(u.Id))
            .ToListAsync();

        var userDict = users.ToDictionary(u => u.Id, u => new
        {
            id = u.Id,
            email = u.Email,
            username = _usernameService.GetUserCurrentUsername(u)
        });

        // İçerik bilgilerini al
        var productIds = reports.Where(r => r.ContentType == "product")
            .Select(r => r.ContentId).ToList();
        var commentIds = reports.Where(r => r.ContentType == "comment")
            .Select(r => r.ContentId).ToList();
        var reportedUserIds = reports.Where(r => r.ContentType == "user")
            .Select(r => r.ContentId).ToList();

        var products = await _db.Products
            .Where(p => productIds.Contains(p.Id.ToString()))
            .Select(p => new { id = p.Id.ToString(), title = p.Title, userId = p.UserId })
            .ToListAsync();

        var comments = await _db.Comments
            .Where(c => commentIds.Contains(c.Id.ToString()))
            .Select(c => new { id = c.Id.ToString(), text = c.Text, userId = c.UserId, productId = c.ProductId })
            .ToListAsync();

        var reportedUsers = await _db.Users.OfType<ApplicationUser>()
            .Where(u => reportedUserIds.Contains(u.Id))
            .Select(u => new { id = u.Id, email = u.Email, username = u.UserName })
            .ToListAsync();

        var result = reports.Select(r =>
        {
            dynamic? contentInfo = null;
            if (r.ContentType == "product")
            {
                var product = products.FirstOrDefault(p => p.id == r.ContentId);
                if (product != null)
                {
                    contentInfo = new
                    {
                        id = product.id,
                        title = product.title,
                        userId = product.userId
                    };
                }
            }
            else if (r.ContentType == "comment")
            {
                var comment = comments.FirstOrDefault(c => c.id == r.ContentId);
                if (comment != null)
                {
                    contentInfo = new
                    {
                        id = comment.id,
                        text = comment.text,
                        userId = comment.userId,
                        productId = comment.productId
                    };
                }
            }
            else if (r.ContentType == "user")
            {
                var user = reportedUsers.FirstOrDefault(u => u.id == r.ContentId);
                if (user != null)
                {
                    contentInfo = new
                    {
                        id = user.id,
                        email = user.email,
                        username = user.username
                    };
                }
            }

            return new
            {
                id = r.Id,
                reporterUserId = r.ReporterUserId,
                reporter = userDict.ContainsKey(r.ReporterUserId) ? userDict[r.ReporterUserId] : null,
                contentType = r.ContentType,
                contentId = r.ContentId,
                content = contentInfo,
                reason = r.Reason,
                description = r.Description,
                status = r.Status,
                adminNote = r.AdminNote,
                reviewedByUserId = r.ReviewedByUserId,
                reviewedBy = !string.IsNullOrEmpty(r.ReviewedByUserId) && userDict.ContainsKey(r.ReviewedByUserId) 
                    ? userDict[r.ReviewedByUserId] 
                    : null,
                createdAt = r.CreatedAt,
                reviewedAt = r.ReviewedAt
            };
        }).ToList();

        return Ok(new { total, page, pageSize, items = result });
    }

    /// <summary>
    /// Şikayet detayını getirir
    /// </summary>
    [HttpGet("content-reports/{id}")]
    public async Task<IActionResult> GetContentReport(Guid id)
    {
        var report = await _db.ContentReports.FirstOrDefaultAsync(r => r.Id == id);
        if (report == null) return NotFound("Şikayet bulunamadı.");

        // Kullanıcı bilgilerini al
        var reporter = await _db.Users.OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == report.ReporterUserId);
        var reviewedBy = !string.IsNullOrEmpty(report.ReviewedByUserId)
            ? await _db.Users.OfType<ApplicationUser>()
                .FirstOrDefaultAsync(u => u.Id == report.ReviewedByUserId)
            : null;

        // İçerik bilgisini al
        dynamic? contentInfo = null;
        if (report.ContentType == "product")
        {
            if (Guid.TryParse(report.ContentId, out var productId))
            {
                var product = await _db.Products
                    .Include(p => p.Photos.OrderBy(ph => ph.Order))
                    .FirstOrDefaultAsync(p => p.Id == productId);
                if (product != null)
                {
                    contentInfo = new
                    {
                        id = product.Id.ToString(),
                        title = product.Title,
                        description = product.Description,
                        userId = product.UserId,
                        isPublic = product.IsPublic,
                        createdAt = product.CreatedAt
                    };
                }
            }
        }
        else if (report.ContentType == "comment")
        {
            if (Guid.TryParse(report.ContentId, out var commentId))
            {
                var comment = await _db.Comments
                    .Include(c => c.Product)
                    .FirstOrDefaultAsync(c => c.Id == commentId);
                if (comment != null)
                {
                    contentInfo = new
                    {
                        id = comment.Id.ToString(),
                        text = comment.Text,
                        userId = comment.UserId,
                        productId = comment.ProductId,
                        productTitle = comment.Product?.Title,
                        createdAt = comment.CreatedAt
                    };
                }
            }
        }
        else if (report.ContentType == "user")
        {
            var user = await _db.Users.OfType<ApplicationUser>()
                .FirstOrDefaultAsync(u => u.Id == report.ContentId);
            if (user != null)
            {
                contentInfo = new
                {
                    id = user.Id,
                    email = user.Email,
                    username = _usernameService.GetUserCurrentUsername(user),
                    isPrivateAccount = user.IsPrivateAccount,
                    createdAt = user.CreatedAt
                };
            }
        }

        return Ok(new
        {
            id = report.Id,
            reporterUserId = report.ReporterUserId,
            reporter = reporter != null ? new
            {
                id = reporter.Id,
                email = reporter.Email,
                username = _usernameService.GetUserCurrentUsername(reporter)
            } : null,
            contentType = report.ContentType,
            contentId = report.ContentId,
            content = contentInfo,
            reason = report.Reason,
            description = report.Description,
            status = report.Status,
            adminNote = report.AdminNote,
            reviewedByUserId = report.ReviewedByUserId,
            reviewedBy = reviewedBy != null ? new
            {
                id = reviewedBy.Id,
                email = reviewedBy.Email,
                username = _usernameService.GetUserCurrentUsername(reviewedBy)
            } : null,
            createdAt = report.CreatedAt,
            reviewedAt = report.ReviewedAt
        });
    }

    /// <summary>
    /// Şikayeti değerlendirir (onay/red)
    /// </summary>
    [HttpPost("content-reports/{id}/review")]
    public async Task<IActionResult> ReviewContentReport(
        Guid id,
        [FromBody] ReviewReportRequest request)
    {
        var adminUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminUserId)) return Unauthorized();

        var report = await _db.ContentReports.FirstOrDefaultAsync(r => r.Id == id);
        if (report == null) return NotFound("Şikayet bulunamadı.");

        if (report.Status != "pending")
        {
            return BadRequest(new { message = "Bu şikayet zaten değerlendirilmiş." });
        }

        if (request == null || string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest(new { message = "Status zorunludur." });
        }

        var validStatuses = new[] { "reviewed", "resolved", "rejected" };
        if (!validStatuses.Contains(request.Status.ToLower()))
        {
            return BadRequest(new { message = "Geçersiz status. 'reviewed', 'resolved' veya 'rejected' olmalıdır." });
        }

        report.Status = request.Status.ToLower();
        report.ReviewedByUserId = adminUserId;
        report.ReviewedAt = DateTime.UtcNow;
        report.AdminNote = string.IsNullOrWhiteSpace(request.AdminNote) ? null : request.AdminNote.Trim();

        await _db.SaveChangesAsync();

        _logger.LogInformation("Şikayet değerlendirildi: {ReportId}, Durum: {Status}, Admin: {AdminUserId}", 
            report.Id, report.Status, adminUserId);

        return Ok(new { 
            id = report.Id, 
            status = report.Status,
            message = "Şikayet değerlendirildi." 
        });
    }

    /// <summary>
    /// Şikayet istatistiklerini getirir
    /// </summary>
    [HttpGet("content-reports/statistics")]
    public async Task<IActionResult> GetContentReportStatistics(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var query = _db.ContentReports.AsQueryable();

        if (startDate.HasValue)
        {
            query = query.Where(r => r.CreatedAt >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(r => r.CreatedAt <= endDate.Value);
        }

        var total = await query.CountAsync();
        var pending = await query.CountAsync(r => r.Status == "pending");
        var reviewed = await query.CountAsync(r => r.Status == "reviewed");
        var resolved = await query.CountAsync(r => r.Status == "resolved");
        var rejected = await query.CountAsync(r => r.Status == "rejected");

        var byContentType = await query
            .GroupBy(r => r.ContentType)
            .Select(g => new { contentType = g.Key, count = g.Count() })
            .ToListAsync();

        var byReason = await query
            .GroupBy(r => r.Reason)
            .Select(g => new { reason = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToListAsync();

        return Ok(new
        {
            total,
            pending,
            reviewed,
            resolved,
            rejected,
            byContentType,
            byReason
        });
    }

    public record ReviewReportRequest(
        string Status, // "reviewed", "resolved", "rejected"
        string? AdminNote = null
    );

    #endregion

    #region App Version Management

    /// <summary>
    /// Tüm sürümleri ve kullanan kullanıcıları getirir
    /// </summary>
    [HttpGet("app-versions")]
    public async Task<IActionResult> GetAppVersions()
    {
        // Tüm kullanıcıların cihaz bilgilerini getir (AppVersion bilgisi olanlar)
        var deviceInfos = await _db.UserDeviceInfos
            .Where(d => !string.IsNullOrEmpty(d.AppVersion))
            .Select(d => new { d.UserId, d.AppVersion })
            .ToListAsync();

        // Tüm kullanılan sürümleri bul (hem AppVersions tablosundan hem de deviceInfos'tan)
        var allUsedVersions = deviceInfos
            .Select(d => d.AppVersion)
            .Where(v => !string.IsNullOrEmpty(v))
            .Distinct()
            .ToList();

        // AppVersions tablosundaki tüm sürümleri getir
        var versionsInDb = await _db.AppVersions
            .ToListAsync();

        var versionDict = versionsInDb.ToDictionary(v => v.Version, v => v);

        // Tüm kullanılan sürümler için AppVersion kaydı oluştur (yoksa)
        foreach (var usedVersion in allUsedVersions)
        {
            if (!versionDict.ContainsKey(usedVersion!))
            {
                var newVersion = new AppVersion
                {
                    Id = Guid.NewGuid(),
                    Version = usedVersion!,
                    IsValid = true, // Varsayılan olarak geçerli
                    CreatedAtUtc = DateTime.UtcNow
                };
                _db.AppVersions.Add(newVersion);
                versionDict[usedVersion!] = newVersion;
            }
        }

        await _db.SaveChangesAsync();

        // Tüm sürümleri tekrar getir (yeni eklenenlerle birlikte)
        // Sürüm numaralarına göre sırala (semver: en yeni en üstte)
        var allVersions = await _db.AppVersions
            .ToListAsync();
        
        // Semver formatına göre sırala (1.2.29 > 1.2.28 > 1.2.1 > 1.1.0)
        allVersions = allVersions
            .OrderByDescending(v => ParseVersion(v.Version))
            .ThenByDescending(v => v.CreatedAtUtc) // Aynı sürüm numarası varsa tarihe göre
            .ToList();

        // Kullanıcı bilgilerini getir (tüm kullanıcılar)
        var allUserIds = await _db.Users.Select(u => u.Id).ToListAsync();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => allUserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.UserName, u.Email })
            .ToDictionaryAsync(u => u.Id, u => u);

        // Sürüm bazında kullanıcıları grupla
        var versionGroups = deviceInfos
            .GroupBy(d => d.AppVersion)
            .ToDictionary(g => g.Key ?? "Unknown", g => g.Select(x => x.UserId).Distinct().ToList());

        // Sürümü bilinmeyen kullanıcılar (hiç cihaz bilgisi yok veya AppVersion null)
        var usersWithVersion = deviceInfos.Select(d => d.UserId).Distinct().ToList();
        var usersWithoutVersion = allUserIds.Except(usersWithVersion).ToList();

        // Her sürüm için kullanıcı listesi oluştur
        var result = allVersions.Select(v => new
        {
            id = v.Id,
            version = v.Version,
            isValid = v.IsValid,
            createdAtUtc = v.CreatedAtUtc,
            updatedAtUtc = v.UpdatedAtUtc,
            userCount = versionGroups.TryGetValue(v.Version, out var userIdsForVersion) ? userIdsForVersion.Count : 0,
            users = versionGroups.TryGetValue(v.Version, out var userIdsForVersion2) 
                ? userIdsForVersion2.Select(uid => users.TryGetValue(uid, out var u) 
                    ? new { userId = uid, userName = u.UserName ?? "Unknown", email = u.Email }
                    : new { userId = uid, userName = "Unknown", email = (string?)null })
                    .Cast<object>()
                    .ToList()
                : new List<object>()
        }).ToList();

        // Sürümü bilinmeyen kullanıcılar
        var unknownVersionUsers = usersWithoutVersion
            .Select(uid => users.TryGetValue(uid, out var u)
                ? new { userId = uid, userName = u.UserName ?? "Unknown", email = u.Email }
                : new { userId = uid, userName = "Unknown", email = (string?)null })
            .ToList();

        return Ok(new
        {
            versions = result,
            unknownVersion = new
            {
                userCount = unknownVersionUsers.Count,
                users = unknownVersionUsers
            }
        });
    }

    /// <summary>
    /// Sürümün geçerliliğini günceller
    /// </summary>
    [HttpPut("app-versions/{id}/validity")]
    public async Task<IActionResult> UpdateVersionValidity(Guid id, [FromBody] UpdateVersionValidityRequest request)
    {
        var version = await _db.AppVersions.FindAsync(id);
        if (version == null)
        {
            return NotFound(new { message = "Sürüm bulunamadı." });
        }

        version.IsValid = request.IsValid;
        version.UpdatedAtUtc = DateTime.UtcNow;
        
        await _db.SaveChangesAsync();

        _logger.LogInformation("App version {Version} validity updated to {IsValid} by admin", 
            version.Version, request.IsValid);

        return Ok(new
        {
            message = $"Sürüm {version.Version} geçerliliği güncellendi.",
            version = new
            {
                id = version.Id,
                version = version.Version,
                isValid = version.IsValid
            }
        });
    }

    public record UpdateVersionValidityRequest(bool IsValid);

    /// <summary>
    /// Semver formatındaki sürüm string'ini parse edip karşılaştırılabilir tuple döndürür
    /// Örnek: "1.2.29" -> (1, 2, 29)
    /// </summary>
    private (int major, int minor, int patch) ParseVersion(string version)
    {
        if (string.IsNullOrWhiteSpace(version))
            return (0, 0, 0);

        var parts = version.Split('.');
        if (parts.Length < 1) return (0, 0, 0);

        int major = 0, minor = 0, patch = 0;

        if (parts.Length >= 1 && int.TryParse(parts[0], out var m))
            major = m;

        if (parts.Length >= 2 && int.TryParse(parts[1], out var mi))
            minor = mi;

        if (parts.Length >= 3 && int.TryParse(parts[2], out var p))
            patch = p;

        return (major, minor, patch);
    }

    #endregion
}

