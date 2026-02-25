using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Infrastructure.Repositories;

public class BrandRepository : IBrandRepository
{
    private readonly AppDbContext _context;

    public BrandRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Brand?> GetByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        return await _context.Brands
            .FirstOrDefaultAsync(b => b.Name.Equals(name, StringComparison.OrdinalIgnoreCase) && b.IsActive, cancellationToken);
    }

    public async Task<Brand?> GetByNormalizedNameAsync(string normalizedName, CancellationToken cancellationToken = default)
    {
        return await _context.Brands
            .FirstOrDefaultAsync(b => b.NormalizedName != null && 
                b.NormalizedName.Equals(normalizedName, StringComparison.OrdinalIgnoreCase) && 
                b.IsActive, cancellationToken);
    }

    public async Task<List<Brand>> GetAllActiveBrandsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Brands
            .Where(b => b.IsActive)
            .OrderByDescending(b => b.PopularityScore)
            .ThenBy(b => b.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<Brand>> SearchBrandsAsync(string searchTerm, CancellationToken cancellationToken = default)
    {
        var normalizedSearch = NormalizeBrandName(searchTerm);
        return await _context.Brands
            .Where(b => b.IsActive && (
                b.Name.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                (b.NormalizedName != null && b.NormalizedName.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase))
            ))
            .OrderByDescending(b => b.PopularityScore)
            .ThenBy(b => b.Name)
            .Take(50)
            .ToListAsync(cancellationToken);
    }

    public async Task<Brand> AddAsync(Brand brand, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(brand.NormalizedName))
        {
            brand.NormalizedName = NormalizeBrandName(brand.Name);
        }
        
        brand.CreatedAtUtc = DateTime.UtcNow;
        _context.Brands.Add(brand);
        await _context.SaveChangesAsync(cancellationToken);
        return brand;
    }

    public async Task UpdateAsync(Brand brand, CancellationToken cancellationToken = default)
    {
        brand.UpdatedAtUtc = DateTime.UtcNow;
        _context.Brands.Update(brand);
        await _context.SaveChangesAsync(cancellationToken);
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

