using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Repositories;

public interface IBrandRepository
{
    Task<Brand?> GetByNameAsync(string name, CancellationToken cancellationToken = default);
    Task<Brand?> GetByNormalizedNameAsync(string normalizedName, CancellationToken cancellationToken = default);
    Task<List<Brand>> GetAllActiveBrandsAsync(CancellationToken cancellationToken = default);
    Task<List<Brand>> SearchBrandsAsync(string searchTerm, CancellationToken cancellationToken = default);
    Task<Brand> AddAsync(Brand brand, CancellationToken cancellationToken = default);
    Task UpdateAsync(Brand brand, CancellationToken cancellationToken = default);
}

