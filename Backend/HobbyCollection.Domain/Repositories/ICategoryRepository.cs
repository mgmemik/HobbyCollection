using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Repositories;

public interface ICategoryRepository
{
    Task<Category?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Category>> GetChildrenAsync(Guid parentId, CancellationToken ct = default);
    Task<List<Category>> GetRootsAsync(CancellationToken ct = default);
    Task<List<Category>> GetChildrenWithTranslationAsync(Guid parentId, string languageCode, CancellationToken ct = default);
    Task<List<Category>> GetRootsWithTranslationAsync(string languageCode, CancellationToken ct = default);
    Task AddAsync(Category category, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}



