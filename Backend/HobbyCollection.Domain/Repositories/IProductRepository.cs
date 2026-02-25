using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Repositories;

public interface IProductRepository
{
    Task AddAsync(Product product, CancellationToken ct = default);
    Task<Product?> GetByIdAsync(Guid id, string userId, CancellationToken ct = default);
    Task<Product?> GetPublicByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Product>> GetUserProductsAsync(string userId, int page, int pageSize, CancellationToken ct = default);
    Task<List<Product>> GetPublicFeedAsync(int page, int pageSize, CancellationToken ct = default);
    Task<List<Product>> SearchPublicAsync(string? query, Guid? categoryId, int page, int pageSize, CancellationToken ct = default);
    Task<int> MigrateAnonymousAsync(string userId, CancellationToken ct = default);
    Task DeleteAsync(Product product, CancellationToken ct = default);
    Task AddPhotoAsync(ProductPhoto photo, CancellationToken ct = default);
    Task RemovePhotoAsync(Guid photoId, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}


