using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using HobbyCollection.Domain.Services;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Entitlement (premium abonelik) yönetim servisi implementasyonu
/// </summary>
public class EntitlementService : IEntitlementService
{
    private readonly AppDbContext _db;
    private readonly ILogger<EntitlementService> _logger;
    private readonly IAICreditService _aiCreditService;
    private readonly INotificationService _notificationService;
    
    // Premium kullanıcılar için tüm özellikler
    private static readonly PremiumFeature[] AllPremiumFeatures = 
    {
        PremiumFeature.CsvExport,
        PremiumFeature.ProductBadges,
        PremiumFeature.PrivateProducts,
        PremiumFeature.Showcase,
        PremiumFeature.CollectionReport,
        PremiumFeature.PremiumAICredits,
    };
    
    public EntitlementService(AppDbContext db, ILogger<EntitlementService> logger, IAICreditService aiCreditService, INotificationService notificationService)
    {
        _db = db;
        _logger = logger;
        _aiCreditService = aiCreditService;
        _notificationService = notificationService;
    }
    
    /// <inheritdoc />
    public async Task<UserPlan> GetEffectivePlanAsync(string userId)
    {
        var hasActivePremium = await HasActiveEntitlementAsync(userId);
        return hasActivePremium ? UserPlan.Premium : UserPlan.Standard;
    }
    
    /// <inheritdoc />
    public async Task<bool> IsPremiumAsync(string userId)
    {
        return await HasActiveEntitlementAsync(userId);
    }
    
    /// <inheritdoc />
    public async Task<bool> HasFeatureAsync(string userId, PremiumFeature feature)
    {
        // Tüm premium özellikler premium kullanıcılara açık
        return await IsPremiumAsync(userId);
    }
    
    /// <inheritdoc />
    public async Task<UserEntitlement> GrantPremiumAsync(GrantPremiumRequest request)
    {
        var now = DateTime.UtcNow;
        var wasPremium = await IsPremiumAsync(request.UserId);
        
        // Mevcut aktif entitlement var mı kontrol et
        var existingActive = await GetActiveEntitlementAsync(request.UserId);
        if (existingActive != null)
        {
            // Mevcut aktif varsa, onu uzat
            if (request.Duration.HasValue)
            {
                var newEnd = existingActive.EndsAtUtc.HasValue 
                    ? existingActive.EndsAtUtc.Value.Add(request.Duration.Value)
                    : now.Add(request.Duration.Value);
                    
                existingActive.EndsAtUtc = newEnd;
                existingActive.UpdatedAtUtc = now;
                existingActive.Notes = string.IsNullOrEmpty(existingActive.Notes) 
                    ? request.Notes 
                    : $"{existingActive.Notes}\n---\n{request.Notes}";
                
                // Event kaydet
                await AddEventAsync(existingActive.Id, EntitlementEventType.Extended, now, 
                    request.GrantedByUserId, $"Süre uzatıldı: +{request.Duration.Value.TotalDays} gün. {request.Notes}");
                
                await _db.SaveChangesAsync();
                
                _logger.LogInformation("Extended premium for user {UserId} until {EndsAt}", 
                    request.UserId, existingActive.EndsAtUtc);
                
                // Premium uzatma durumunda da kredileri 300'e tamamla
                await OnPlanChangedAsync(request.UserId, wasPremium, true);
                
                return existingActive;
            }
            else
            {
                // Süresiz yapılıyor
                existingActive.EndsAtUtc = null;
                existingActive.UpdatedAtUtc = now;
                existingActive.Notes = string.IsNullOrEmpty(existingActive.Notes) 
                    ? request.Notes 
                    : $"{existingActive.Notes}\n---\n{request.Notes}";
                
                await AddEventAsync(existingActive.Id, EntitlementEventType.Extended, now, 
                    request.GrantedByUserId, $"Lifetime yapıldı. {request.Notes}");
                
                await _db.SaveChangesAsync();
                
                _logger.LogInformation("Made premium lifetime for user {UserId}", request.UserId);
                
                // Premium uzatma durumunda da kredileri 300'e tamamla
                await OnPlanChangedAsync(request.UserId, wasPremium, true);
                
                return existingActive;
            }
        }
        
        // Yeni entitlement oluştur
        var entitlement = new UserEntitlement
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            EntitlementType = EntitlementType.Premium,
            Source = request.Source,
            Status = EntitlementStatus.Active,
            StartsAtUtc = now,
            EndsAtUtc = request.Duration.HasValue ? now.Add(request.Duration.Value) : null,
            AutoRenews = false, // Admin grant ve promo için otomatik yenileme yok
            GrantedByUserId = request.GrantedByUserId,
            PromoCodeId = request.PromoCodeId,
            Notes = request.Notes,
            CreatedAtUtc = now,
        };
        
        _db.UserEntitlements.Add(entitlement);
        
