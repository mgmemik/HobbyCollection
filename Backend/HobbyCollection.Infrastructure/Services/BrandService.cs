using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using HobbyCollection.Domain.Services;

namespace HobbyCollection.Infrastructure.Services;

public class BrandService : IBrandService
{
    private readonly IBrandRepository _brandRepository;
    private static List<Brand> _cachedBrands = new List<Brand>();
    private static DateTime _lastCacheRefresh = DateTime.MinValue;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1); // 1 saat cache
    private static readonly object _cacheLock = new object();

    public BrandService(IBrandRepository brandRepository)
    {
        _brandRepository = brandRepository;
    }

    private async Task EnsureBrandsCachedAsync(CancellationToken cancellationToken = default)
    {
        await Task.CompletedTask;
        // Double-check locking pattern
        if (_cachedBrands.Count == 0 || DateTime.UtcNow - _lastCacheRefresh > CacheDuration)
        {
            lock (_cacheLock)
            {
                // Tekrar kontrol et (başka thread cache'i yenilemiş olabilir)
                if (_cachedBrands.Count == 0 || DateTime.UtcNow - _lastCacheRefresh > CacheDuration)
                {
                    // Synchronous olarak cache'i yenile (async metod içinde await kullanmak deadlock'a yol açabilir)
                    var brands = _brandRepository.GetAllActiveBrandsAsync(cancellationToken).GetAwaiter().GetResult();
                    _cachedBrands = brands;
                    _lastCacheRefresh = DateTime.UtcNow;
                }
            }
        }
    }

    public async Task<string?> FindBrandInTextAsync(string text, CancellationToken cancellationToken = default)
    {
        var brands = await FindBrandsInTextAsync(text, cancellationToken);
        return brands.FirstOrDefault();
    }

    public async Task<List<string>> FindBrandsInTextAsync(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
            return new List<string>();

        await EnsureBrandsCachedAsync(cancellationToken);
        
        var foundBrands = new List<string>();
        List<Brand> allBrands;
        lock (_cacheLock)
        {
            allBrands = _cachedBrands.ToList(); // Thread-safe copy
        }

        // Text'i normalize et
        var normalizedText = text.ToUpperInvariant();

        // Her markayı kontrol et
        foreach (var brand in allBrands)
        {
            var brandName = brand.Name.ToUpperInvariant();
            var normalizedBrand = brand.NormalizedName ?? NormalizeBrandName(brand.Name);

            // Tam eşleşme veya kelime sınırlarında eşleşme
            if (normalizedText.Contains(brandName, StringComparison.OrdinalIgnoreCase) ||
                normalizedText.Contains(normalizedBrand, StringComparison.OrdinalIgnoreCase))
            {
                // Kelime sınırlarını kontrol et (tam kelime olarak geçiyor mu?)
                var words = text.Split(new[] { ' ', '-', '_', '.', ',', ';', ':', '!', '?', '\n', '\r', '\t' }, 
                    StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var word in words)
                {
                    var normalizedWord = NormalizeBrandName(word);
                    if (normalizedWord == normalizedBrand || 
                        word.Equals(brand.Name, StringComparison.OrdinalIgnoreCase))
                    {
                        if (!foundBrands.Contains(brand.Name))
                        {
                            foundBrands.Add(brand.Name);
                        }
                        break;
                    }
                }
            }
        }

        return foundBrands.OrderByDescending(b => 
        {
            // Popülerlik skoruna göre sırala (daha popüler markalar önce)
            var brand = allBrands.FirstOrDefault(br => br.Name.Equals(b, StringComparison.OrdinalIgnoreCase));
            return brand?.PopularityScore ?? 0;
        }).ToList();
    }

    public async Task<bool> IsKnownBrandAsync(string brandName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(brandName))
            return false;

        var normalized = NormalizeBrandName(brandName);
        var brand = await _brandRepository.GetByNormalizedNameAsync(normalized, cancellationToken);
        return brand != null;
    }

    public async Task<List<Brand>> GetAllBrandsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureBrandsCachedAsync(cancellationToken);
        lock (_cacheLock)
        {
            return _cachedBrands.ToList(); // Thread-safe copy
        }
    }

    private static string NormalizeBrandName(string name)
    {
        return name.ToUpperInvariant()
            .Replace(" ", "")
            .Replace("-", "")
            .Replace("_", "")
            .Replace(".", "")
            .Trim();
    }
}

