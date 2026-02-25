using HobbyCollection.Domain.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Infrastructure.Services;

public sealed class UserReadService : IUserReadService
{
    private readonly AppDbContext _db;
    public UserReadService(AppDbContext db) { _db = db; }

    public async Task<bool> ExistsAsync(string userId, CancellationToken ct = default)
    {
        return await _db.Users.AnyAsync(u => u.Id == userId, ct);
    }

    public async Task<string?> GetDisplayNameAsync(string userId, CancellationToken ct = default)
    {
        // DisplayName kaldırıldı - artık UserName döndürüyor
        return await _db.Users
            .Where(u => u.Id == userId)
            .Select(u => (u as ApplicationUser)!.UserName)
            .FirstOrDefaultAsync(ct);
    }
}



