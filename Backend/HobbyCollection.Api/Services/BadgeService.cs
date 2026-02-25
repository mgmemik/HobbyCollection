using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Services;

public interface IBadgeService
{
    Task<List<ProductBadge>> CalculateBadgesAsync(Guid productId);
    Task UpdateProductBadgesAsync(Guid productId);
    Task<Dictionary<Guid, List<ProductBadge>>> CalculateBatchBadgesAsync(List<Guid> productIds);
}

public class BadgeService : IBadgeService
{
    private readonly AppDbContext _db;
    
    public BadgeService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Bir ürün için tüm badge'leri hesaplar
    /// </summary>
    public async Task<List<ProductBadge>> CalculateBadgesAsync(Guid productId)
    {
        var product = await _db.Products
            .Include(p => p.Badges)
            .FirstOrDefaultAsync(p => p.Id == productId);
            
        if (product == null) return new List<ProductBadge>();

        var badges = new List<ProductBadge>();
        var now = DateTime.UtcNow;

        // 1. NEW Badge - Son 7 günde eklenen
        if ((now - product.CreatedAt).TotalDays <= 7)
        {
            badges.Add(ProductBadge.New);
        }

        // 2. HOT Badge - 10+ beğeni alan ürünler
        var likeCount = await _db.ProductLikes
            .CountAsync(pl => pl.ProductId == productId);
        if (likeCount >= 10)
        {
            badges.Add(ProductBadge.Hot);
        }

        // 3. TRENDING Badge - Son 3 günde 5+ beğeni alan
        var recentLikes = await _db.ProductLikes
            .CountAsync(pl => pl.ProductId == productId && (now - pl.CreatedAt).TotalDays <= 3);
        if (recentLikes >= 5)
        {
            badges.Add(ProductBadge.Trending);
        }

        // Manuel badge'ler
        if (product.IsRare) badges.Add(ProductBadge.Rare);
        if (product.IsMint) badges.Add(ProductBadge.Mint);
        if (product.IsGraded) badges.Add(ProductBadge.Graded);
        if (product.IsSigned) badges.Add(ProductBadge.Signed);
        if (product.IsLimited) badges.Add(ProductBadge.Limited);
        if (product.IsFeatured) badges.Add(ProductBadge.Featured);

        return badges.Distinct().ToList();
    }

    /// <summary>
    /// Bir ürün için badge'leri hesaplar ve veritabanını günceller
    /// </summary>
    public async Task UpdateProductBadgesAsync(Guid productId)
    {
        var badges = await CalculateBadgesAsync(productId);
        var now = DateTime.UtcNow;

        // Mevcut badge'leri temizle (otomatik olanları)
        var existingBadges = await _db.ProductBadges
            .Where(pb => pb.ProductId == productId && pb.IsAutomatic)
            .ToListAsync();
        _db.ProductBadges.RemoveRange(existingBadges);

        // Yeni badge'leri ekle
        foreach (var badge in badges)
        {
            // Otomatik badge'lerin son kullanma tarihleri
            DateTime? expiresAt = badge switch
            {
                ProductBadge.New => now.AddDays(7 - (now - (await _db.Products.Where(p => p.Id == productId).Select(p => p.CreatedAt).FirstOrDefaultAsync())).TotalDays),
                ProductBadge.Trending => now.AddDays(3),
                _ => null
            };

            _db.ProductBadges.Add(new ProductBadgeInfo
            {
                ProductId = productId,
                Badge = badge,
                IsAutomatic = IsAutomaticBadge(badge),
                AssignedAt = now,
                ExpiresAt = expiresAt
            });
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Birden fazla ürün için badge'leri toplu olarak hesaplar (performans için)
    /// </summary>
    public async Task<Dictionary<Guid, List<ProductBadge>>> CalculateBatchBadgesAsync(List<Guid> productIds)
    {
        if (!productIds.Any()) return new Dictionary<Guid, List<ProductBadge>>();

        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.AddDays(-7);
        var threeDaysAgo = now.AddDays(-3);

        // Toplu veri çekme (performance)
        var products = await _db.Products
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.CreatedAt,
                p.IsRare,
                p.IsMint,
                p.IsGraded,
                p.IsSigned,
                p.IsLimited,
                p.IsFeatured
            })
            .ToListAsync();

        var likeCountsAll = await _db.ProductLikes
            .Where(pl => productIds.Contains(pl.ProductId))
            .GroupBy(pl => pl.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();

        var likeCountsRecent = await _db.ProductLikes
            .Where(pl => productIds.Contains(pl.ProductId) && pl.CreatedAt >= threeDaysAgo)
            .GroupBy(pl => pl.ProductId)
            .Select(g => new { ProductId = g.Key, Count = g.Count() })
            .ToListAsync();

        var likeCountMap = likeCountsAll.ToDictionary(x => x.ProductId, x => x.Count);
        var recentLikeCountMap = likeCountsRecent.ToDictionary(x => x.ProductId, x => x.Count);

        // Her ürün için badge'leri hesapla
        var result = new Dictionary<Guid, List<ProductBadge>>();

        foreach (var product in products)
        {
            var badges = new List<ProductBadge>();

            // NEW
            if (product.CreatedAt >= sevenDaysAgo)
            {
                badges.Add(ProductBadge.New);
            }

            // HOT
            if (likeCountMap.TryGetValue(product.Id, out var likeCount) && likeCount >= 10)
            {
                badges.Add(ProductBadge.Hot);
            }

            // TRENDING
            if (recentLikeCountMap.TryGetValue(product.Id, out var recentLikes) && recentLikes >= 5)
            {
                badges.Add(ProductBadge.Trending);
            }

            // Manuel badge'ler
            if (product.IsRare) badges.Add(ProductBadge.Rare);
            if (product.IsMint) badges.Add(ProductBadge.Mint);
            if (product.IsGraded) badges.Add(ProductBadge.Graded);
            if (product.IsSigned) badges.Add(ProductBadge.Signed);
            if (product.IsLimited) badges.Add(ProductBadge.Limited);
            if (product.IsFeatured) badges.Add(ProductBadge.Featured);

            result[product.Id] = badges.Distinct().ToList();
        }

        return result;
    }

    private bool IsAutomaticBadge(ProductBadge badge)
    {
        return badge switch
        {
            ProductBadge.New => true,
            ProductBadge.Hot => true,
            ProductBadge.Trending => true,
            _ => false
        };
    }
}

