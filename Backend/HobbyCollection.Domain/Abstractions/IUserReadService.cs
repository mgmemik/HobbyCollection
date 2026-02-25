namespace HobbyCollection.Domain.Abstractions;

public interface IUserReadService
{
    Task<string?> GetDisplayNameAsync(string userId, CancellationToken ct = default);
    Task<bool> ExistsAsync(string userId, CancellationToken ct = default);
}



