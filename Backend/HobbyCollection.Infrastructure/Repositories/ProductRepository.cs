using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Infrastructure.Repositories;

public sealed class ProductRepository : IProductRepository
{
    private readonly AppDbContext _db;
    public ProductRepository(AppDbContext db) { _db = db; }

    public async Task AddAsync(Product product, CancellationToken ct = default)
    {
        await _db.Products.AddAsync(product, ct);
    }

    public async Task<Product?> GetByIdAsync(Guid id, string userId, CancellationToken ct = default)
    {
        return await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.Id == id && p.UserId == userId)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<Product?> GetPublicByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.Id == id && p.IsPublic == true)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<List<Product>> GetUserProductsAsync(string userId, int page, int pageSize, CancellationToken ct = default)
    {
        return await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async Task<List<Product>> GetPublicFeedAsync(int page, int pageSize, CancellationToken ct = default)
    {
        return await _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.IsPublic == true)
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async Task<List<Product>> SearchPublicAsync(string? query, Guid? categoryId, int page, int pageSize, CancellationToken ct = default)
    {
        var productsQuery = _db.Products
            .Include(p => p.Photos.OrderBy(ph => ph.Order))
            .Include(p => p.Category)
            .Where(p => p.IsPublic == true)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var searchTerm = query.ToLower();
            productsQuery = productsQuery.Where(p =>
                (p.Hashtags != null && p.Hashtags.ToLower().Contains(searchTerm)) ||
                (p.Description != null && p.Description.ToLower().Contains(searchTerm)) ||
                (p.Title != null && p.Title.ToLower().Contains(searchTerm))
            );
        }

        if (categoryId.HasValue)
        {
            // Using closure table for descendants
            var descendants = await _db.CategoryClosures
                .Where(cc => cc.AncestorId == categoryId.Value && cc.Distance > 0)
                .Select(cc => cc.DescendantId)
                .ToListAsync(ct);

            var categoryIds = new List<Guid> { categoryId.Value };
            categoryIds.AddRange(descendants);

            productsQuery = productsQuery.Where(p => p.CategoryId.HasValue && categoryIds.Contains(p.CategoryId.Value));
        }

        return await productsQuery
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async Task<int> MigrateAnonymousAsync(string userId, CancellationToken ct = default)
    {
        return await _db.Products
            .Where(p => p.UserId == "anonymous")
            .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.UserId, userId), ct);
    }

    public Task DeleteAsync(Product product, CancellationToken ct = default)
    {
        _db.Products.Remove(product);
        return Task.CompletedTask;
    }

    public async Task AddPhotoAsync(ProductPhoto photo, CancellationToken ct = default)
    {
        await _db.ProductPhotos.AddAsync(photo, ct);
    }

    public async Task RemovePhotoAsync(Guid photoId, CancellationToken ct = default)
    {
        var photo = await _db.ProductPhotos.FirstOrDefaultAsync(p => p.Id == photoId, ct);
        if (photo != null)
        {
            _db.ProductPhotos.Remove(photo);
        }
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}


