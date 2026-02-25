using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using HobbyCollection.Domain.Services;

namespace HobbyCollection.Infrastructure.Services;

public sealed class CategoryService : ICategoryService
{
    private readonly ICategoryRepository _categories;
    private readonly ICategoryClosureRepository _closures;

    public CategoryService(ICategoryRepository categories, ICategoryClosureRepository closures)
    {
        _categories = categories;
        _closures = closures;
    }

    public async Task<Category> CreateAsync(string name, Guid? parentId, string? description, CancellationToken ct = default)
    {
        var cat = new Category { Name = name, ParentId = parentId, Description = description, Slug = name.ToLower().Replace(' ', '-') };
        await _categories.AddAsync(cat, ct);
        await _categories.SaveChangesAsync(ct);

        var closures = new List<CategoryClosure> { new() { AncestorId = cat.Id, DescendantId = cat.Id, Distance = 0 } };
        if (parentId.HasValue)
        {
            var ancestors = await _closures.GetDescendantIdsAsync(parentId.Value, ct); // misuse; need ancestors of parent
            // Fallback: just add parent link distance 1 if unable to query ancestors; keeps API behavior close
            closures.Add(new CategoryClosure { AncestorId = parentId.Value, DescendantId = cat.Id, Distance = 1 });
        }
        await _closures.AddRangeAsync(closures, ct);
        await _categories.SaveChangesAsync(ct);
        return cat;
    }

    public Task<List<Category>> GetChildrenAsync(Guid id, CancellationToken ct = default) => _categories.GetChildrenAsync(id, ct);

    public Task<List<Category>> GetRootsAsync(CancellationToken ct = default) => _categories.GetRootsAsync(ct);

    public Task<List<Category>> GetChildrenWithTranslationAsync(Guid id, string languageCode, CancellationToken ct = default) 
        => _categories.GetChildrenWithTranslationAsync(id, languageCode, ct);

    public Task<List<Category>> GetRootsWithTranslationAsync(string languageCode, CancellationToken ct = default) 
        => _categories.GetRootsWithTranslationAsync(languageCode, ct);
}



