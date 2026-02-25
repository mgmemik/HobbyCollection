using System.Security.Claims;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using HobbyCollection.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _cfg;
    private readonly UsernameService _usernameService;
    private readonly IEntitlementService _entitlementService;

    public UsersController(AppDbContext db, IConfiguration cfg, UsernameService usernameService, IEntitlementService entitlementService)
    {
        _db = db;
        _cfg = cfg;
        _usernameService = usernameService;
        _entitlementService = entitlementService;
    }

    /// <summary>
    /// Public user profile endpoint - Web sitesi için
    /// Username veya User ID ile kullanılabilir (backwards compatible)
    /// </summary>
    [HttpGet("{userIdentifier}/profile")]
    public async Task<IActionResult> GetUserProfile(string userIdentifier)
    {
        // Username mi yoksa GUID mi kontrol et
        ApplicationUser? user;
        if (Guid.TryParse(userIdentifier, out var guid))
        {
            // GUID - backward compatibility için
            user = await _db.Users.OfType<ApplicationUser>()
                .FirstOrDefaultAsync(u => u.Id == userIdentifier);
        }
        else
        {
            // Username slug
            var userId = await _usernameService.GetUserIdByUsernameAsync(userIdentifier);
            if (userId == null)
            {
                return NotFound(new { error = "USER_NOT_FOUND", message = "Kullanıcı bulunamadı" });
            }
            
            user = await _db.Users.OfType<ApplicationUser>()
                .FirstOrDefaultAsync(u => u.Id == userId);
        }

        if (user == null)
        {
            return NotFound(new { error = "USER_NOT_FOUND", message = "Kullanıcı bulunamadı" });
        }

        // Web profil görünürlüğü kontrolü
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwnProfile = !string.IsNullOrEmpty(currentUserId) && currentUserId == user.Id;

        // Kendi profiliniz, web profili açık veya Premium üye ise erişim var
        if (!isOwnProfile)
        {
            var isWebProfileViewable = user.IsWebProfilePublic == true || await _entitlementService.IsPremiumAsync(user.Id);
            if (!isWebProfileViewable)
            {
                return NotFound(new { 
                    error = "PROFILE_NOT_PUBLIC", 
                    message = "Bu kullanıcının web profili herkese açık değil" 
                });
            }
        }

        // Product sayısını hesapla
        var productCount = await _db.Products
            .Where(p => p.UserId == user.Id && p.IsPublic)
            .CountAsync();

        // Follower/Following sayılarını hesapla
        var followerCount = await _db.Follows
            .Where(f => f.FollowingId == user.Id && f.Status == FollowStatus.Accepted)
            .CountAsync();

        var followingCount = await _db.Follows
            .Where(f => f.FollowerId == user.Id && f.Status == FollowStatus.Accepted)
            .CountAsync();

        // Güncel username'i al
        var currentUsername = _usernameService.GetUserCurrentUsername(user);
        
        return Ok(new
        {
            userId = user.Id,
            username = currentUsername, // Güncel username
            displayName = currentUsername, // DisplayName kaldırıldı, username kullanılıyor
            avatarUrl = user.AvatarUrl,
            email = isOwnProfile ? user.Email : null, // Email sadece kendi profilinde
            productCount,
            followerCount,
            followingCount,
            isPrivateAccount = user.IsPrivateAccount,
            isWebProfilePublic = user.IsWebProfilePublic
        });
    }

    /// <summary>
    /// Public user products endpoint - Web sitesi için
    /// Username veya User ID ile kullanılabilir (backwards compatible)
    /// Sadece IsWebProfilePublic = true olan kullanıcıların ürünleri görünür
    /// </summary>
    [HttpGet("{userIdentifier}/products")]
    public async Task<IActionResult> GetUserProducts(string userIdentifier, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? language = null)
    {
        // Username mi yoksa GUID mi kontrol et
        ApplicationUser? user;
        if (Guid.TryParse(userIdentifier, out var guid))
        {
            // GUID - backward compatibility için
            user = await _db.Users.OfType<ApplicationUser>()
                .FirstOrDefaultAsync(u => u.Id == userIdentifier);
        }
        else
        {
            // Username slug
            var userId = await _usernameService.GetUserIdByUsernameAsync(userIdentifier);
            if (userId == null)
            {
                return NotFound(new { error = "USER_NOT_FOUND", message = "Kullanıcı bulunamadı" });
            }
            
            user = await _db.Users.OfType<ApplicationUser>()
                .FirstOrDefaultAsync(u => u.Id == userId);
        }

        if (user == null)
        {
            return NotFound(new { error = "USER_NOT_FOUND", message = "Kullanıcı bulunamadı" });
        }

        // Web profil görünürlüğü kontrolü
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwnProfile = !string.IsNullOrEmpty(currentUserId) && currentUserId == user.Id;

        var isWebProfileViewable = user.IsWebProfilePublic == true || await _entitlementService.IsPremiumAsync(user.Id);
        if (!isOwnProfile && !isWebProfileViewable)
        {
            return NotFound(new { 
                error = "PROFILE_NOT_PUBLIC", 
                message = "Bu kullanıcının web profili herkese açık değil" 
            });
        }

        string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
        var lang = string.IsNullOrEmpty(language) ? "en" : language;
        if (lang != "en" && lang != "tr") lang = "en";

        var query = _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.UserId == user.Id && p.IsPublic)
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await query.CountAsync();
        var products = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Kategori çevirilerini toplu olarak al
        var categoryIds = products.Where(p => p.CategoryId.HasValue).Select(p => p.CategoryId!.Value).Distinct().ToList();
        var categoryTranslations = await _db.CategoryTranslations
            .Where(t => categoryIds.Contains(t.CategoryId) && t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        // Like ve comment bilgilerini topla
        var productIds = products.Select(p => p.Id).ToList();
        
        var likeCounts = await _db.ProductLikes
            .Where(l => productIds.Contains(l.ProductId))
            .GroupBy(l => l.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var likeCountMap = likeCounts.ToDictionary(x => x.ProductId, x => x.Count);

        var commentCounts = await _db.Comments
            .Where(c => productIds.Contains(c.ProductId))
            .GroupBy(c => c.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();
        var commentCountMap = commentCounts.ToDictionary(x => x.ProductId, x => x.Count);

        var result = products.Select(p => {
            var firstPhoto = p.Photos.OrderBy(ph => ph.Order).FirstOrDefault();
            var likeCount = likeCountMap.ContainsKey(p.Id) ? likeCountMap[p.Id] : 0;
            
            // Kategori adını çevirilere göre al
            string? categoryName = null;
            if (p.CategoryId.HasValue && categoryTranslations.ContainsKey(p.CategoryId.Value))
                categoryName = categoryTranslations[p.CategoryId.Value];
            else if (p.Category != null)
                categoryName = p.Category.Name;

            return new
            {
                id = p.Id.ToString(),
                title = p.Title,
                description = p.Description,
                hashtags = p.Hashtags,
                createdAt = p.CreatedAt,
                category = categoryName,
                categoryId = p.CategoryId,
                firstPhotoUrl = firstPhoto != null ? GetPhotoUrl(firstPhoto, bucket) : null,
                photoCount = p.Photos.Count,
                likeCount = likeCount,
                commentCount = commentCountMap.ContainsKey(p.Id) ? commentCountMap[p.Id] : 0,
                commentsEnabled = p.CommentsEnabled
            };
        }).ToList();

        return Ok(new
        {
            products = result,
            totalCount,
            page,
            pageSize
        });
    }

    private string? GetPhotoUrl(ProductPhoto photo, string bucket)
    {
        if (photo == null) return null;
        if (string.IsNullOrWhiteSpace(photo.BlobName)) return photo.BlobUrl;

        // Google Cloud Storage URL oluştur
        if (!string.IsNullOrWhiteSpace(bucket))
        {
            return $"https://storage.googleapis.com/{bucket}/{photo.BlobName}";
        }

        return photo.BlobUrl;
    }
}
