using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Onaylanmamış kullanıcıları temizleme background service
/// Her 24 saatte bir çalışır ve 24 saatten eski onaylanmamış (EmailConfirmed = false) kullanıcıları siler
/// </summary>
public class UnverifiedUserCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<UnverifiedUserCleanupService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(24); // Her 24 saatte bir çalış

    public UnverifiedUserCleanupService(
        IServiceProvider serviceProvider,
        ILogger<UnverifiedUserCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Unverified User Cleanup Service başlatıldı.");
        
        // Database initialization tamamlanana kadar bekle (30 saniye)
        _logger.LogInformation("Veritabanı initialization için 30 saniye bekleniyor...");
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        
        _logger.LogInformation("Unverified User Cleanup Service aktif hale geldi.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupUnverifiedUsersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Onaylanmamış kullanıcı temizleme sırasında hata oluştu.");
            }

            // Bir sonraki kontrole kadar bekle (24 saat)
            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("Unverified User Cleanup Service durduruluyor.");
    }

    private async Task CleanupUnverifiedUsersAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        try
        {
            _logger.LogInformation("Onaylanmamış kullanıcı temizleme kontrolü başlatılıyor...");
            
            // 24 saatten eski tarih (son 24 saate dokunmayacağız)
            var cutoffDate = DateTime.UtcNow.AddHours(-24);
            
            // EmailConfirmed = false ve CreatedAt < cutoffDate olan kullanıcıları bul
            // Son 24 saate dokunmayacağız (cutoffDate = şu an - 24 saat)
            var usersToDelete = await db.Users
                .OfType<ApplicationUser>()
                .Where(u => !u.EmailConfirmed && u.CreatedAt < cutoffDate)
                .ToListAsync();

            _logger.LogInformation("24 saatten eski {Count} onaylanmamış kullanıcı bulundu.", usersToDelete.Count);

            int deletedCount = 0;

            foreach (var user in usersToDelete)
            {
                try
                {
                    _logger.LogInformation(
                        "Onaylanmamış kullanıcı siliniyor: {Email}, UserId: {UserId}, CreatedAt: {CreatedAt}",
                        user.Email, user.Id, user.CreatedAt);

                    // UserManager ile kullanıcıyı sil (ilişkili veriler de silinir)
                    var result = await userManager.DeleteAsync(user);
                    
                    if (result.Succeeded)
                    {
                        deletedCount++;
                        _logger.LogInformation(
                            "Onaylanmamış kullanıcı başarıyla silindi: {Email}, UserId: {UserId}",
                            user.Email, user.Id);
                    }
                    else
                    {
                        _logger.LogError(
                            "Onaylanmamış kullanıcı silinirken hata oluştu: {Email}, UserId: {UserId}, Errors: {Errors}",
                            user.Email, user.Id, string.Join(", ", result.Errors.Select(e => e.Description)));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Onaylanmamış kullanıcı silinirken exception oluştu: {Email}, UserId: {UserId}",
                        user.Email, user.Id);
                }
            }

            _logger.LogInformation(
                "Onaylanmamış kullanıcı temizleme kontrolü tamamlandı. {DeletedCount}/{TotalCount} kullanıcı silindi.",
                deletedCount, usersToDelete.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Onaylanmamış kullanıcı temizleme işlemi başarısız oldu.");
        }
    }
}
