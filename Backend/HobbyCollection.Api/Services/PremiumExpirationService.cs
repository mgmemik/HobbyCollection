using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Services;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Premium sonlandığında kullanıcıları bilgilendirme ve ayarları standart düzeyine çekme servisi
/// Her gün 1 kere çalışır
/// </summary>
public class PremiumExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PremiumExpirationService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromDays(1); // Her gün kontrol et

    public PremiumExpirationService(
        IServiceProvider serviceProvider,
        ILogger<PremiumExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Premium Expiration Service başlatıldı.");

        // Database initialization tamamlanana kadar bekle (30 saniye)
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        _logger.LogInformation("Premium Expiration Service aktif hale geldi.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPremiumExpirationsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Premium expiration işlemi sırasında hata oluştu.");
            }

            // Bir sonraki güne kadar bekle (her gün aynı saatte çalışsın)
            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("Premium Expiration Service durduruluyor.");
    }

    private async Task ProcessPremiumExpirationsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var entitlementService = scope.ServiceProvider.GetRequiredService<IEntitlementService>();
        var pushNotificationService = scope.ServiceProvider.GetService<PushNotificationService>();

        var now = DateTime.UtcNow;
        
        // Bugünün başlangıcı ve dünün başlangıcı
        var todayStart = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);
        var yesterdayStart = todayStart.AddDays(-1);
        var tomorrowStart = todayStart.AddDays(1);

        _logger.LogInformation("Premium expiration kontrolü başlatıldı. Şu an: {Now}, Bugün: {TodayStart} - {TomorrowStart}, Dün: {YesterdayStart} - {TodayStart}", 
            now, todayStart, tomorrowStart, yesterdayStart, todayStart);

        // 1. Premium'u BUGÜN biten kullanıcıları bul (notification gönder)
        // EndsAtUtc bugün olan expired entitlement'ları bul
        var todayExpiredEntitlements = await db.UserEntitlements
            .Where(e => e.Status == EntitlementStatus.Expired)
            .Where(e => e.EndsAtUtc != null)
            .Where(e => e.EndsAtUtc!.Value >= todayStart && e.EndsAtUtc!.Value < tomorrowStart)
            .Where(e => e.EntitlementType == EntitlementType.Premium)
            .GroupBy(e => e.UserId)
            .Select(g => g.OrderByDescending(e => e.EndsAtUtc).First())
            .ToListAsync();
        
        // Daha önce bugün notification gönderilmiş mi kontrol et
        var userIdsToNotify = todayExpiredEntitlements
            .Select(e => e.UserId)
            .ToList();
        
        var existingNotifications = await db.Notifications
            .Where(n => userIdsToNotify.Contains(n.UserId))
            .Where(n => n.Type == "premium_expired_warning")
            .Where(n => n.CreatedAt >= todayStart)
            .Select(n => n.UserId)
            .Distinct()
            .ToListAsync();
        
        var usersToNotify = todayExpiredEntitlements
            .Where(e => !existingNotifications.Contains(e.UserId))
            .ToList();

        _logger.LogInformation("Bugün premium'u biten {Count} kullanıcı bulundu (daha önce notification gönderilmemiş: {ToNotifyCount})", 
            todayExpiredEntitlements.Count, usersToNotify.Count);

        foreach (var entitlement in usersToNotify)
        {
            try
            {
                // Kullanıcının dil tercihini al
                var user = await db.Users.OfType<ApplicationUser>()
                    .FirstOrDefaultAsync(u => u.Id == entitlement.UserId);

                if (user == null) continue;

                var userLanguage = user.UiLanguage ?? "en";
                var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);

                // Notification mesajları
                var title = isTurkish 
                    ? "Premium Aboneliğiniz Sonlandı" 
                    : "Your Premium Subscription Has Ended";
                
                var message = isTurkish
                    ? "Premium aboneliğiniz sona erdi. 24 saat içinde premium'a yeniden abone olmadığınız takdirde, uygulama ve web üzerinde profil görünürlük ayarlarınız standart düzeyine çekilecek ve gösterime kapanmış ürünleriniz (varsa) standart plan kapsamında gösterilecektir."
                    : "Your premium subscription has ended. If you do not renew your premium subscription within 24 hours, your profile visibility settings on the app and web will be set to standard level, and your private products (if any) will be made visible under the standard plan.";

                // Notification oluştur
                var notification = new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = entitlement.UserId,
                    Type = "premium_expired_warning",
                    Title = title,
                    Message = message,
                    IsRead = false,
                    CreatedAt = DateTime.SpecifyKind(now, DateTimeKind.Utc),
                };

                db.Notifications.Add(notification);
                await db.SaveChangesAsync();

                // Push notification gönder
                if (pushNotificationService != null)
                {
                    try
                    {
                        var pushData = new Dictionary<string, object>
                        {
                            { "notificationId", notification.Id.ToString() },
                            { "type", "premium_expired_warning" }
                        };
                        await pushNotificationService.SendPushNotificationAsync(entitlement.UserId, title, message, pushData);
                    }
                    catch (Exception pushEx)
                    {
                        _logger.LogWarning(pushEx, "Push notification gönderilemedi. UserId: {UserId}", entitlement.UserId);
                    }
                }

                _logger.LogInformation("Premium expiration uyarısı gönderildi. UserId: {UserId}, EndedAt: {EndedAt}", 
                    entitlement.UserId, entitlement.EndsAtUtc);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kullanıcıya notification gönderilirken hata oluştu. UserId: {UserId}", entitlement.UserId);
            }
        }

        // 2. Premium'u 24 saatten fazla önce biten kullanıcıları bul (ayarları standart düzeyine çek)
        // EndsAtUtc 24 saatten fazla önce olan expired entitlement'ları bul
        // Bu şekilde daha önce job çalışmasında sorun olmuş veya gözden kaçmış kullanıcılar da yakalanır
        var expiredMoreThan24HoursAgo = await db.UserEntitlements
            .Where(e => e.Status == EntitlementStatus.Expired)
            .Where(e => e.EndsAtUtc != null)
            .Where(e => e.EndsAtUtc!.Value < yesterdayStart) // 24 saatten fazla önce bitmiş
            .Where(e => e.EntitlementType == EntitlementType.Premium)
            .GroupBy(e => e.UserId)
            .Select(g => g.OrderByDescending(e => e.EndsAtUtc).First())
            .ToListAsync();

        _logger.LogInformation("24 saatten fazla önce premium'u biten {Count} kullanıcı bulundu (ayarlar standart düzeyine çekilecek)", expiredMoreThan24HoursAgo.Count);

        foreach (var entitlement in expiredMoreThan24HoursAgo)
        {
            try
            {
                var user = await db.Users.OfType<ApplicationUser>()
                    .FirstOrDefaultAsync(u => u.Id == entitlement.UserId);

                if (user == null) continue;

                var changesMade = false;

                // Uygulama profili açık yap (IsPrivateAccount = false)
                if (user.IsPrivateAccount)
                {
                    user.IsPrivateAccount = false;
                    changesMade = true;
                    _logger.LogInformation("User {UserId}: IsPrivateAccount false yapıldı", entitlement.UserId);
                }

                // Web profili kapalı yap (IsWebProfilePublic = false)
                if (user.IsWebProfilePublic == true)
                {
                    user.IsWebProfilePublic = false;
                    changesMade = true;
                    _logger.LogInformation("User {UserId}: IsWebProfilePublic false yapıldı", entitlement.UserId);
                }

                // Tüm private product'ları public yap
                var privateProducts = await db.Products
                    .Where(p => p.UserId == entitlement.UserId)
                    .Where(p => p.IsPublic == false)
                    .ToListAsync();

                if (privateProducts.Any())
                {
                    foreach (var product in privateProducts)
                    {
                        product.IsPublic = true;
                    }
                    changesMade = true;
                    _logger.LogInformation("User {UserId}: {Count} private product public yapıldı", 
                        entitlement.UserId, privateProducts.Count);
                }

                if (changesMade)
                {
                    await db.SaveChangesAsync();
                    _logger.LogInformation("User {UserId} ayarları standart düzeyine çekildi", entitlement.UserId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kullanıcı ayarları güncellenirken hata oluştu. UserId: {UserId}", entitlement.UserId);
            }
        }

        // 3. Premium olmayan ama profil görünümü gizli olan kullanıcıları düzelt (cleanup)
        var nowForCleanup = DateTime.UtcNow;
        var activePremiumUserIds = await db.UserEntitlements
            .AsNoTracking()
            .Where(e => e.EntitlementType == EntitlementType.Premium)
            .Where(e => (e.Status == EntitlementStatus.Active || e.Status == EntitlementStatus.Grace) &&
                       (e.EndsAtUtc == null || e.EndsAtUtc > nowForCleanup))
            .Select(e => e.UserId)
            .Distinct()
            .ToListAsync();

        var standardUsersWithPrivateProfile = await db.Users.OfType<ApplicationUser>()
            .Where(u => !activePremiumUserIds.Contains(u.Id))
            .Where(u => u.IsPrivateAccount == true || u.IsWebProfilePublic == true)
            .ToListAsync();

        _logger.LogInformation("Premium olmayan ama profil görünümü gizli olan {Count} kullanıcı bulundu (cleanup)", 
            standardUsersWithPrivateProfile.Count);

        var cleanupCount = 0;
        foreach (var user in standardUsersWithPrivateProfile)
        {
            try
            {
                var changesMade = false;

                // Uygulama profili açık yap (IsPrivateAccount = false)
                if (user.IsPrivateAccount)
                {
                    user.IsPrivateAccount = false;
                    changesMade = true;
                    _logger.LogInformation("User {UserId} ({Email}): IsPrivateAccount false yapıldı (cleanup)", 
                        user.Id, user.Email);
                }

                // Web profili kapalı yap (IsWebProfilePublic = false veya null)
                if (user.IsWebProfilePublic == true)
                {
                    user.IsWebProfilePublic = false;
                    changesMade = true;
                    _logger.LogInformation("User {UserId} ({Email}): IsWebProfilePublic false yapıldı (cleanup)", 
                        user.Id, user.Email);
                }

                // Tüm private product'ları public yap
                var privateProducts = await db.Products
                    .Where(p => p.UserId == user.Id)
                    .Where(p => p.IsPublic == false)
                    .ToListAsync();

                if (privateProducts.Any())
                {
                    foreach (var product in privateProducts)
                    {
                        product.IsPublic = true;
                    }
                    changesMade = true;
                    _logger.LogInformation("User {UserId} ({Email}): {Count} private product public yapıldı (cleanup)", 
                        user.Id, user.Email, privateProducts.Count);
                }

                if (changesMade)
                {
                    await db.SaveChangesAsync();
                    cleanupCount++;
                    _logger.LogInformation("User {UserId} ({Email}) ayarları standart düzeyine çekildi (cleanup)", 
                        user.Id, user.Email);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kullanıcı cleanup sırasında hata oluştu. UserId: {UserId}, Email: {Email}", 
                    user.Id, user.Email);
            }
        }

        _logger.LogInformation("Premium expiration kontrolü tamamlandı. " +
            "Uyarı gönderilen: {WarningCount}, Ayarları güncellenen: {UpdateCount}, Cleanup yapılan: {CleanupCount}", 
            usersToNotify.Count, expiredMoreThan24HoursAgo.Count, cleanupCount);
    }
}
