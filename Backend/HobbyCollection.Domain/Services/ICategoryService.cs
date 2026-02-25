using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Services;

public interface ICategoryService
{
    Task<Category> CreateAsync(string name, Guid? parentId, string? description, CancellationToken ct = default);
    Task<List<Category>> GetChildrenAsync(Guid id, CancellationToken ct = default);
    Task<List<Category>> GetRootsAsync(CancellationToken ct = default);
    Task<List<Category>> GetChildrenWithTranslationAsync(Guid id, string languageCode, CancellationToken ct = default);
    Task<List<Category>> GetRootsWithTranslationAsync(string languageCode, CancellationToken ct = default);
}



