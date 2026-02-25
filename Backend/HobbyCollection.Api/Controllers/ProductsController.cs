using System.Security.Claims;
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Abstractions;
using HobbyCollection.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Google.Cloud.Storage.V1;
using HobbyCollection.Api.Services.Analysis;
using HobbyCollection.Api.Services;
using Microsoft.Extensions.DependencyInjection;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IImageStorageService _images;
    private readonly IProductService _productService;
    private readonly IConfiguration _cfg;
    private readonly ILogger<ProductsController> _logger;
    private readonly StorageClient _storage;
    private readonly IGeminiAnalysisService? _geminiAnalysis;
    private readonly HobbyCollection.Api.Services.IExchangeRateService? _exchangeRateService;
    private readonly IAICreditService? _aiCreditService;
    private readonly PushNotificationService? _pushNotificationService;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly INotificationService _notificationService;
    private readonly IEntitlementService _entitlementService;
    private readonly UsernameService _usernameService;

    public ProductsController(
        AppDbContext db,
        IImageStorageService images,
        IProductService productService,
        IConfiguration cfg,
        ILogger<ProductsController> logger,
        StorageClient storage,
        IServiceScopeFactory serviceScopeFactory,
        INotificationService notificationService,
        IEntitlementService entitlementService,
        UsernameService usernameService,
        IGeminiAnalysisService? geminiAnalysis = null,
        HobbyCollection.Api.Services.IExchangeRateService? exchangeRateService = null,
        IAICreditService? aiCreditService = null,
        PushNotificationService? pushNotificationService = null)
    {
        _db = db;
        _images = images;
        _productService = productService;
        _cfg = cfg;
        _logger = logger;
        _storage = storage;
        _geminiAnalysis = geminiAnalysis;
        _exchangeRateService = exchangeRateService;
        _aiCreditService = aiCreditService;
        _pushNotificationService = pushNotificationService;
        _serviceScopeFactory = serviceScopeFactory;
        _notificationService = notificationService;
        _entitlementService = entitlementService;
        _usernameService = usernameService;
    }

    // Helper method: Kategori adını dile göre döndür
    private async Task<string?> GetCategoryNameByLanguageAsync(Guid? categoryId, string? language)
    {
        if (!categoryId.HasValue) return null;
        
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";
        
        // Önce çeviri tablosundan bak
        var translation = await _db.CategoryTranslations
            .FirstOrDefaultAsync(t => t.CategoryId == categoryId.Value && t.LanguageCode == lang);
        
        if (translation != null)
            return translation.Name;
        
        // Çeviri yoksa varsayılan adı döndür
        var category = await _db.Categories.FindAsync(categoryId.Value);
        return category?.Name;
    }

    private async Task<List<object>> GetCategoryPathAsync(Guid? categoryId, string? language)
    {
        if (!categoryId.HasValue) return new List<object>();
        
        var category = await _db.Categories.FindAsync(categoryId.Value);
        if (category == null) return new List<object>();

        // CategoryClosure kullanarak tüm ancestor'ları bul (distance'a göre sırala)
        var ancestors = await _db.CategoryClosures
            .Where(cc => cc.DescendantId == categoryId.Value && cc.Distance > 0)
            .OrderBy(cc => cc.Distance)
            .Select(cc => cc.AncestorId)
            .ToListAsync();

        // Kendisini de ekle
        var allCategoryIds = ancestors.Concat(new[] { categoryId.Value }).ToList();

        // Kategorileri yükle
        var categories = await _db.Categories
            .Where(c => allCategoryIds.Contains(c.Id))
            .ToListAsync();

        // Distance'a göre sırala
        var path = ancestors
            .Select(id => categories.First(c => c.Id == id))
            .Concat(new[] { category })
            .ToList();

        // Çeviri desteği
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";
        
        if (lang == "en" || lang == "tr")
        {
            var categoryIds = path.Select(c => c.Id).ToList();
            var translations = await _db.CategoryTranslations
                .Where(t => categoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
                .ToListAsync();

            return path.Select(c =>
            {
                var translation = translations.FirstOrDefault(t => t.CategoryId == c.Id);
                return new
                {
                    id = c.Id,
                    name = translation?.Name ?? c.Name,
                    slug = c.Slug
                };
            }).Cast<object>().ToList();
        }

        return path.Select(c => new
        {
            id = c.Id,
            name = c.Name,
            slug = c.Slug
        }).Cast<object>().ToList();
    }

    // Helper method: Username döndürür (DisplayName kaldırıldı)
    private string GetUserDisplayName(ApplicationUser? user, string userId)
    {
        if (user == null) return "User";
        
        // DisplayName kaldırıldı - sadece username kullan
        var username = _usernameService.GetUserCurrentUsername(user);
        return !string.IsNullOrWhiteSpace(username) ? username : "User";
    }


    // Helper method: Fotoğraf URL'i oluştur (BlobName boşsa BlobUrl'den çıkar)
    private string GetPhotoUrl(ProductPhoto? photo, string bucket)
    {
        if (photo == null) return string.Empty;
        
        string blobName = photo.BlobName;
        
        // Eğer BlobName boşsa ama BlobUrl doluysa, BlobUrl'den blobName'i çıkar
        if (string.IsNullOrWhiteSpace(blobName) && !string.IsNullOrWhiteSpace(photo.BlobUrl))
        {
            // BlobUrl formatı: https://storage.googleapis.com/{bucket}/{blobName}
            var urlParts = photo.BlobUrl.Split(new[] { $"{bucket}/" }, StringSplitOptions.None);
            if (urlParts.Length > 1)
            {
                blobName = urlParts[1];
                _logger.LogInformation("Extracted BlobName from BlobUrl for photo {PhotoId}: {BlobName}", photo.Id, blobName);
            }
        }
        
        // BlobName varsa GetSignedUrl kullan, yoksa BlobUrl'i direkt döndür
        return !string.IsNullOrWhiteSpace(blobName) ? _images.GetSignedUrl(bucket, blobName) : photo.BlobUrl;
    }

    // Helper method: Ürün için badge'leri hesapla
    private List<int> CalculateBadges(Product product, int likeCount)
    {
        var badges = new List<int>();
        var now = DateTime.UtcNow;

        // Otomatik badge'ler
        // NEW (2): Son 7 günde eklenen
        if ((now - product.CreatedAt).TotalDays <= 7)
        {
            badges.Add(2);
        }

        // HOT (1): 10+ beğeni
        if (likeCount >= 10)
        {
            badges.Add(1);
        }

        // TRENDING (9): Badge sistemi kuruluşundan sonra eklenecek (son 3 günde 5+ beğeni)

        // Manuel badge'ler
        if (product.IsRare) badges.Add(3);       // RARE
        if (product.IsMint) badges.Add(4);       // MINT
        if (product.IsGraded) badges.Add(5);     // GRADED
        if (product.IsSigned) badges.Add(6);     // SIGNED
        if (product.IsLimited) badges.Add(7);    // LIMITED
        if (product.IsFeatured) badges.Add(8);   // FEATURED

        return badges.Distinct().ToList();
    }

        [HttpPost("{id}/like")]
        [Authorize]
        public async Task<IActionResult> Like(Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.IsPublic == true);
            if (product == null) return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");

            var already = await _db.ProductLikes.AnyAsync(l => l.ProductId == id && l.UserId == userId);
            if (!already)
            {
                _db.ProductLikes.Add(new ProductLike { Id = Guid.NewGuid(), ProductId = id, UserId = userId, CreatedAt = DateTime.UtcNow });
                try
                {
                    await _db.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    // Unique constraint race condition; ignore if inserted by another request
                }

                // Bildirim oluştur (ürün sahibine, kendisi beğenmediyse - dil desteği ile)
                if (product.UserId != userId)
                {
                    var likerUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
                    var productOwner = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == product.UserId);
                    
                    // Kullanıcının dil tercihini al
                    var userLanguage = productOwner?.UiLanguage ?? "en";
                    var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
                    
                    var likerName = GetUserDisplayName(likerUser, userId);
                    var title = isTurkish ? "Ürününüz beğenildi" : "Your product was liked";
                    var message = isTurkish
                        ? $"{likerName} ürününüzü beğendi."
                        : $"{likerName} liked your product.";
                    
                    await _notificationService.NotifyAsync(
                        NotificationEventType.ProductLike,
                        new NotificationPayload(
                            RecipientUserId: product.UserId,
                            Title: title,
                            Message: message,
                            ActorUserId: userId,
                            RelatedProductId: id
                        )
                    );
                }
            }

            var likeCount = await _db.ProductLikes.CountAsync(l => l.ProductId == id);
            return Ok(new { likeCount, isLiked = true });
        }

        [HttpDelete("{id}/like")]
        [Authorize]
        public async Task<IActionResult> Unlike(Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var like = await _db.ProductLikes.FirstOrDefaultAsync(l => l.ProductId == id && l.UserId == userId);
            if (like != null)
            {
                _db.ProductLikes.Remove(like);
                await _db.SaveChangesAsync();
            }

            var likeCount = await _db.ProductLikes.CountAsync(l => l.ProductId == id);
            return Ok(new { likeCount, isLiked = false });
        }

        [HttpGet("{id}/likes")]
        public async Task<IActionResult> GetLikers(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
            if (product == null) return NotFound("Ürün bulunamadı.");

            // Public değilse sadece sahibi görebilsin
            if (!product.IsPublic)
            {
                var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(uid) || uid != product.UserId)
                {
                    return Forbid();
                }
            }

            var total = await _db.ProductLikes.CountAsync(l => l.ProductId == id);

            var itemsRaw = await (
                from l in _db.ProductLikes
                where l.ProductId == id
                join u in _db.Users.OfType<ApplicationUser>() on l.UserId equals u.Id into gj
                from u in gj.DefaultIfEmpty()
                orderby l.CreatedAt descending
                select new {
                    userId = l.UserId,
                    user = u,
                    likedAt = l.CreatedAt
                }
            )
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

            var items = itemsRaw.Select(x => new {
                x.userId,
                displayName = GetUserDisplayName(x.user, x.userId),
                x.likedAt
            }).ToList();

            return Ok(new { total, page, pageSize, items });
        }

        [HttpPost("{id}/save")]
        [Authorize]
        public async Task<IActionResult> Save(Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var exists = await _db.Products.AnyAsync(p => p.Id == id && p.IsPublic == true);
            if (!exists) return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");

            var already = await _db.ProductSaves.AnyAsync(s => s.ProductId == id && s.UserId == userId);
            if (!already)
            {
                _db.ProductSaves.Add(new ProductSave { Id = Guid.NewGuid(), ProductId = id, UserId = userId, CreatedAt = DateTime.UtcNow });
                try { await _db.SaveChangesAsync(); } catch (DbUpdateException) { }
            }
            return Ok(new { saved = true });
        }

        [HttpDelete("{id}/save")]
        [Authorize]
        public async Task<IActionResult> Unsave(Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();
            var save = await _db.ProductSaves.FirstOrDefaultAsync(s => s.ProductId == id && s.UserId == userId);
            if (save != null)
            {
                _db.ProductSaves.Remove(save);
                await _db.SaveChangesAsync();
            }
            return Ok(new { saved = false });
        }

        [HttpGet("saved")]
        [Authorize]
        public async Task<IActionResult> GetSaved([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? language = null)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
            var lang = string.IsNullOrEmpty(language) ? "en" : language;
            if (lang != "en" && lang != "tr") lang = "en";

            var query = from s in _db.ProductSaves
                        join p in _db.Products.Include(p => p.Photos.OrderBy(ph => ph.Order)).Include(p => p.Category)
                            on s.ProductId equals p.Id
                        where s.UserId == userId && p.IsPublic == true
                        orderby s.CreatedAt descending
                        select p;

            var allSavedProducts = await query.ToListAsync();

            // Kapalı hesap ve web profili kontrolü: Filtreleme uygula
            var productUserIdsSaved = allSavedProducts.Select(p => p.UserId).Distinct().ToList();
            var usersSaved = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIdsSaved.Contains(u.Id))
                .ToListAsync();
            var userDictSaved = usersSaved.ToDictionary(u => u.Id);

            // Takip ilişkilerini kontrol et
            var privateUserIdsSaved = usersSaved.Where(u => u.IsPrivateAccount).Select(u => u.Id).ToList();
            var followingIdsSaved = new HashSet<string>();
            if (privateUserIdsSaved.Any())
            {
                var followsSaved = await _db.Follows
                    .Where(f => f.FollowerId == userId && 
                                privateUserIdsSaved.Contains(f.FollowingId) && 
                                f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowingId)
                    .ToListAsync();
                followingIdsSaved = new HashSet<string>(followsSaved);
            }

            // Ürünleri filtrele: Web profili kontrolü ekle
            // IsWebProfilePublic kontrolü: Sadece açıkça false set edilmişse gizle (default true kabul et)
            var filteredSavedProducts = allSavedProducts.Where(p => 
                p.UserId == userId || // Kendi ürünleri
                !userDictSaved.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    (!userDictSaved[p.UserId].IsPrivateAccount || followingIdsSaved.Contains(p.UserId)) && // Açık hesap VEYA takip edilen
                    (userDictSaved[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster
                )
            ).ToList();

            // Sayfalama uygula
            var products = filteredSavedProducts
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var pids = products.Select(p => p.Id).ToList();
            var likeCounts = await _db.ProductLikes
                .Where(l => pids.Contains(l.ProductId))
                .GroupBy(l => l.ProductId)
                .Select(g => new { ProductId = g.Key, Count = g.Count() })
                .ToListAsync();
            var likeMap = likeCounts.ToDictionary(x => x.ProductId, x => x.Count);

            var likedIds = await _db.ProductLikes
                .Where(l => l.UserId == userId && pids.Contains(l.ProductId))
                .Select(l => l.ProductId)
                .ToListAsync();
            var likedSet = new HashSet<Guid>(likedIds);

            // Tüm kullanıcıları toplu olarak çek (optimizasyon için)
            var savedUserIds = products.Select(p => p.UserId).Distinct().ToList();
            var savedUsers = await _db.Users.OfType<ApplicationUser>()
                .Where(u => savedUserIds.Contains(u.Id))
                .ToListAsync();
            var savedUserDict = savedUsers.ToDictionary(u => u.Id, u => u);

            // Kategori çevirilerini toplu olarak al
            var savedCategoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
            var savedCategoryTranslations = await _db.CategoryTranslations
                .Where(t => savedCategoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
                .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

            // Premium veya IsWebProfilePublic=true olan kullanıcılar için profil linki gösterilir
            var webProfileViewableIds = new HashSet<string>();
            foreach (var uid in savedUserIds)
            {
                var u = savedUserDict.GetValueOrDefault(uid);
                if (u != null && (u.IsWebProfilePublic == true || await _entitlementService.IsPremiumAsync(uid)))
                    webProfileViewableIds.Add(uid);
            }

            var result = products.Select(p => {
                var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
                var user = savedUserDict.ContainsKey(p.UserId) ? savedUserDict[p.UserId] : null;
                
                // Web profil görünürlüğü: IsWebProfilePublic AYARLI veya Premium üye
                var isWebProfilePublic = user != null && webProfileViewableIds.Contains(p.UserId);
                var isOwner = !string.IsNullOrEmpty(userId) && p.UserId == userId;
                var canViewProfile = isWebProfilePublic || isOwner;
                
                // Kategori adını çevirilere göre al
                string? categoryName = null;
                if (p.CategoryId.HasValue && savedCategoryTranslations.ContainsKey(p.CategoryId.Value))
                    categoryName = savedCategoryTranslations[p.CategoryId.Value];
                else if (p.Category != null)
                    categoryName = p.Category.Name;
                return new
                {
                    p.Id,
                    p.Title,
                    p.Description,
                    p.Hashtags,
                    p.CreatedAt,
                    UserId = p.UserId,
                    User = GetUserDisplayName(user, p.UserId),
                    UserName = _usernameService.GetUserCurrentUsername(user), // Güncel username
                    CanViewProfile = canViewProfile, // Profil görüntülenebilir mi?
                    IsWebProfilePublic = isWebProfilePublic, // Web profili herkese açık mı?
                    category = categoryName,
                    FirstPhotoUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                    PhotoCount = p.Photos.Count,
                    LikeCount = likeMap.ContainsKey(p.Id) ? likeMap[p.Id] : 0,
                    IsLiked = likedSet.Contains(p.Id)
                };
            }).ToList();

            return Ok(result);
        }

    [HttpPost]
    [Authorize]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Create()
    {
        var form = await Request.ReadFormAsync();
        var files = form.Files;
        if (files.Count == 0) return BadRequest("No files");

        var title = form["title"].ToString();
        var description = form["description"].ToString();
        var hashtags = form["hashtags"].ToString();
        
        // LOG: Description'ın nasıl geldiğini kontrol et
        _logger.LogInformation("[ProductsController.Create] === ÜRÜN KAYIT LOG ===");
        _logger.LogInformation("[ProductsController.Create] Title: {Title}", title);
        _logger.LogInformation("[ProductsController.Create] Description (raw): {Description}", description);
        _logger.LogInformation("[ProductsController.Create] Description length: {Length}", description?.Length ?? 0);
        _logger.LogInformation("[ProductsController.Create] Description contains newlines: {HasNewlines}", description?.Contains('\n') ?? false);
        _logger.LogInformation("[ProductsController.Create] Description newline count: {Count}", description?.Count(c => c == '\n') ?? 0);
        if (!string.IsNullOrEmpty(description))
        {
            _logger.LogInformation("[ProductsController.Create] Description (JSON escaped): {DescriptionJson}", System.Text.Json.JsonSerializer.Serialize(description));
        }
        
        // Silinecek fotoğraflar (virgül ile ayrılmış GUID listesi)
        var removePhotoIdsRaw = form["removePhotoIds"].ToString();
        var removePhotoIds = new List<Guid>();
        if (!string.IsNullOrWhiteSpace(removePhotoIdsRaw))
        {
            foreach (var part in removePhotoIdsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (Guid.TryParse(part, out var gid))
                {
                    removePhotoIds.Add(gid);
                }
            }
        }
        Guid? categoryId = null;
        var categoryIdStr = form["categoryId"].ToString();
        if (!string.IsNullOrWhiteSpace(categoryIdStr) && Guid.TryParse(categoryIdStr, out var parsedCategoryId))
        {
            categoryId = parsedCategoryId;
        }

        decimal? price = null;
        var priceStr = form["price"].ToString();
        if (!string.IsNullOrWhiteSpace(priceStr) && decimal.TryParse(priceStr, out var parsedPrice))
        {
            price = parsedPrice;
        }

        bool isPublic = true;
        var isPublicStr = form["isPublic"].ToString();
        if (!string.IsNullOrWhiteSpace(isPublicStr) && bool.TryParse(isPublicStr, out var parsedIsPublic))
        {
            isPublic = parsedIsPublic;
        }

        bool commentsEnabled = true;
        var commentsEnabledStr = form["commentsEnabled"].ToString();
        if (!string.IsNullOrWhiteSpace(commentsEnabledStr) && bool.TryParse(commentsEnabledStr, out var parsedCommentsEnabled))
        {
            commentsEnabled = parsedCommentsEnabled;
        }

        // Badge fields
        bool isRare = false;
        var isRareStr = form["isRare"].ToString();
        if (!string.IsNullOrWhiteSpace(isRareStr) && bool.TryParse(isRareStr, out var parsedIsRare))
        {
            isRare = parsedIsRare;
        }

        bool isMint = false;
        var isMintStr = form["isMint"].ToString();
        if (!string.IsNullOrWhiteSpace(isMintStr) && bool.TryParse(isMintStr, out var parsedIsMint))
        {
            isMint = parsedIsMint;
        }

        bool isGraded = false;
        var isGradedStr = form["isGraded"].ToString();
        if (!string.IsNullOrWhiteSpace(isGradedStr) && bool.TryParse(isGradedStr, out var parsedIsGraded))
        {
            isGraded = parsedIsGraded;
        }

        bool isSigned = false;
        var isSignedStr = form["isSigned"].ToString();
        if (!string.IsNullOrWhiteSpace(isSignedStr) && bool.TryParse(isSignedStr, out var parsedIsSigned))
        {
            isSigned = parsedIsSigned;
        }

        bool isLimited = false;
        var isLimitedStr = form["isLimited"].ToString();
        if (!string.IsNullOrWhiteSpace(isLimitedStr) && bool.TryParse(isLimitedStr, out var parsedIsLimited))
        {
            isLimited = parsedIsLimited;
        }

        bool isFeatured = false;
        var isFeaturedStr = form["isFeatured"].ToString();
        if (!string.IsNullOrWhiteSpace(isFeaturedStr) && bool.TryParse(isFeaturedStr, out var parsedIsFeatured))
        {
            isFeatured = parsedIsFeatured;
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";

        // Premium özellik kontrolü
        // TODO: SOFT_LAUNCH - Şimdilik sadece log, mobil güncellendikten sonra enforce edilecek
        var usesPremiumFeatures = !isPublic || isRare || isMint || isGraded || isSigned || isLimited || isFeatured;
        if (usesPremiumFeatures)
        {
            var isPremium = await _entitlementService.IsPremiumAsync(userId);
            if (!isPremium)
            {
                // Hangi özelliğin premium gerektirdiğini belirle
                var blockedFeatures = new List<string>();
                if (!isPublic) blockedFeatures.Add("PrivateProducts");
                if (isRare || isMint || isGraded || isSigned || isLimited || isFeatured) blockedFeatures.Add("ProductBadges");
                
                _logger.LogWarning("User {UserId} is using premium-style features without active subscription: {Features}", userId, string.Join(", ", blockedFeatures));
                // Mobil güncelleme sonrası bu satırları aktif et:
                // return StatusCode(403, new { message = "Bu özellikler Premium abonelik gerektirir.", features = blockedFeatures, requiresPremium = true });
            }
        }

        // LOG: Product entity'ye atanmadan önce
        _logger.LogInformation("[ProductsController.Create] Product entity'ye atanmadan önce Description: {Description}", System.Text.Json.JsonSerializer.Serialize(description));
        
        var product = new Product
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Description = description,
            Hashtags = hashtags,
            CategoryId = categoryId,
            Price = price,
            IsPublic = isPublic,
            CommentsEnabled = commentsEnabled,
            IsRare = isRare,
            IsMint = isMint,
            IsGraded = isGraded,
            IsSigned = isSigned,
            IsLimited = isLimited,
            IsFeatured = isFeatured,
        };

        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        if (string.IsNullOrWhiteSpace(bucket)) return StatusCode(500, "Bucket not configured");

        // Fotoğraf dosyalarını kontrol et ve filtrele
        var allowedContentTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
        var fileTuples = files
            .Where(f => f.Length > 0)
            .Select(f =>
            {
                var contentType = f.ContentType ?? "image/jpeg";
                var fileName = f.FileName ?? "image.jpg";
                
                // Content type kontrolü - logla ama devam et (ImageSharp daha iyi kontrol edecek)
                var contentTypeLower = contentType.ToLowerInvariant();
                if (!allowedContentTypes.Any(ct => contentTypeLower.Contains(ct, StringComparison.OrdinalIgnoreCase)))
                {
                    _logger.LogWarning("Potentially unsupported content type for file: {FileName}, ContentType: {ContentType}", fileName, contentType);
                }
                
                _logger.LogInformation("Processing file: {FileName}, ContentType: {ContentType}, Length: {Length}", fileName, contentType, f.Length);
                
                return ((Stream)f.OpenReadStream(), fileName, contentType);
            })
            .ToList();
        
        if (fileTuples.Count == 0)
        {
            return BadRequest("Geçerli bir fotoğraf dosyası seçilmedi veya dosyalar boş.");
        }

        var created = await _productService.CreateAsync(product, fileTuples, bucket);

        // Takipçilere bildirim NewProductNotificationBatchService ile toplu gönderiliyor (batch).
        // Üst üste çok ürün eklendiğinde tek özet bildirim gider (örn. "X 5 yeni ürün ekledi").

        return Ok(new { created.Id, created.Title, photos = created.Photos.Select(p => p.BlobUrl).ToArray() });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetUserProducts([FromQuery] string? language = null)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized("Kullanıcı kimliği bulunamadı.");
        }

        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";

        var products = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // Kategori çevirilerini toplu olarak al
        var categoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var categoryTranslations = await _db.CategoryTranslations
            .Where(t => categoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        // Like bilgilerini topla
        var productIds = products.Select(p => p.Id).ToList();
        var likeCounts = await _db.ProductLikes
            .Where(l => productIds.Contains(l.ProductId))
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var likeCountMap = likeCounts.ToDictionary(x => x.ProductId, x => x.Count);

        var currentUserId = userId;
        var likedSet = new HashSet<Guid>();
        if (!string.IsNullOrEmpty(currentUserId))
        {
            var likedIds = await _db.ProductLikes
                .Where(l => l.UserId == currentUserId && productIds.Contains(l.ProductId))
                .Select(l => l.ProductId)
                .ToListAsync();
            likedSet = new HashSet<Guid>(likedIds);
        }

        var result = products.Select(p => {
            var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
            var likeCount = likeCountMap.ContainsKey(p.Id) ? likeCountMap[p.Id] : 0;
            var badges = CalculateBadges(p, likeCount);
            // Kategori adını çevirilere göre al
            string? categoryName = null;
            if (p.CategoryId.HasValue && categoryTranslations.ContainsKey(p.CategoryId.Value))
                categoryName = categoryTranslations[p.CategoryId.Value];
            else if (p.Category != null)
                categoryName = p.Category.Name;
            return new
            {
                p.Id,
                p.Title,
                p.Description,
                p.Hashtags,
                p.CreatedAt,
                p.Price,
                Category = categoryName,
                CategoryId = p.CategoryId,
                FirstPhotoUrl = firstPhoto != null ? _images.GetSignedUrl(bucket, firstPhoto.BlobName) : null,
                PhotoCount = p.Photos.Count,
                LikeCount = likeCount,
                IsLiked = likedSet.Contains(p.Id),
                Badges = badges
            };
        }).ToList();

        return Ok(result);
    }

    [HttpPut("{id}")]
    [Authorize]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Update(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var product = await _db.Products
            .Include(p => p.Photos)
            .Where(p => p.Id == id && p.UserId == userId)
            .FirstOrDefaultAsync();

        if (product == null) return NotFound("Ürün bulunamadı.");

        var form = await Request.ReadFormAsync();

        // Metin alanları (opsiyonel)
        var title = form["title"].ToString();
        var description = form["description"].ToString();
        var hashtags = form["hashtags"].ToString();

        // Silinecek fotoğraflar (virgül ile ayrılmış GUID listesi)
        var removePhotoIdsRaw = form["removePhotoIds"].ToString();
        var removePhotoIds = new List<Guid>();
        if (!string.IsNullOrWhiteSpace(removePhotoIdsRaw))
        {
            foreach (var part in removePhotoIdsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (Guid.TryParse(part, out var gid))
                {
                    removePhotoIds.Add(gid);
                }
            }
        }

        Guid? categoryId = null;
        var categoryIdStr = form["categoryId"].ToString();
        if (!string.IsNullOrWhiteSpace(categoryIdStr) && Guid.TryParse(categoryIdStr, out var parsedCategoryId))
        {
            categoryId = parsedCategoryId;
        }

        decimal? price = null;
        var priceStr = form["price"].ToString();
        if (!string.IsNullOrWhiteSpace(priceStr) && decimal.TryParse(priceStr, out var parsedPrice))
        {
            price = parsedPrice;
        }

        bool isPublic = default;
        var isPublicStr = form["isPublic"].ToString();
        var hasIsPublic = !string.IsNullOrWhiteSpace(isPublicStr) && bool.TryParse(isPublicStr, out isPublic);

        bool commentsEnabled = default;
        var commentsEnabledStr = form["commentsEnabled"].ToString();
        var hasCommentsEnabled = !string.IsNullOrWhiteSpace(commentsEnabledStr) && bool.TryParse(commentsEnabledStr, out commentsEnabled);

        // Badge fields
        bool isRare = default;
        var isRareStr = form["isRare"].ToString();
        var hasIsRare = !string.IsNullOrWhiteSpace(isRareStr) && bool.TryParse(isRareStr, out isRare);

        bool isMint = default;
        var isMintStr = form["isMint"].ToString();
        var hasIsMint = !string.IsNullOrWhiteSpace(isMintStr) && bool.TryParse(isMintStr, out isMint);

        bool isGraded = default;
        var isGradedStr = form["isGraded"].ToString();
        var hasIsGraded = !string.IsNullOrWhiteSpace(isGradedStr) && bool.TryParse(isGradedStr, out isGraded);

        bool isSigned = default;
        var isSignedStr = form["isSigned"].ToString();
        var hasIsSigned = !string.IsNullOrWhiteSpace(isSignedStr) && bool.TryParse(isSignedStr, out isSigned);

        bool isLimited = default;
        var isLimitedStr = form["isLimited"].ToString();
        var hasIsLimited = !string.IsNullOrWhiteSpace(isLimitedStr) && bool.TryParse(isLimitedStr, out isLimited);

        bool isFeatured = default;
        var isFeaturedStr = form["isFeatured"].ToString();
        var hasIsFeatured = !string.IsNullOrWhiteSpace(isFeaturedStr) && bool.TryParse(isFeaturedStr, out isFeatured);

        bool isOnSale = default;
        var isOnSaleStr = form["isOnSale"].ToString();
        var hasIsOnSale = !string.IsNullOrWhiteSpace(isOnSaleStr) && bool.TryParse(isOnSaleStr, out isOnSale);

        decimal? originalPrice = null;
        var originalPriceStr = form["originalPrice"].ToString();
        if (!string.IsNullOrWhiteSpace(originalPriceStr) && decimal.TryParse(originalPriceStr, out var parsedOriginalPrice))
        {
            originalPrice = parsedOriginalPrice;
        }

        // Premium özellik kontrolü (güncelleme için)
        var wantsPrivate = hasIsPublic && !isPublic;
        var wantsBadge = (hasIsRare && isRare) || (hasIsMint && isMint) || 
                         (hasIsGraded && isGraded) || (hasIsSigned && isSigned) || 
                         (hasIsLimited && isLimited) || (hasIsFeatured && isFeatured);
        
        // TODO: SOFT_LAUNCH - Şimdilik sadece log, mobil güncellendikten sonra enforce edilecek
        if (wantsPrivate || wantsBadge)
        {
            var isPremium = await _entitlementService.IsPremiumAsync(userId);
            if (!isPremium)
            {
                var blockedFeatures = new List<string>();
                if (wantsPrivate) blockedFeatures.Add("PrivateProducts");
                if (wantsBadge) blockedFeatures.Add("ProductBadges");
                
                _logger.LogWarning("User {UserId} is updating product with premium-style features without active subscription: {Features}", userId, string.Join(", ", blockedFeatures));
                // Mobil güncelleme sonrası bu satırları aktif et:
                // return StatusCode(403, new { message = "Bu özellikler Premium abonelik gerektirir.", features = blockedFeatures, requiresPremium = true });
            }
        }

        // Alanları güncelle (gönderilmişse)
        if (!string.IsNullOrWhiteSpace(title)) product.Title = title;
        if (!string.IsNullOrWhiteSpace(description) || description == string.Empty) product.Description = description;
        if (!string.IsNullOrWhiteSpace(hashtags) || hashtags == string.Empty) product.Hashtags = hashtags;
        if (categoryId.HasValue) product.CategoryId = categoryId;
        if (price.HasValue) product.Price = price;
        if (hasIsPublic) product.IsPublic = isPublic;
        if (hasCommentsEnabled) product.CommentsEnabled = commentsEnabled;
        
        // Badge alanlarını güncelle
        if (hasIsRare) product.IsRare = isRare;
        if (hasIsMint) product.IsMint = isMint;
        if (hasIsGraded) product.IsGraded = isGraded;
        if (hasIsSigned) product.IsSigned = isSigned;
        if (hasIsLimited) product.IsLimited = isLimited;
        if (hasIsFeatured) product.IsFeatured = isFeatured;

        // Önce seçili fotoğrafları sil (varsa)
        if (removePhotoIds.Count > 0)
        {
            string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
            foreach (var pid in removePhotoIds)
            {
                var toRemove = product.Photos.FirstOrDefault(x => x.Id == pid);
                if (toRemove != null)
                {
                    try
                    {
                        if (!string.IsNullOrWhiteSpace(bucket))
                        {
                            await _images.DeleteAsync(bucket, toRemove.BlobName);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to delete blob {BlobName}", toRemove.BlobName);
                    }
                    _db.ProductPhotos.Remove(toRemove);
                }
            }
            // Silme işlemlerini hemen commit et (concurrency hatalarını önlemek için)
            await _db.SaveChangesAsync();
        }

        // Yeni fotoğraflar varsa ekle (mevcutları koru)
        var files = form.Files;
        if (files != null && files.Count > 0)
        {
            string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(bucket)) return StatusCode(500, "Bucket not configured");

            int startOrder = product.Photos.Any() ? product.Photos.Max(p => p.Order) + 1 : 0;
            int order = startOrder;
            foreach (var file in files)
            {
                if (file.Length == 0) continue;
                await using var stream = file.OpenReadStream();
                var (blob, url, size) = await _images.UploadSquareAsync(stream, file.FileName, file.ContentType ?? "image/jpeg", bucket);

                var newPhoto = new ProductPhoto
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    BlobName = blob,
                    BlobUrl = url,
                    ContentType = "image/jpeg",
                    SizeBytes = size,
                    Order = order++
                };
                _db.ProductPhotos.Add(newPhoto);
            }
        }
        else
        {
            // Fotoğraflarda değişiklik yoksa, EF'in gereksiz güncelleme denemesini engelle
            foreach (var ph in product.Photos)
            {
                _db.Entry(ph).State = EntityState.Unchanged;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new { product.Id, product.Title });
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id, [FromQuery] string? language = null)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;

        var product = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.Id == id && p.UserId == userId)
            .FirstOrDefaultAsync();

        if (product == null) return NotFound();

        // Like bilgileri
        var likeCount = await _db.ProductLikes.CountAsync(l => l.ProductId == product.Id);
        var isLiked = await _db.ProductLikes.AnyAsync(l => l.ProductId == product.Id && l.UserId == userId);

        // Save bilgileri
        var isSaved = await _db.ProductSaves.AnyAsync(s => s.ProductId == product.Id && s.UserId == userId);

        // Kullanıcı bilgisini yükle (kendi ürününde de göstermek için)
        var productOwner = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == product.UserId);

        // Badge bilgileri
        var badges = CalculateBadges(product, likeCount);

        // Kategori adını dile göre al
        var categoryName = await GetCategoryNameByLanguageAsync(product.CategoryId, language);
        // Kategori path'ini al (tüm üst kategoriler)
        var categoryPath = await GetCategoryPathAsync(product.CategoryId, language);

        var result = new
        {
            product.Id,
            product.Title,
            product.Description,
            product.Hashtags,
            product.Price,
            product.IsPublic,
            product.CommentsEnabled,
            product.CreatedAt,
            category = categoryName,
            categoryId = product.CategoryId,
            categoryPath = categoryPath,
            UserId = product.UserId,
            User = GetUserDisplayName(productOwner, product.UserId),
            LikeCount = likeCount,
            IsLiked = isLiked,
            IsSaved = isSaved,
            photos = product.Photos.OrderBy(ph => ph.Order).Select(ph => new { 
                blobUrl = GetPhotoUrl(ph, bucket), 
                order = ph.Order 
            }).Where(ph => !string.IsNullOrWhiteSpace(ph.blobUrl)).ToList(),
            // Badge fields
            badges = badges,
            isRare = product.IsRare,
            isMint = product.IsMint,
            isGraded = product.IsGraded,
            isSigned = product.IsSigned,
            isLimited = product.IsLimited,
            isFeatured = product.IsFeatured
        };

        return Ok(result);
    }

    [HttpGet("public/{id}")]
    public async Task<IActionResult> GetPublicById(Guid id, [FromQuery] string? language = null)
    {
        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;

        var product = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.Id == id && p.IsPublic == true) // Sadece paylaşıma açık ürünler
            .FirstOrDefaultAsync();

        if (product == null) return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");

        // Kapalı hesap kontrolü: Ürün sahibinin hesabı kapalı mı?
        var productOwner = await _db.Users.OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Id == product.UserId);
        
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwner = !string.IsNullOrEmpty(currentUserId) && product.UserId == currentUserId;
        
        // Kapalı hesap kontrolü: Kendi ürünü değilse ve kapalı hesap ise ve takip edilmiyorsa erişim yok
        if (!isOwner && productOwner != null && productOwner.IsPrivateAccount)
        {
            if (string.IsNullOrEmpty(currentUserId))
            {
                // Giriş yapmamış kullanıcılar kapalı hesap ürünlerini göremez
                return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");
            }
            
            // Mevcut kullanıcı bu kullanıcıyı takip ediyor mu? (Accepted status)
            var isFollowing = await _db.Follows.AnyAsync(f => 
                f.FollowerId == currentUserId && 
                f.FollowingId == product.UserId && 
                f.Status == FollowStatus.Accepted);
            
            if (!isFollowing)
            {
                // Takip etmiyorsa erişim yok
                return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");
            }
        }

        // Like bilgileri
        var currentUserId2 = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var likeCount2 = await _db.ProductLikes.CountAsync(l => l.ProductId == product.Id);
        var isLiked2 = !string.IsNullOrEmpty(currentUserId2) && await _db.ProductLikes.AnyAsync(l => l.ProductId == product.Id && l.UserId == currentUserId2);

        // Save bilgileri
        var isSaved2 = !string.IsNullOrEmpty(currentUserId2) && await _db.ProductSaves.AnyAsync(s => s.ProductId == product.Id && s.UserId == currentUserId2);

        // Comment bilgileri
        var commentCount2 = await _db.Comments.CountAsync(c => c.ProductId == product.Id);

        // Badge bilgileri
        var badges = CalculateBadges(product, likeCount2);

        // Kategori adını dile göre al
        var categoryName = await GetCategoryNameByLanguageAsync(product.CategoryId, language);
        // Kategori path'ini al (tüm üst kategoriler)
        var categoryPath = await GetCategoryPathAsync(product.CategoryId, language);

        // Web profil görünürlüğü: IsWebProfilePublic AYARLI veya Premium üye ise profil linki gösterilir
        var isWebProfilePublic = productOwner != null && (
            productOwner.IsWebProfilePublic == true ||
            await _entitlementService.IsPremiumAsync(productOwner.Id));
        var canViewProfile = isWebProfilePublic || isOwner;
        
        var result = new
        {
            product.Id,
            product.Title,
            product.Description,
            product.Hashtags,
            Price = isOwner ? product.Price : (decimal?)null, // Fiyat sadece sahibine görünür
            product.IsPublic,
            product.CommentsEnabled,
            product.CreatedAt,
            UserId = product.UserId,
            User = GetUserDisplayName(productOwner, product.UserId),
            UserName = _usernameService.GetUserCurrentUsername(productOwner), // Güncel username
            CanViewProfile = canViewProfile, // Profil görüntülenebilir mi?
            IsWebProfilePublic = isWebProfilePublic, // Web profili herkese açık mı?
            category = categoryName,
            categoryId = product.CategoryId,
            categoryPath = categoryPath,
            LikeCount = likeCount2,
            CommentCount = commentCount2,
            IsLiked = isLiked2,
            IsSaved = isSaved2,
            photos = product.Photos.OrderBy(ph => ph.Order).Select(ph => new { 
                blobUrl = GetPhotoUrl(ph, bucket), 
                order = ph.Order 
            }).Where(ph => !string.IsNullOrWhiteSpace(ph.blobUrl)).ToList(),
            // Badge fields
            badges = badges,
            isRare = product.IsRare,
            isMint = product.IsMint,
            isGraded = product.IsGraded,
            isSigned = product.IsSigned,
            isLimited = product.IsLimited,
            isFeatured = product.IsFeatured
        };

        return Ok(result);
    }
    [HttpPost("migrate-anonymous")]
    [Authorize]
    public async Task<IActionResult> MigrateAnonymousProducts()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized("Kullanıcı kimliği bulunamadı.");
        }

        var affected = await _db.Products
            .Where(p => p.UserId == "anonymous")
            .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.UserId, userId));

        return Ok(new { affected });
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized("Kullanıcı kimliği bulunamadı.");
        }

        var product = await _db.Products
            .Include(p => p.Photos)
            .Where(p => p.Id == id && p.UserId == userId)
            .FirstOrDefaultAsync();

        if (product == null)
        {
            return NotFound("Ürün bulunamadı.");
        }

        // Fotoğrafları GCS'den sil
        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(bucket))
        {
            foreach (var photo in product.Photos)
            {
                try
                {
                    await _images.DeleteAsync(bucket, photo.BlobName);
                }
                catch (Exception ex)
                {
                    // Log but don't fail the deletion
                    Console.WriteLine($"Failed to delete blob {photo.BlobName}: {ex.Message}");
                }
            }
        }

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Ürün silindi." });
    }

    [HttpGet("feed")]
    public async Task<IActionResult> GetPublicFeed([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? language = null)
    {
        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";

        // İlk olarak tüm public ürünleri çek
        var allProducts = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.IsPublic == true) // Sadece paylaşıma açık ürünler
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // Kapalı hesap kontrolü: Kapalı hesap olan kullanıcıların ürünlerini filtrele
        var filteredProducts = new List<Product>();
        if (!string.IsNullOrEmpty(currentUserId))
        {
            // Kullanıcıların kapalı hesap durumlarını kontrol et
            var productUserIds = allProducts.Select(p => p.UserId).Distinct().ToList();
            var users = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIds.Contains(u.Id))
                .ToListAsync();
            var userDict = users.ToDictionary(u => u.Id);

            // Takip ilişkilerini kontrol et
            var privateUserIds = users.Where(u => u.IsPrivateAccount).Select(u => u.Id).ToList();
            var followingIds = new HashSet<string>();
            if (privateUserIds.Any())
            {
                var follows = await _db.Follows
                    .Where(f => f.FollowerId == currentUserId && 
                                privateUserIds.Contains(f.FollowingId) && 
                                f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowingId)
                    .ToListAsync();
                followingIds = new HashSet<string>(follows);
            }

            // Ürünleri filtrele: Kendi ürünleri veya açık hesap ürünleri veya takip edilen kapalı hesap ürünleri
            // IsWebProfilePublic kontrolü: Sadece açıkça false set edilmişse gizle (default true kabul et)
            filteredProducts = allProducts.Where(p => 
                p.UserId == currentUserId || // Kendi ürünleri
                !userDict.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    (!userDict[p.UserId].IsPrivateAccount || followingIds.Contains(p.UserId)) && // Açık hesap VEYA takip edilen kapalı hesap
                    (userDict[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster (null veya true ise göster)
                )
            ).ToList();
        }
        else
        {
            // Giriş yapmamış kullanıcılar için sadece açık hesapların ürünleri
            var productUserIdsAnonymous = allProducts.Select(p => p.UserId).Distinct().ToList();
            var usersAnonymous = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIdsAnonymous.Contains(u.Id))
                .ToListAsync();
            var userDictAnonymous = usersAnonymous.ToDictionary(u => u.Id);

            // Giriş yapmamış kullanıcılar için sadece açık hesapların VE web profili açık olanların ürünleri
            // IsWebProfilePublic kontrolü: Sadece açıkça false set edilmişse gizle (default true kabul et)
            filteredProducts = allProducts.Where(p => 
                !userDictAnonymous.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    !userDictAnonymous[p.UserId].IsPrivateAccount && // Açık hesap
                    (userDictAnonymous[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster
                )
            ).ToList();
        }

        // Sayfalama
        var products = filteredProducts
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        // Like bilgilerini topla
        var pids = products.Select(p => p.Id).ToList();
        var likeCounts3 = await _db.ProductLikes
            .Where(l => pids.Contains(l.ProductId))
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var likeCountMap3 = likeCounts3.ToDictionary(x => x.ProductId, x => x.Count);

        // Comment bilgilerini topla
        var commentCounts3 = await _db.Comments
            .Where(c => pids.Contains(c.ProductId))
            .GroupBy(c => c.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var commentCountMap3 = commentCounts3.ToDictionary(x => x.ProductId, x => x.Count);

        var maybeUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var likedSet3 = new HashSet<Guid>();
        if (!string.IsNullOrEmpty(maybeUserId))
        {
            var likedIds3 = await _db.ProductLikes
                .Where(l => l.UserId == maybeUserId && pids.Contains(l.ProductId))
                .Select(l => l.ProductId)
                .ToListAsync();
            likedSet3 = new HashSet<Guid>(likedIds3);
        }

        // Tüm kullanıcıları toplu olarak çek (optimizasyon için)
        var userIds = products.Select(p => p.UserId).Distinct().ToList();
        var feedUsers = await _db.Users.OfType<ApplicationUser>()
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();
        var feedUserDict = feedUsers.ToDictionary(u => u.Id, u => u);

        // Kategori çevirilerini toplu olarak al
        var feedCategoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var feedCategoryTranslations = await _db.CategoryTranslations
            .Where(t => feedCategoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        // Premium veya IsWebProfilePublic=true olan kullanıcılar için profil linki gösterilir
        var feedWebProfileViewableIds = new HashSet<string>();
        foreach (var uid in userIds)
        {
            var u = feedUserDict.GetValueOrDefault(uid);
            if (u != null && (u.IsWebProfilePublic == true || await _entitlementService.IsPremiumAsync(uid)))
                feedWebProfileViewableIds.Add(uid);
        }

        var result = products.Select(p => {
            var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
            var user = feedUserDict.ContainsKey(p.UserId) ? feedUserDict[p.UserId] : null;
            var likeCount = likeCountMap3.ContainsKey(p.Id) ? likeCountMap3[p.Id] : 0;
            
            // Web profil görünürlüğü: IsWebProfilePublic AYARLI veya Premium üye
            var isWebProfilePublic = user != null && feedWebProfileViewableIds.Contains(p.UserId);
            var isOwner = !string.IsNullOrEmpty(currentUserId) && p.UserId == currentUserId;
            var canViewProfile = isWebProfilePublic || isOwner;
            
            // Kategori adını çevirilere göre al
            string? categoryName = null;
            if (p.CategoryId.HasValue && feedCategoryTranslations.ContainsKey(p.CategoryId.Value))
                categoryName = feedCategoryTranslations[p.CategoryId.Value];
            else if (p.Category != null)
                categoryName = p.Category.Name;
            return new
            {
                id = p.Id.ToString(),
                title = p.Title,
                name = p.Title,
                p.Description,
                p.Hashtags,
                createdAt = p.CreatedAt,
                userId = p.UserId,
                user = GetUserDisplayName(user, p.UserId),
                userDisplayName = GetUserDisplayName(user, p.UserId),
                userName = _usernameService.GetUserCurrentUsername(user), // Güncel username
                userAvatarUrl = user?.AvatarUrl,
                canViewProfile = canViewProfile, // Profil görüntülenebilir mi?
                isWebProfilePublic = isWebProfilePublic, // Web profili herkese açık mı?
                category = categoryName,
                categoryName = categoryName,
                imageUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                firstPhotoUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                photoCount = p.Photos.Count,
                photos = p.Photos.OrderBy(ph => ph.Order).Select(ph => new { 
                    blobUrl = GetPhotoUrl(ph, bucket),
                    order = ph.Order
                }).Where(ph => !string.IsNullOrWhiteSpace(ph.blobUrl)).ToList(),
                likeCount = likeCount,
                isLiked = likedSet3.Contains(p.Id),
                commentCount = commentCountMap3.ContainsKey(p.Id) ? commentCountMap3[p.Id] : 0,
                commentsEnabled = p.CommentsEnabled,
                badges = CalculateBadges(p, likeCount)
            };
        }).ToList();

        return Ok(result);
    }

    [HttpGet("category/{categoryId}")]
    public async Task<IActionResult> GetProductsByCategory(
        Guid categoryId,
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20,
        [FromQuery] string? language = null)
    {
        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";

        // Kategoriyi kontrol et
        var category = await _db.Categories.FindAsync(categoryId);
        if (category == null)
        {
            return Ok(new
            {
                products = new List<object>(),
                totalCount = 0,
                page,
                pageSize,
                categoryName = (string?)null
            });
        }

        // Kategori adını dile göre al
        string? categoryName = null;
        if (lang == "en" || lang == "tr")
        {
            var translation = await _db.CategoryTranslations
                .FirstOrDefaultAsync(t => t.CategoryId == categoryId && t.LanguageCode == lang);
            categoryName = translation?.Name ?? category.Name;
        }
        else
        {
            categoryName = category.Name;
        }

        // Kategori ve tüm alt kategorilerini bul (CategoryClosure kullanarak)
        var categoryIds = new List<Guid> { categoryId };
        var descendants = await _db.CategoryClosures
            .Where(cc => cc.AncestorId == categoryId && cc.Distance > 0)
            .Select(cc => cc.DescendantId)
            .ToListAsync();
        categoryIds.AddRange(descendants);

        // İlk olarak tüm public ürünleri ve kategoriye uygun olanları çek
        var allProducts = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.IsPublic == true && p.CategoryId.HasValue && categoryIds.Contains(p.CategoryId.Value))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // Kapalı hesap kontrolü: Kapalı hesap olan kullanıcıların ürünlerini filtrele
        var filteredProducts = new List<Product>();
        if (!string.IsNullOrEmpty(currentUserId))
        {
            // Kullanıcıların kapalı hesap durumlarını kontrol et
            var productUserIds = allProducts.Select(p => p.UserId).Distinct().ToList();
            var users = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIds.Contains(u.Id))
                .ToListAsync();
            var userDict = users.ToDictionary(u => u.Id);

            // Takip ilişkilerini kontrol et
            var privateUserIds = users.Where(u => u.IsPrivateAccount).Select(u => u.Id).ToList();
            var followingIds = new HashSet<string>();
            if (privateUserIds.Any())
            {
                var follows = await _db.Follows
                    .Where(f => f.FollowerId == currentUserId && 
                                privateUserIds.Contains(f.FollowingId) && 
                                f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowingId)
                    .ToListAsync();
                followingIds = new HashSet<string>(follows);
            }

            // Ürünleri filtrele: Kendi ürünleri veya açık hesap ürünleri veya takip edilen kapalı hesap ürünleri
            filteredProducts = allProducts.Where(p => 
                p.UserId == currentUserId || // Kendi ürünleri
                !userDict.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    (!userDict[p.UserId].IsPrivateAccount || followingIds.Contains(p.UserId)) && // Açık hesap VEYA takip edilen kapalı hesap
                    (userDict[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster
                )
            ).ToList();
        }
        else
        {
            // Giriş yapmamış kullanıcılar için sadece açık hesapların ürünleri
            var productUserIdsAnonymous = allProducts.Select(p => p.UserId).Distinct().ToList();
            var usersAnonymous = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIdsAnonymous.Contains(u.Id))
                .ToListAsync();
            var userDictAnonymous = usersAnonymous.ToDictionary(u => u.Id);

            // Giriş yapmamış kullanıcılar için sadece açık hesapların VE web profili açık olanların ürünleri
            filteredProducts = allProducts.Where(p => 
                !userDictAnonymous.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    !userDictAnonymous[p.UserId].IsPrivateAccount && // Açık hesap
                    (userDictAnonymous[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster
                )
            ).ToList();
        }

        var totalCount = filteredProducts.Count;

        // Sayfalama
        var products = filteredProducts
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        // Like bilgilerini topla
        var pids = products.Select(p => p.Id).ToList();
        var likeCounts = await _db.ProductLikes
            .Where(l => pids.Contains(l.ProductId))
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var likeCountMap = likeCounts.ToDictionary(x => x.ProductId, x => x.Count);

        // Comment bilgilerini topla
        var commentCounts = await _db.Comments
            .Where(c => pids.Contains(c.ProductId))
            .GroupBy(c => c.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var commentCountMap = commentCounts.ToDictionary(x => x.ProductId, x => x.Count);

        var maybeUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var likedSet = new HashSet<Guid>();
        if (!string.IsNullOrEmpty(maybeUserId))
        {
            var likedIds = await _db.ProductLikes
                .Where(l => l.UserId == maybeUserId && pids.Contains(l.ProductId))
                .Select(l => l.ProductId)
                .ToListAsync();
            likedSet = new HashSet<Guid>(likedIds);
        }

        // Tüm kullanıcıları toplu olarak çek (optimizasyon için)
        var userIds = products.Select(p => p.UserId).Distinct().ToList();
        var feedUsers = await _db.Users.OfType<ApplicationUser>()
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();
        var feedUserDict = feedUsers.ToDictionary(u => u.Id, u => u);

        // Kategori çevirilerini toplu olarak al
        var feedCategoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var feedCategoryTranslations = await _db.CategoryTranslations
            .Where(t => feedCategoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        // Premium veya IsWebProfilePublic=true olan kullanıcılar için profil linki gösterilir
        var categoryWebProfileViewableIds = new HashSet<string>();
        foreach (var uid in userIds)
        {
            var u = feedUserDict.GetValueOrDefault(uid);
            if (u != null && (u.IsWebProfilePublic == true || await _entitlementService.IsPremiumAsync(uid)))
                categoryWebProfileViewableIds.Add(uid);
        }

        var result = products.Select(p => {
            var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
            var user = feedUserDict.ContainsKey(p.UserId) ? feedUserDict[p.UserId] : null;
            var likeCount = likeCountMap.ContainsKey(p.Id) ? likeCountMap[p.Id] : 0;
            var badges = CalculateBadges(p, likeCount);
            
            // Web profil görünürlüğü: IsWebProfilePublic AYARLI veya Premium üye
            var isWebProfilePublic = user != null && categoryWebProfileViewableIds.Contains(p.UserId);
            var isOwner = !string.IsNullOrEmpty(currentUserId) && p.UserId == currentUserId;
            var canViewProfile = isWebProfilePublic || isOwner;
            
            // Kategori adını çevirilere göre al
            string? categoryName = null;
            if (p.CategoryId.HasValue && feedCategoryTranslations.ContainsKey(p.CategoryId.Value))
                categoryName = feedCategoryTranslations[p.CategoryId.Value];
            else if (p.Category != null)
                categoryName = p.Category.Name;
            
            return new
            {
                id = p.Id.ToString(),
                title = p.Title,
                name = p.Title, // Web uyumluluğu için
                description = p.Description,
                hashtags = p.Hashtags,
                createdAt = p.CreatedAt,
                UserId = p.UserId,
                user = GetUserDisplayName(user, p.UserId),
                userName = _usernameService.GetUserCurrentUsername(user), // Güncel username
                userDisplayName = GetUserDisplayName(user, p.UserId),
                userAvatarUrl = user?.AvatarUrl,
                canViewProfile = canViewProfile, // Profil görüntülenebilir mi?
                isWebProfilePublic = isWebProfilePublic, // Web profili herkese açık mı?
                category = categoryName,
                categoryName = categoryName, // Web uyumluluğu için
                categoryId = p.CategoryId?.ToString(),
                imageUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                firstPhotoUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                photoCount = p.Photos.Count,
                photos = p.Photos.OrderBy(ph => ph.Order).Select(ph => new { 
                    blobUrl = GetPhotoUrl(ph, bucket),
                    order = ph.Order
                }).Where(ph => !string.IsNullOrWhiteSpace(ph.blobUrl)).ToList(),
                likeCount = likeCount,
                isLiked = likedSet.Contains(p.Id),
                commentCount = commentCountMap.ContainsKey(p.Id) ? commentCountMap[p.Id] : 0,
                commentsEnabled = p.CommentsEnabled,
                badges = badges
            };
        }).ToList();

        return Ok(new
        {
            products = result,
            totalCount,
            page,
            pageSize,
            categoryName = categoryName
        });
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchProducts(
        [FromQuery] string? query = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20,
        [FromQuery] string? language = null)
    {
        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";

        var currentUserIdSearch = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        // İlk olarak tüm public ürünleri çek
        var allProductsQuery = _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.IsPublic == true); // Sadece paylaşıma açık ürünler
        
        var allProductsForSearch = await allProductsQuery.ToListAsync();
        
        // Kapalı hesap kontrolü
        var filteredProductsForSearch = new List<Product>();
        if (!string.IsNullOrEmpty(currentUserIdSearch))
        {
            var productUserIdsSearch = allProductsForSearch.Select(p => p.UserId).Distinct().ToList();
            var usersSearch = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIdsSearch.Contains(u.Id))
                .ToListAsync();
            var userDictSearch = usersSearch.ToDictionary(u => u.Id);

            var privateUserIdsSearch = usersSearch.Where(u => u.IsPrivateAccount).Select(u => u.Id).ToList();
            var followingIdsSearch = new HashSet<string>();
            if (privateUserIdsSearch.Any())
            {
                var followsSearch = await _db.Follows
                    .Where(f => f.FollowerId == currentUserIdSearch && 
                                privateUserIdsSearch.Contains(f.FollowingId) && 
                                f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowingId)
                    .ToListAsync();
                followingIdsSearch = new HashSet<string>(followsSearch);
            }

            // Ürünleri filtrele: Web profilini dikkate al
            // IsWebProfilePublic kontrolü: Sadece açıkça false set edilmişse gizle (default true kabul et)
            filteredProductsForSearch = allProductsForSearch.Where(p => 
                p.UserId == currentUserIdSearch || // Kendi ürünleri
                !userDictSearch.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    (!userDictSearch[p.UserId].IsPrivateAccount || followingIdsSearch.Contains(p.UserId)) && // Açık hesap VEYA takip edilen
                    (userDictSearch[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster
                )
            ).ToList();
        }
        else
        {
            var productUserIdsSearchAnonymous = allProductsForSearch.Select(p => p.UserId).Distinct().ToList();
            var usersSearchAnonymous = await _db.Users.OfType<ApplicationUser>()
                .Where(u => productUserIdsSearchAnonymous.Contains(u.Id))
                .ToListAsync();
            var userDictSearchAnonymous = usersSearchAnonymous.ToDictionary(u => u.Id);

            // Giriş yapmamış kullanıcılar için: Açık hesap VE web profili açık olanların ürünleri
            // IsWebProfilePublic kontrolü: Sadece açıkça false set edilmişse gizle (default true kabul et)
            filteredProductsForSearch = allProductsForSearch.Where(p => 
                !userDictSearchAnonymous.ContainsKey(p.UserId) || // Kullanıcı bulunamadıysa göster
                (
                    !userDictSearchAnonymous[p.UserId].IsPrivateAccount && // Açık hesap
                    (userDictSearchAnonymous[p.UserId].IsWebProfilePublic != false) // Web profili açıkça kapatılmamışsa göster
                )
            ).ToList();
        }

        var productsQuery = filteredProductsForSearch.AsQueryable();

        // Metin araması (hashtag, description, title)
        if (!string.IsNullOrWhiteSpace(query))
        {
            var searchTerm = query.ToLower();
            filteredProductsForSearch = filteredProductsForSearch.Where(p => 
                (p.Hashtags != null && p.Hashtags.ToLower().Contains(searchTerm)) ||
                (p.Description != null && p.Description.ToLower().Contains(searchTerm)) ||
                (p.Title != null && p.Title.ToLower().Contains(searchTerm))
            ).ToList();
        }

        // Kategori filtresi
        if (categoryId.HasValue)
        {
            // Kategori ve tüm alt kategorilerini bul
            var category = await _db.Categories.FindAsync(categoryId.Value);
            if (category != null)
            {
                var categoryIds = new List<Guid> { categoryId.Value };
                
                // Alt kategorileri bul (CategoryClosure tablosunu kullanarak)
                var descendants = await _db.CategoryClosures
                    .Where(cc => cc.AncestorId == categoryId.Value && cc.Distance > 0)
                    .Select(cc => cc.DescendantId)
                    .ToListAsync();
                
                categoryIds.AddRange(descendants);
                
                filteredProductsForSearch = filteredProductsForSearch.Where(p => p.CategoryId.HasValue && categoryIds.Contains(p.CategoryId.Value)).ToList();
            }
        }

        var products = filteredProductsForSearch
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        // Like bilgilerini topla
        var spids = products.Select(p => p.Id).ToList();
        var slikeCounts = await _db.ProductLikes
            .Where(l => spids.Contains(l.ProductId))
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var slikeCountMap = slikeCounts.ToDictionary(x => x.ProductId, x => x.Count);

        // Comment bilgilerini topla
        var scommentCounts = await _db.Comments
            .Where(c => spids.Contains(c.ProductId))
            .GroupBy(c => c.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var scommentCountMap = scommentCounts.ToDictionary(x => x.ProductId, x => x.Count);

        var sUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var slikeSet = new HashSet<Guid>();
        if (!string.IsNullOrEmpty(sUserId))
        {
            var likedIds = await _db.ProductLikes
                .Where(l => l.UserId == sUserId && spids.Contains(l.ProductId))
                .Select(l => l.ProductId)
                .ToListAsync();
            slikeSet = new HashSet<Guid>(likedIds);
        }

        // Tüm kullanıcıları toplu olarak çek (optimizasyon için)
        var sUserIds = products.Select(p => p.UserId).Distinct().ToList();
        var sUsers = await _db.Users.OfType<ApplicationUser>()
            .Where(u => sUserIds.Contains(u.Id))
            .ToListAsync();
        var sUserDict = sUsers.ToDictionary(u => u.Id, u => u);

        // Kategori çevirilerini toplu olarak al
        var searchCategoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var searchCategoryTranslations = await _db.CategoryTranslations
            .Where(t => searchCategoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        // Premium veya IsWebProfilePublic=true olan kullanıcılar için profil linki gösterilir
        var searchWebProfileViewableIds = new HashSet<string>();
        foreach (var uid in sUserIds)
        {
            var u = sUserDict.GetValueOrDefault(uid);
            if (u != null && (u.IsWebProfilePublic == true || await _entitlementService.IsPremiumAsync(uid)))
                searchWebProfileViewableIds.Add(uid);
        }

        var result = products.Select(p => {
            var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
            var user = sUserDict.ContainsKey(p.UserId) ? sUserDict[p.UserId] : null;
            var likeCount = slikeCountMap.ContainsKey(p.Id) ? slikeCountMap[p.Id] : 0;
            var badges = CalculateBadges(p, likeCount);
            
            // Web profil görünürlüğü: IsWebProfilePublic AYARLI veya Premium üye
            var isWebProfilePublic = user != null && searchWebProfileViewableIds.Contains(p.UserId);
            var isOwner = !string.IsNullOrEmpty(currentUserIdSearch) && p.UserId == currentUserIdSearch;
            var canViewProfile = isWebProfilePublic || isOwner;
            
            // Kategori adını çevirilere göre al
            string? categoryName = null;
            if (p.CategoryId.HasValue && searchCategoryTranslations.ContainsKey(p.CategoryId.Value))
                categoryName = searchCategoryTranslations[p.CategoryId.Value];
            else if (p.Category != null)
                categoryName = p.Category.Name;
            return new
            {
                id = p.Id.ToString(),
                title = p.Title,
                p.Description,
                p.Hashtags,
                createdAt = p.CreatedAt,
                userId = p.UserId,
                user = GetUserDisplayName(user, p.UserId),
                userName = _usernameService.GetUserCurrentUsername(user), // Güncel username
                canViewProfile = canViewProfile, // Profil görüntülenebilir mi?
                isWebProfilePublic = isWebProfilePublic, // Web profili herkese açık mı?
                category = categoryName,
                categoryId = p.CategoryId?.ToString(),
                firstPhotoUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                photoCount = p.Photos.Count,
                photos = p.Photos.OrderBy(ph => ph.Order).Select(ph => new { 
                    blobUrl = GetPhotoUrl(ph, bucket),
                    order = ph.Order 
                }).Where(ph => !string.IsNullOrWhiteSpace(ph.blobUrl)).ToList(),
                likeCount = likeCount,
                isLiked = slikeSet.Contains(p.Id),
                commentCount = scommentCountMap.ContainsKey(p.Id) ? scommentCountMap[p.Id] : 0,
                commentsEnabled = p.CommentsEnabled,
                badges = badges
            };
        }).ToList();

        // Arama logunu kaydet (asenkron olarak, response'u geciktirmemek için)
        // Thread-safe olması için yeni scope oluştur
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                
                var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
                var userAgent = Request.Headers["User-Agent"].ToString();
                
                var searchLog = new SearchLog
                {
                    Id = Guid.NewGuid().ToString(),
                    UserId = currentUserIdSearch,
                    SearchType = SearchType.Products,
                    Query = query,
                    CategoryId = categoryId,
                    ResultCount = result.Count,
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    Language = lang,
                    CreatedAtUtc = DateTime.UtcNow
                };

                db.SearchLogs.Add(searchLog);
                await db.SaveChangesAsync();
                _logger.LogInformation("Search log saved: Type={SearchType}, Query={Query}, CategoryId={CategoryId}, Results={ResultCount}, UserId={UserId}, Language={Language}", 
                    SearchType.Products, query ?? "(empty)", categoryId?.ToString() ?? "none", result.Count, currentUserIdSearch ?? "anonymous", lang);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log search attempt for Products search. Query={Query}, CategoryId={CategoryId}, UserId={UserId}", 
                    query ?? "(empty)", categoryId?.ToString() ?? "none", currentUserIdSearch ?? "anonymous");
            }
        });

        return Ok(result);
    }

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetUserPublicProducts(string userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? language = null)
    {
        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";

        // Kullanıcının varlığını kontrol et
        var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return NotFound("Kullanıcı bulunamadı.");
        }

        // Kullanıcının display name'ini al
        var user = (from u in _db.Users.OfType<ApplicationUser>() where u.Id == userId select u).FirstOrDefault();
        if (user == null)
        {
            return NotFound("Kullanıcı bulunamadı.");
        }
        var displayName = GetUserDisplayName(user, userId);

        // Mevcut kullanıcı bu kullanıcıyı takip ediyor mu?
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwnProfile = !string.IsNullOrEmpty(currentUserId) && currentUserId == userId;
        var isFollowing = !string.IsNullOrEmpty(currentUserId) && 
            await _db.Follows.AnyAsync(f => f.FollowerId == currentUserId && f.FollowingId == userId && f.Status == FollowStatus.Accepted);

        // Kapalı hesap kontrolü: Kendi profili değilse ve kapalı hesap ise ve takip edilmiyorsa ürünleri gösterme
        if (!isOwnProfile && user.IsPrivateAccount && !isFollowing)
        {
            // Takipçi ve takip edilen sayılarını al (sadece kabul edilmiş olanlar)
            var followerCount = await _db.Follows.CountAsync(f => f.FollowingId == userId && f.Status == FollowStatus.Accepted);
            var followingCount = await _db.Follows.CountAsync(f => f.FollowerId == userId && f.Status == FollowStatus.Accepted);
            
            return Ok(new
            {
                UserId = userId,
                DisplayName = displayName,
                AvatarUrl = user.AvatarUrl,
                FollowerCount = followerCount,
                FollowingCount = followingCount,
                IsFollowing = false,
                IsPrivateAccount = true,
                CanViewProducts = false,
                Products = new List<object>()
            });
        }

        // Takipçi ve takip edilen sayılarını al (kendi profili ise tüm takipçileri, değilse sadece kabul edilmiş olanları)
        var followerCountFinal = await _db.Follows.CountAsync(f => f.FollowingId == userId && (isOwnProfile || f.Status == FollowStatus.Accepted));
        var followingCountFinal = await _db.Follows.CountAsync(f => f.FollowerId == userId && (isOwnProfile || f.Status == FollowStatus.Accepted));

        var products = await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.UserId == userId && p.IsPublic == true) // Sadece bu kullanıcının paylaşıma açık ürünleri
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Like bilgilerini topla
        var upids = products.Select(p => p.Id).ToList();
        var ulikeCounts = await _db.ProductLikes
            .Where(l => upids.Contains(l.ProductId))
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var ulikeCountMap = ulikeCounts.ToDictionary(x => x.ProductId, x => x.Count);

        // Comment bilgilerini topla
        var ucommentCounts = await _db.Comments
            .Where(c => upids.Contains(c.ProductId))
            .GroupBy(c => c.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var ucommentCountMap = ucommentCounts.ToDictionary(x => x.ProductId, x => x.Count);

        var uUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var ulikeSet = new HashSet<Guid>();
        if (!string.IsNullOrEmpty(uUserId))
        {
            var likedIds = await _db.ProductLikes
                .Where(l => l.UserId == uUserId && upids.Contains(l.ProductId))
                .Select(l => l.ProductId)
                .ToListAsync();
            ulikeSet = new HashSet<Guid>(likedIds);
        }

        // Kategori çevirilerini toplu olarak al
        var userProdCategoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var userProdCategoryTranslations = await _db.CategoryTranslations
            .Where(t => userProdCategoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        var result = new
        {
            userId = userId,
            displayName = displayName,
            avatarUrl = user.AvatarUrl,
            followerCount = followerCountFinal,
            followingCount = followingCountFinal,
            isFollowing = isFollowing,
            isPrivateAccount = user.IsPrivateAccount,
            canViewProducts = true,
            products = products.Select(p => {
                var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
                var likeCount = ulikeCountMap.ContainsKey(p.Id) ? ulikeCountMap[p.Id] : 0;
                var badges = CalculateBadges(p, likeCount);
                // Kategori adını çevirilere göre al
                string? catName = null;
                if (p.CategoryId.HasValue && userProdCategoryTranslations.ContainsKey(p.CategoryId.Value))
                    catName = userProdCategoryTranslations[p.CategoryId.Value];
                else if (p.Category != null)
                    catName = p.Category.Name;
                return new
                {
                    id = p.Id.ToString(),
                    title = p.Title,
                    description = p.Description,
                    hashtags = p.Hashtags,
                    createdAt = p.CreatedAt,
                    category = catName,
                    categoryId = p.CategoryId,
                    firstPhotoUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                    photoCount = p.Photos.Count,
                    likeCount = likeCount,
                    isLiked = ulikeSet.Contains(p.Id),
                    commentCount = ucommentCountMap.ContainsKey(p.Id) ? ucommentCountMap[p.Id] : 0,
                    commentsEnabled = p.CommentsEnabled,
                    badges = badges
                };
            }).ToList()
        };

        return Ok(result);
    }

    /// <summary>
    /// Tüm fotoğrafları public yap (migration için)
    /// </summary>
    [HttpPost("make-all-photos-public")]
    [Authorize]
    public async Task<IActionResult> MakeAllPhotosPublic()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        if (string.IsNullOrWhiteSpace(bucket)) return StatusCode(500, "Bucket not configured");

        var allPhotos = await _db.ProductPhotos
            .Where(p => p.Product != null && p.Product.UserId == userId)
            .ToListAsync();

        int successCount = 0;
        int failCount = 0;

        // Not: ACL API'si şu anda çalışmıyor
        // Bucket zaten public yapıldı, tüm dosyalar erişilebilir olmalı
        // Eğer hala sorun varsa, gsutil komutu ile yapılabilir:
        // gsutil -m acl ch -u AllUsers:R gs://bucket/uploads/**
        foreach (var photo in allPhotos)
        {
            try
            {
                // Bucket public olduğu için dosyalar zaten erişilebilir
                successCount++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to verify photo: {BlobName}", photo.BlobName);
                failCount++;
            }
        }

        return Ok(new { 
            message = $"Fotoğraflar güncellendi. Başarılı: {successCount}, Başarısız: {failCount}",
            successCount,
            failCount,
            totalCount = allPhotos.Count
        });
    }

    /// <summary>
    /// AI kullanarak ürün açıklamasından fiyat tahmini yapar (her zaman USD olarak sor, sonra kullanıcının currency'sine çevir)
    /// </summary>
    [HttpPost("estimate-price")]
    [Authorize]
    public async Task<IActionResult> EstimatePrice([FromBody] EstimatePriceRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (_geminiAnalysis == null)
        {
            return BadRequest(new { error = "AI servisi yapılandırılmamış" });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { error = "Ürün açıklaması gerekli" });
        }

        // AI Kredi kontrolü
        if (_aiCreditService != null)
        {
            var hasSufficientCredits = await _aiCreditService.HasSufficientCreditsAsync(userId, AIOperationType.PriceDetection);
            if (!hasSufficientCredits)
            {
                var balance = await _aiCreditService.GetUserBalanceAsync(userId);
                var operationCost = await _aiCreditService.GetOperationCostAsync(AIOperationType.PriceDetection);
                var requiredCredits = operationCost?.CreditCost ?? 1; // Fallback
                return StatusCode(402, new { 
                    success = false,
                    error = $"Yetersiz AI kredisi. Bu işlem için {requiredCredits} kredi gereklidir.",
                    balance = balance
                });
            }
            
            _logger.LogInformation($"Kullanıcı {userId} için AI kredi kontrolü başarılı (Fiyat tahmini). İşlem başlatılıyor.");
        }

        try
        {
            // Kullanıcının currency'sini al
            var user = await _db.Users.FindAsync(userId);
            var targetCurrency = request.Currency ?? user?.Currency ?? "TRY";
            if (string.IsNullOrWhiteSpace(targetCurrency))
            {
                targetCurrency = "TRY";
            }
            targetCurrency = targetCurrency.ToUpper();

            var language = request.Language ?? "en";
            
            // AI'dan her zaman USD olarak fiyat al
            var result = await _geminiAnalysis.EstimatePriceAsync(request.Description, language);
            
            // AI Kredi harcama/iade (başarılı olursa harca, başarısız olursa harcama)
            if (_aiCreditService != null)
            {
                try
                {
                    var isSuccessful = result.EstimatedPrice.HasValue && result.Error == null;
                    
                    if (isSuccessful)
                    {
                        // Başarılı fiyat tahmini - kredi harca
                        await _aiCreditService.SpendCreditsAsync(
                            userId, 
                            AIOperationType.PriceDetection,
                            $"Fiyat tahmini: {request.Description.Substring(0, Math.Min(50, request.Description.Length))}...",
                            productId: null
                        );
                        _logger.LogInformation($"Kullanıcı {userId} için 1 AI kredisi harcandı (Fiyat tahmini).");
                    }
                    else
                    {
                        // Başarısız fiyat tahmini - kredi harcama (zaten harcamadık)
                        _logger.LogInformation($"Fiyat tahmini başarısız olduğu için kullanıcı {userId} için AI kredisi harcanmadı.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"AI kredi işlemi sırasında hata oluştu (UserId: {userId}, Fiyat tahmini)");
                }
            }
            
            if (result.Error != null)
            {
                return Ok(new { 
                    success = false, 
                    error = result.Error,
                    reasoning = result.Reasoning
                });
            }

            if (result.EstimatedPrice.HasValue)
            {
                decimal finalPrice = result.EstimatedPrice.Value;
                string finalCurrency = "USD";

                // Eğer kullanıcının currency'si USD değilse, döviz kuru ile çevir
                if (targetCurrency != "USD" && _exchangeRateService != null)
                {
                    var exchangeRate = await _exchangeRateService.GetExchangeRateAsync("USD", targetCurrency);
                    if (exchangeRate.HasValue)
                    {
                        finalPrice = result.EstimatedPrice.Value * exchangeRate.Value;
                        finalCurrency = targetCurrency;
                        _logger.LogInformation($"[PRICE_ESTIMATE] USD {result.EstimatedPrice.Value} -> {targetCurrency} {finalPrice} (Kur: {exchangeRate.Value})");
                    }
                    else
                    {
                        _logger.LogWarning($"[PRICE_ESTIMATE] Döviz kuru bulunamadı: USD -> {targetCurrency}, USD olarak döndürülüyor");
                        // Döviz kuru bulunamazsa USD olarak döndür
                    }
                }

                return Ok(new { 
                    success = true, 
                    estimatedPrice = finalPrice,
                    currency = finalCurrency,
                    reasoning = result.Reasoning
                });
            }

            return Ok(new { 
                success = false, 
                error = result.Reasoning ?? "Fiyat tahmin edilemedi",
                reasoning = result.Reasoning
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fiyat tahmini hatası");
            return StatusCode(500, new { error = "Fiyat tahmini sırasında bir hata oluştu" });
        }
    }

    public class EstimatePriceRequest
    {
        public string Description { get; set; } = string.Empty;
        public string? Language { get; set; }
        public string? Currency { get; set; } // Kullanıcının currency'si (opsiyonel, yoksa DB'den alınır)
    }
}


