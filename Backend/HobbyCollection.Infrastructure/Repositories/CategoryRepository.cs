using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Infrastructure.Repositories;

public sealed class CategoryRepository : ICategoryRepository
{
    private readonly AppDbContext _db;
    public CategoryRepository(AppDbContext db) { _db = db; }

    public async Task AddAsync(Category category, CancellationToken ct = default)
    {
        await _db.Categories.AddAsync(category, ct);
    }

    public async Task<Category?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);
    }

    public async Task<List<Category>> GetChildrenAsync(Guid parentId, CancellationToken ct = default)
    {
        return await _db.Categories
            .Include(c => c.Translations)
            .Where(c => c.ParentId == parentId)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<List<Category>> GetRootsAsync(CancellationToken ct = default)
    {
        return await _db.Categories
            .Include(c => c.Translations)
            .Where(c => c.ParentId == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<List<Category>> GetChildrenWithTranslationAsync(Guid parentId, string languageCode, CancellationToken ct = default)
    {
        var categories = await _db.Categories
            .Include(c => c.Translations)
            .Where(c => c.ParentId == parentId)
            .ToListAsync(ct);

        // Apply translations
        foreach (var cat in categories)
        {
            var translation = cat.Translations?.FirstOrDefault(t => t.LanguageCode == languageCode);
            if (translation != null)
            {
                cat.Name = translation.Name;
                cat.Description = translation.Description;
            }
        }

        return categories.OrderBy(c => c.Name).ToList();
    }

    public async Task<List<Category>> GetRootsWithTranslationAsync(string languageCode, CancellationToken ct = default)
    {
        var categories = await _db.Categories
            .Include(c => c.Translations)
            .Where(c => c.ParentId == null)
            .ToListAsync(ct);

        // Apply translations
        foreach (var cat in categories)
        {
            var translation = cat.Translations?.FirstOrDefault(t => t.LanguageCode == languageCode);
            if (translation != null)
            {
                cat.Name = translation.Name;
                cat.Description = translation.Description;
            }
        }

        return categories.OrderBy(c => c.Name).ToList();
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}



