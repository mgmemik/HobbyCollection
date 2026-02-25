using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Google Play Store subscription purchase validation ve webhook işleme servisi
/// </summary>
public interface IGoogleSubscriptionService
{
    /// <summary>
    /// Purchase token'ı validate et ve subscription bilgilerini döndür
    /// </summary>
    Task<GoogleSubscriptionValidationResult> ValidatePurchaseAsync(
        string packageName,
        string subscriptionId,
        string purchaseToken);
    
    /// <summary>
    /// Pub/Sub webhook notification'ını işle
    /// </summary>
    Task ProcessPubSubMessageAsync(GooglePubSubMessage message);
}

public class GoogleSubscriptionService : IGoogleSubscriptionService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleSubscriptionService> _logger;
    private readonly AppDbContext _db;
    private readonly IEntitlementService _entitlementService;

    // Google Play Developer API v3 endpoint
    private const string BaseApiUrl = "https://androidpublisher.googleapis.com/androidpublisher/v3";

    public GoogleSubscriptionService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<GoogleSubscriptionService> logger,
        AppDbContext db,
        IEntitlementService entitlementService)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        _db = db;
        _entitlementService = entitlementService;
    }

    public async Task<GoogleSubscriptionValidationResult> ValidatePurchaseAsync(
        string packageName,
        string subscriptionId,
        string purchaseToken)
    {
        await Task.CompletedTask;
        // Google Play API için service account key gerekli
        // Şimdilik placeholder - tam implementasyon service account key ile yapılacak
        var serviceAccountKeyPath = _configuration["GooglePlay:ServiceAccountKeyPath"];
        
        if (string.IsNullOrEmpty(serviceAccountKeyPath))
        {
            _logger.LogWarning("Google Play Service Account Key not configured");
            throw new InvalidOperationException("Google Play Service Account Key not configured");
        }

        // Google Play API v3 kullanarak subscription bilgilerini al
        // Bu kısım Google.Apis.AndroidPublisher.v3 NuGet package ile yapılacak
        // Şimdilik placeholder response döndürüyoruz
        
        _logger.LogInformation("Validating Google Play purchase: Package={PackageName}, Subscription={SubscriptionId}, Token={Token}",
            packageName, subscriptionId, purchaseToken);

        // TODO: Google Play API entegrasyonu
        // purchases.subscriptions.get endpoint'ini çağır
        
        return new GoogleSubscriptionValidationResult
        {
            IsValid = false,
            ErrorMessage = "Google Play API integration not yet implemented"
        };
    }

    public async Task ProcessPubSubMessageAsync(GooglePubSubMessage message)
    {
        // Idempotency kontrolü
        if (string.IsNullOrEmpty(message.MessageId))
        {
            _logger.LogWarning("Google Play Pub/Sub message missing MessageId");
            return;
        }

        var existingEvent = await _db.EntitlementEvents
            .FirstOrDefaultAsync(e => e.ExternalEventId == message.MessageId);

        if (existingEvent != null)
        {
            _logger.LogInformation("Google Play webhook event already processed: {MessageId}", message.MessageId);
            return;
        }

        // Pub/Sub message'dan notification'ı decode et
        GooglePlayNotification? notificationData = null;
        try
        {
            // Data base64 encoded olabilir
            if (!string.IsNullOrEmpty(message.Data))
            {
                var decodedData = System.Text.Encoding.UTF8.GetString(
                    Convert.FromBase64String(message.Data));
                notificationData = JsonSerializer.Deserialize<GooglePlayNotification>(decodedData);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to decode Google Play Pub/Sub message data");
        }

        if (notificationData == null)
        {
            _logger.LogWarning("Invalid Google Play Pub/Sub message");
            return;
        }

        var notificationType = notificationData.NotificationType;
        var purchaseToken = notificationData.PurchaseToken;
        var subscriptionId = notificationData.SubscriptionId;

        if (string.IsNullOrEmpty(notificationType) || string.IsNullOrEmpty(purchaseToken))
        {
            _logger.LogWarning("Google Play notification missing required fields");
            return;
        }

        _logger.LogInformation("Processing Google Play webhook notification: {NotificationType}, Token: {Token}",
            notificationType, purchaseToken);

        // Bu purchase token'a sahip entitlement'ı bul
        var entitlement = await _db.UserEntitlements
            .FirstOrDefaultAsync(e =>
                e.Source == EntitlementSource.PlayStore &&
                e.ExternalSubscriptionId == purchaseToken);

        if (entitlement == null)
        {
            _logger.LogWarning("Entitlement not found for Google Play purchase token: {Token}", purchaseToken);
            return;
        }

        var now = DateTime.UtcNow;

        // Notification type'a göre işlem yap
        switch (notificationType)
        {
            case "1": // SUBSCRIPTION_RECOVERED - Subscription recovered from account hold
            case "2": // SUBSCRIPTION_RENEWED - Subscription renewed
                // Yenileme
                entitlement.Status = EntitlementStatus.Active;
                entitlement.AutoRenews = true;
                entitlement.CancelAtPeriodEnd = false;
                entitlement.CancelledAtUtc = null;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Renewed, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription renewed for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "3": // SUBSCRIPTION_CANCELED - Subscription canceled
                // İptal edildi (period sonunda bitecek)
                entitlement.CancelAtPeriodEnd = true;
                entitlement.CancelledAtUtc = now;
                entitlement.AutoRenews = false;
                entitlement.Status = EntitlementStatus.Cancelled;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Cancelled, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription cancelled for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "4": // SUBSCRIPTION_PURCHASED - New subscription purchased
                // Yeni satın alma
                entitlement.Status = EntitlementStatus.Active;
                entitlement.AutoRenews = true;
                entitlement.CancelAtPeriodEnd = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Created, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription purchased for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "5": // SUBSCRIPTION_ON_HOLD - Subscription entered account hold
                // Hesap askıya alındı (grace period)
                entitlement.Status = EntitlementStatus.Active; // Grace period'da hala aktif
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.EnteredGrace, now,
                    $"Google Play webhook: {notificationType} - Account hold", message.MessageId);

                _logger.LogWarning("Google Play subscription on hold for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "6": // SUBSCRIPTION_IN_GRACE_PERIOD - Subscription entered grace period
                // Grace period'a girdi
                entitlement.Status = EntitlementStatus.Active; // Grace period'da hala aktif
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.EnteredGrace, now,
                    $"Google Play webhook: {notificationType} - Grace period", message.MessageId);

                _logger.LogWarning("Google Play subscription in grace period for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "7": // SUBSCRIPTION_RESTARTED - Subscription restarted
                // Yeniden başlatıldı
                entitlement.Status = EntitlementStatus.Active;
                entitlement.AutoRenews = true;
                entitlement.CancelAtPeriodEnd = false;
                entitlement.CancelledAtUtc = null;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Renewed, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription restarted for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "8": // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED - User confirmed price change
                // Fiyat değişikliği onaylandı
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Extended, now,
                    $"Google Play webhook: {notificationType} - Price change confirmed", message.MessageId);

                _logger.LogInformation("Google Play subscription price change confirmed for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "9": // SUBSCRIPTION_DEFERRED - Subscription deferred
                // Ertelendi
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Renewed, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription deferred for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "10": // SUBSCRIPTION_PAUSED - Subscription paused
                // Duraklatıldı
                entitlement.Status = EntitlementStatus.Active; // Paused durumunda hala aktif
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Renewed, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription paused for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "11": // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED - Pause schedule changed
                // Duraklatma planı değişti
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Renewed, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogInformation("Google Play subscription pause schedule changed for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "12": // SUBSCRIPTION_REVOKED - Subscription revoked (refund)
                // İade edildi - premium'u iptal et
                entitlement.Status = EntitlementStatus.Revoked;
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                // Premium'u revoke et
                await _entitlementService.RevokePremiumAsync(entitlement.UserId, null,
                    $"Google Play webhook: {notificationType}");

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Revoked, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                _logger.LogWarning("Google Play subscription revoked for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "13": // SUBSCRIPTION_EXPIRED - Subscription expired
                // Süresi doldu
                entitlement.Status = EntitlementStatus.Expired;
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Expired, now,
                    $"Google Play webhook: {notificationType}", message.MessageId);

                // Plan değişimini tetikle (Premium -> Standard)
                var wasPremium = await _entitlementService.IsPremiumAsync(entitlement.UserId);
                await _entitlementService.OnPlanChangedAsync(entitlement.UserId, wasPremium, false);

                _logger.LogInformation("Google Play subscription expired for entitlement {EntitlementId}", entitlement.Id);
                break;

            default:
                _logger.LogInformation("Unhandled Google Play notification type: {NotificationType}", notificationType);
                break;
        }

        await _db.SaveChangesAsync();
    }

    private async Task AddEntitlementEventAsync(Guid entitlementId, EntitlementEventType eventType, DateTime eventTime, string notes, string? externalEventId = null)
    {
        var evt = new EntitlementEvent
        {
            Id = Guid.NewGuid(),
            EntitlementId = entitlementId,
            EventType = eventType,
            EventTimeUtc = eventTime,
            ProcessedAtUtc = DateTime.UtcNow,
            ExternalEventId = externalEventId,
            Notes = notes,
        };
        _db.EntitlementEvents.Add(evt);
        await Task.CompletedTask;
    }
}

// Google Play API Response Models
public class GoogleSubscriptionValidationResult
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public string? PurchaseToken { get; set; }
    public string? ProductId { get; set; }
    public DateTime? ExpiryTime { get; set; }
    public DateTime? StartTime { get; set; }
    public bool AutoRenewing { get; set; }
    public int? PaymentState { get; set; }
    public DateTime? CancelTime { get; set; }
    public string? CancelReason { get; set; }
    public DateTime? GracePeriodEndTime { get; set; }
}

public class GooglePubSubMessage
{
    public string? MessageId { get; set; }
    public string? Data { get; set; }
    public Dictionary<string, string>? Attributes { get; set; }
}

public class GooglePlayNotification
{
    public string? Version { get; set; }
    public string? NotificationType { get; set; }
    public string? PurchaseToken { get; set; }
    public string? SubscriptionId { get; set; }
}
