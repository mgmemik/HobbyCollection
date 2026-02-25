using HobbyCollection.Domain.Services;
using HobbyCollection.Domain.Repositories;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Aylık AI kredi yüklemesi için background service
/// Her gün saat 00:00'da (UTC) çalışır ve kredi yüklemesi gereken kullanıcıları kontrol eder
/// </summary>
public class AICreditBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AICreditBackgroundService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1); // Her saat kontrol et

    public AICreditBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<AICreditBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AI Credit Background Service başlatıldı.");
        
        // Database initialization tamamlanana kadar bekle (30 saniye)
        _logger.LogInformation("Veritabanı initialization için 30 saniye bekleniyor...");
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        
        _logger.LogInformation("AI Credit Background Service aktif hale geldi.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessMonthlyRechargesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Aylık kredi yüklemesi sırasında hata oluştu.");
            }
            
            try
            {
                await ProcessExpiredEntitlementsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Süresi dolan entitlement kontrolü sırasında hata oluştu.");
            }

            // Bir sonraki kontrole kadar bekle
            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("AI Credit Background Service durduruluyor.");
    }

    private async Task ProcessMonthlyRechargesAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var creditService = scope.ServiceProvider.GetRequiredService<IAICreditService>();
        var creditRepo = scope.ServiceProvider.GetRequiredService<IAICreditRepository>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var entitlementService = scope.ServiceProvider.GetRequiredService<IEntitlementService>();

        try
        {
            _logger.LogInformation("Aylık kredi yüklemesi kontrolü başlatılıyor...");
            var usersNeedingRecharge = await creditRepo.GetUsersNeedingRechargeAsync();
            _logger.LogInformation("Aylık kredi yüklemesi için {Count} kullanıcı bulundu.", usersNeedingRecharge.Count);

            foreach (var userCredit in usersNeedingRecharge)
            {
                try
                {
                    var isPremium = await entitlementService.IsPremiumAsync(userCredit.UserId);
                    var newPlanType = isPremium ? "premium" : "standard";
                    var monthlyCredits = isPremium ? 300 : 50;
                    var planName = isPremium ? "Premium" : "Standard";

                    var tx = await creditService.RechargeMonthlyCreditsResetAsync(userCredit.UserId, monthlyCredits, newPlanType);

                    var notificationPayload = await CreateRechargeNotificationPayloadAsync(
                        userCredit.UserId,
                        monthlyCredits,
                        tx.BalanceAfter,
                        planName,
                        userCredit.BonusBalance,
                        userCredit.LastPlanType != newPlanType,
                        userCredit.LastPlanType
                    );

                    await notificationService.NotifyAsync(
                        NotificationEventType.AICreditCharged,
                        notificationPayload
                    );

                    _logger.LogInformation(
                        "Kullanıcı {UserId} için aylık kredi yenilendi ({Plan}). Bakiye: {NewBalance} (önceki dönem puanları sıfırlandı).",
                        userCredit.UserId, planName, tx.BalanceAfter);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Kullanıcı {UserId} için aylık kredi yüklemesi başarısız oldu.", userCredit.UserId);
                }
            }
            _logger.LogInformation("Aylık kredi yüklemesi kontrolü tamamlandı.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Aylık kredi yüklemesi işlemi başarısız oldu.");
        }
    }
    
    /// <summary>
    /// Aylık yenileme için bildirim payload'u oluştur (dil desteğiyle)
    /// </summary>
    private async Task<NotificationPayload> CreateRechargeNotificationPayloadAsync(
        string userId,
        int addedCredits,
        int newBalance,
        string planName,
        int bonusBalance,
        bool planChanged,
        string oldPlanType)
    {
        // Kullanıcının dil tercihini al
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.OfType<ApplicationUser>()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        var userLanguage = user?.UiLanguage ?? "en";
        var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
        
        var title = isTurkish ? "💰 AI Kredileri Yenilendi" : "💰 AI Credits Recharged";
        string message;
        
        if (planChanged)
        {
            message = isTurkish
                ? $"Planınız {planName} planına değişti! {addedCredits} kredi eklendi. Toplam: {newBalance} kredi."
                : $"Your plan changed to {planName}! {addedCredits} credits added. Total: {newBalance} credits.";
        }
        else
        {
            message = isTurkish
                ? $"+{addedCredits} kredi eklendi ({planName}). Toplam: {newBalance} kredi."
                : $"+{addedCredits} credits added ({planName}). Total: {newBalance} credits.";
        }
        
        if (bonusBalance > 0)
        {
            message += isTurkish
                ? $" ({bonusBalance} bonus kredi dahil)"
                : $" (Including {bonusBalance} bonus credits)";
        }
        
        return new NotificationPayload(
            RecipientUserId: userId,
            Title: title,
            Message: message
        );
    }
    
    /// <summary>
    /// Süresi dolan entitlement'ları kontrol et (saatte bir)
    /// </summary>
    private async Task ProcessExpiredEntitlementsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var entitlementService = scope.ServiceProvider.GetRequiredService<IEntitlementService>();
        
        try
        {
            await entitlementService.ProcessExpiredEntitlementsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Süresi dolan entitlement'ları işlerken hata oluştu.");
        }
    }
}

