using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Repositories;

public interface ICategoryClosureRepository
{
    Task<List<Guid>> GetDescendantIdsAsync(Guid ancestorId, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<CategoryClosure> closures, CancellationToken ct = default);
}



