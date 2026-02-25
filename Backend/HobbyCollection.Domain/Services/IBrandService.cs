using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Services;

public interface IBrandService
{
    Task<string?> FindBrandInTextAsync(string text, CancellationToken cancellationToken = default);
    Task<List<string>> FindBrandsInTextAsync(string text, CancellationToken cancellationToken = default);
    Task<bool> IsKnownBrandAsync(string brandName, CancellationToken cancellationToken = default);
    Task<List<Brand>> GetAllBrandsAsync(CancellationToken cancellationToken = default);
}

