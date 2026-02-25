using HobbyCollection.Domain.Abstractions;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using HobbyCollection.Domain.Services;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Infrastructure.Services;

public sealed class ProductService : IProductService
{
    private readonly IProductRepository _products;
    private readonly IImageStorageService _images;
    private readonly ILogger<ProductService> _logger;

    public ProductService(IProductRepository products, IImageStorageService images, ILogger<ProductService> logger)
    {
        _products = products;
        _images = images;
        _logger = logger;
    }

    public async Task<Product> CreateAsync(Product product, IEnumerable<(Stream stream, string fileName, string contentType)> files, string bucket, CancellationToken ct = default)
    {
        // LOG: ProductService'e gelmeden önce description durumu
        _logger.LogInformation("[ProductService.CreateAsync] === PRODUCT SERVICE LOG ===");
        _logger.LogInformation("[ProductService.CreateAsync] Product.Description (raw): {Description}", product.Description);
        _logger.LogInformation("[ProductService.CreateAsync] Product.Description length: {Length}", product.Description?.Length ?? 0);
        _logger.LogInformation("[ProductService.CreateAsync] Product.Description contains newlines: {HasNewlines}", product.Description?.Contains('\n') ?? false);
        _logger.LogInformation("[ProductService.CreateAsync] Product.Description newline count: {Count}", product.Description?.Count(c => c == '\n') ?? 0);
        if (!string.IsNullOrEmpty(product.Description))
        {
            _logger.LogInformation("[ProductService.CreateAsync] Product.Description (JSON escaped): {DescriptionJson}", System.Text.Json.JsonSerializer.Serialize(product.Description));
        }
        
        int order = 0;
        foreach (var (stream, fileName, contentType) in files)
        {
            var (blob, url, size) = await _images.UploadSquareAsync(stream, fileName, contentType, bucket);
            product.Photos.Add(new ProductPhoto
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                BlobName = blob,
                BlobUrl = url,
                ContentType = "image/jpeg",
                SizeBytes = size,
                Order = order++
            });
        }

        // LOG: Veritabanına kaydedilmeden önce
        _logger.LogInformation("[ProductService.CreateAsync] Veritabanına kaydedilmeden önce Product.Description: {Description}", System.Text.Json.JsonSerializer.Serialize(product.Description));
        
        await _products.AddAsync(product, ct);
        await _products.SaveChangesAsync(ct);
        
        // LOG: Veritabanına kaydedildikten sonra
        _logger.LogInformation("[ProductService.CreateAsync] Veritabanına kaydedildikten sonra Product.Description: {Description}", System.Text.Json.JsonSerializer.Serialize(product.Description));
        
        return product;
    }

    public Task<List<Product>> GetUserProductsAsync(string userId, int page, int pageSize, CancellationToken ct = default)
        => _products.GetUserProductsAsync(userId, page, pageSize, ct);

    public Task<Product?> GetByIdAsync(Guid id, string userId, CancellationToken ct = default)
        => _products.GetByIdAsync(id, userId, ct);

    public Task<List<Product>> GetPublicFeedAsync(int page, int pageSize, CancellationToken ct = default)
        => _products.GetPublicFeedAsync(page, pageSize, ct);

    public Task<List<Product>> SearchPublicAsync(string? query, Guid? categoryId, int page, int pageSize, CancellationToken ct = default)
        => _products.SearchPublicAsync(query, categoryId, page, pageSize, ct);

    public Task<int> MigrateAnonymousAsync(string userId, CancellationToken ct = default)
        => _products.MigrateAnonymousAsync(userId, ct);

    public async Task DeleteAsync(Guid id, string userId, string bucket, CancellationToken ct = default)
    {
        var p = await _products.GetByIdAsync(id, userId, ct);
        if (p == null) return;

        foreach (var photo in p.Photos)
        {
            try
            {
                await _images.DeleteAsync(bucket, photo.BlobName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete blob {BlobName}", photo.BlobName);
            }
        }

        await _products.DeleteAsync(p, ct);
        await _products.SaveChangesAsync(ct);
    }
}