        // Event kaydet
        var entitlementEvent = new EntitlementEvent
        {
            Id = Guid.NewGuid(),
            EntitlementId = entitlement.Id,
            EventType = EntitlementEventType.Created,
            EventTimeUtc = now,
            ProcessedAtUtc = now,
            ProcessedByUserId = request.GrantedByUserId,
            Notes = $"Premium grant: Source={request.Source}, Duration={request.Duration?.TotalDays} days. {request.Notes}",
        };
        
        _db.EntitlementEvents.Add(entitlementEvent);
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Granted premium to user {UserId} from {Source} until {EndsAt}", 
            request.UserId, request.Source, entitlement.EndsAtUtc?.ToString() ?? "lifetime");
        
        // Plan değişim event'ini tetikle (AI kredi güncellemesi için)
        var isPremium = await IsPremiumAsync(request.UserId);
        await OnPlanChangedAsync(request.UserId, wasPremium, isPremium);
        
        return entitlement;
    }
    
    /// <inheritdoc />
    public async Task RevokePremiumAsync(string userId, string? revokedByUserId = null, string? reason = null)
    {
        var wasPremium = await IsPremiumAsync(userId);
        var entitlement = await GetActiveEntitlementAsync(userId);
        if (entitlement == null)
        {
            _logger.LogWarning("Attempted to revoke premium for user {UserId} but no active entitlement found", userId);
            return;
        }
        
        var now = DateTime.UtcNow;
        entitlement.Status = EntitlementStatus.Cancelled;
        entitlement.CancelledAtUtc = now;
        entitlement.UpdatedAtUtc = now;
        
        await AddEventAsync(entitlement.Id, EntitlementEventType.Revoked, now, 
            revokedByUserId, reason ?? "Manuel iptal");
        
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Revoked premium for user {UserId} by {RevokedBy}. Reason: {Reason}", 
            userId, revokedByUserId ?? "system", reason);
        
        // Plan değişim event'ini tetikle
        var isPremium = await IsPremiumAsync(userId);
        await OnPlanChangedAsync(userId, wasPremium, isPremium);
    }
    
    /// <inheritdoc />
    public async Task ExtendPremiumAsync(string userId, TimeSpan duration, string? extendedByUserId = null, string? reason = null)
    {
        var entitlement = await GetActiveEntitlementAsync(userId);
        if (entitlement == null)
        {
            // Aktif entitlement yoksa yeni oluştur
            await GrantPremiumAsync(new GrantPremiumRequest
            {
                UserId = userId,
                Duration = duration,
                Source = EntitlementSource.AdminGrant,
                GrantedByUserId = extendedByUserId,
                Notes = reason,
            });
            return;
        }
        
        var now = DateTime.UtcNow;
        var baseDate = entitlement.EndsAtUtc ?? now;
        entitlement.EndsAtUtc = baseDate.Add(duration);
        entitlement.UpdatedAtUtc = now;
        
        await AddEventAsync(entitlement.Id, EntitlementEventType.Extended, now, 
            extendedByUserId, $"+{duration.TotalDays} gün. {reason}");
        
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Extended premium for user {UserId} by {Duration} days. New end: {EndsAt}", 
            userId, duration.TotalDays, entitlement.EndsAtUtc);
    }
    
    /// <inheritdoc />
    public async Task<PlanDetails?> GetPlanDetailsAsync(string userId)
    {
        var entitlement = await GetActiveEntitlementAsync(userId);
        
        if (entitlement == null)
        {
            // Standard plan
            return new PlanDetails
            {
                Plan = UserPlan.Standard,
                IsPremium = false,
                Features = new List<string>(), // Standard'da özel özellik yok
            };
        }
        
        var now = DateTime.UtcNow;
        int? daysRemaining = entitlement.EndsAtUtc.HasValue 
            ? (int)Math.Ceiling((entitlement.EndsAtUtc.Value - now).TotalDays)
            : null;
        
        return new PlanDetails
        {
            Plan = UserPlan.Premium,
            IsPremium = true,
            Source = entitlement.Source,
            StartsAtUtc = entitlement.StartsAtUtc,
            EndsAtUtc = entitlement.EndsAtUtc,
            AutoRenews = entitlement.AutoRenews,
            CancelAtPeriodEnd = entitlement.CancelAtPeriodEnd,
            DaysRemaining = daysRemaining,
            Features = AllPremiumFeatures.Select(f => f.ToString()).ToList(),
        };
    }
    
    /// <inheritdoc />
    public async Task<UserEntitlement?> GetActiveEntitlementAsync(string userId)
    {
        var now = DateTime.UtcNow;
        
        return await _db.UserEntitlements
            .Where(e => e.UserId == userId)
            .Where(e => e.EntitlementType == EntitlementType.Premium)
            .Where(e => e.Status == EntitlementStatus.Active || e.Status == EntitlementStatus.Grace)
            .Where(e => e.EndsAtUtc == null || e.EndsAtUtc > now)
            .OrderByDescending(e => e.CreatedAtUtc)
            .FirstOrDefaultAsync();
    }
    
    /// <inheritdoc />
    public async Task ProcessExpiredEntitlementsAsync()
    {
        var now = DateTime.UtcNow;
        
        var expiredEntitlements = await _db.UserEntitlements
            .Where(e => e.Status == EntitlementStatus.Active)
            .Where(e => e.EndsAtUtc != null && e.EndsAtUtc <= now)
            .ToListAsync();
        
        foreach (var entitlement in expiredEntitlements)
        {
            entitlement.Status = EntitlementStatus.Expired;
            entitlement.UpdatedAtUtc = now;
            
            await AddEventAsync(entitlement.Id, EntitlementEventType.Expired, now, 
                null, "Süre doldu - otomatik expire");
            
            _logger.LogInformation("Expired premium for user {UserId}. End date was {EndsAt}", 
                entitlement.UserId, entitlement.EndsAtUtc);
        }
        
        if (expiredEntitlements.Any())
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Processed {Count} expired entitlements", expiredEntitlements.Count);
        }
    }
    
    // Helper: Aktif premium kontrolü (cache-friendly)
    private async Task<bool> HasActiveEntitlementAsync(string userId)
    {
        var now = DateTime.UtcNow;
        
        return await _db.UserEntitlements
            .AnyAsync(e => 
                e.UserId == userId && 
                e.EntitlementType == EntitlementType.Premium &&
                (e.Status == EntitlementStatus.Active || e.Status == EntitlementStatus.Grace) &&
                (e.EndsAtUtc == null || e.EndsAtUtc > now));
    }
    
    // Helper: Event kaydet
    private async Task AddEventAsync(Guid entitlementId, EntitlementEventType eventType, 
        DateTime eventTime, string? processedByUserId, string? notes)
    {
        var evt = new EntitlementEvent
        {
            Id = Guid.NewGuid(),
            EntitlementId = entitlementId,
            EventType = eventType,
            EventTimeUtc = eventTime,
            ProcessedAtUtc = DateTime.UtcNow,
            ProcessedByUserId = processedByUserId,
            Notes = notes,
        };
        
        _db.EntitlementEvents.Add(evt);
        await Task.CompletedTask;
    }
    
    /// <inheritdoc />
    public async Task OnPlanChangedAsync(string userId, bool wasPremium, bool isPremium)
    {
        if (!wasPremium && isPremium)
        {
            _logger.LogInformation("User {UserId} upgraded to Premium. Applying full monthly credits (300), next recharge in 1 month.", userId);
            var tx = await _aiCreditService.ApplyPlanUpgradeAsync(userId, 300, "Premium Upgrade - Aylık kredi (1 ay geçerli)");

            var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
            try
            {
                var userLanguage = user?.UiLanguage ?? "en";
                var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
                var title = isTurkish ? "Premium'a hoş geldiniz! 🎉" : "Welcome to Premium! 🎉";
                var message = isTurkish
                    ? $"Premium üyeliğiniz aktif. AI kredileriniz bu ay için {tx.BalanceAfter} olarak yenilendi. Sonraki yenileme: 1 ay sonra."
                    : $"Your premium membership is active. Your AI credits have been set to {tx.BalanceAfter} for this period. Next recharge in 1 month.";
                await _notificationService.NotifyAsync(
                    NotificationEventType.AICreditCharged,
                    new NotificationPayload(RecipientUserId: userId, Title: title, Message: message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send premium purchase notification to user {UserId}", userId);
            }

            if (user != null && user.IsWebProfilePublic != true)
            {
                user.IsWebProfilePublic = true;
                await _db.SaveChangesAsync();
                _logger.LogInformation("Auto-enabled web profile for premium user {UserId}", userId);
            }
        }
        else if (wasPremium && isPremium)
        {
            _logger.LogInformation("User {UserId} premium extended. Resetting credits to 300, next recharge in 1 month.", userId);
            await _aiCreditService.ApplyPlanUpgradeAsync(userId, 300, "Premium Extension - Aylık kredi yenilendi");
        }
        else
        {
            _logger.LogInformation("User {UserId} downgraded to Standard. Balance unchanged until next recharge date; then reset to Standard allowance.", userId);
            var user = await _db.Users.FindAsync(userId);
            if (user != null && user.IsWebProfilePublic == true)
            {
                var activeEntitlement = await GetActiveEntitlementAsync(userId);
                if (activeEntitlement == null)
                {
                    user.IsWebProfilePublic = false;
                    await _db.SaveChangesAsync();
                    _logger.LogInformation("Auto-disabled web profile for standard user {UserId}", userId);
                }
            }
        }
    }
}
