using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Services;

public interface IProductService
{
    Task<Product> CreateAsync(Product product, IEnumerable<(Stream stream, string fileName, string contentType)> files, string bucket, CancellationToken ct = default);
    Task<List<Product>> GetUserProductsAsync(string userId, int page, int pageSize, CancellationToken ct = default);
    Task<Product?> GetByIdAsync(Guid id, string userId, CancellationToken ct = default);
    Task<List<Product>> GetPublicFeedAsync(int page, int pageSize, CancellationToken ct = default);
    Task<List<Product>> SearchPublicAsync(string? query, Guid? categoryId, int page, int pageSize, CancellationToken ct = default);
    Task<int> MigrateAnonymousAsync(string userId, CancellationToken ct = default);
    Task DeleteAsync(Guid id, string userId, string bucket, CancellationToken ct = default);
}



