using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Infrastructure.Repositories;

public sealed class CategoryClosureRepository : ICategoryClosureRepository
{
    private readonly AppDbContext _db;
    public CategoryClosureRepository(AppDbContext db) { _db = db; }

    public async Task<List<Guid>> GetDescendantIdsAsync(Guid ancestorId, CancellationToken ct = default)
    {
        return await _db.CategoryClosures
            .Where(x => x.AncestorId == ancestorId && x.Distance > 0)
            .Select(x => x.DescendantId)
            .ToListAsync(ct);
    }

    public async Task AddRangeAsync(IEnumerable<CategoryClosure> closures, CancellationToken ct = default)
    {
        await _db.CategoryClosures.AddRangeAsync(closures, ct);
    }
}



