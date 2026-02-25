using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Apple App Store subscription receipt validation ve webhook işleme servisi
/// </summary>
public interface IAppleSubscriptionService
{
    /// <summary>
    /// Receipt'i validate et ve subscription bilgilerini döndür
    /// </summary>
    Task<AppleReceiptValidationResult> ValidateReceiptAsync(string receiptData, bool isSandbox = false);
    
    /// <summary>
    /// Webhook notification'ını işle
    /// </summary>
    Task ProcessWebhookAsync(AppleNotificationPayload payload);
}

public class AppleSubscriptionService : IAppleSubscriptionService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AppleSubscriptionService> _logger;
    private readonly AppDbContext _db;
    private readonly IEntitlementService _entitlementService;

    private const string ProductionVerifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
    private const string SandboxVerifyUrl = "https://sandbox.itunes.apple.com/verifyReceipt";

    public AppleSubscriptionService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<AppleSubscriptionService> logger,
        AppDbContext db,
        IEntitlementService entitlementService)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        _db = db;
        _entitlementService = entitlementService;
    }

    public async Task<AppleReceiptValidationResult> ValidateReceiptAsync(string receiptData, bool isSandbox = false)
    {
        var sharedSecret = _configuration["AppStore:SharedSecret"];
        if (string.IsNullOrEmpty(sharedSecret))
        {
            _logger.LogWarning("App Store Shared Secret not configured");
            throw new InvalidOperationException("App Store Shared Secret not configured");
        }

        var verifyUrl = isSandbox ? SandboxVerifyUrl : ProductionVerifyUrl;
        var httpClient = _httpClientFactory.CreateClient();

        var requestBody = new
        {
            receipt_data = receiptData,
            password = sharedSecret,
            exclude_old_transactions = true
        };

        try
        {
            var response = await httpClient.PostAsJsonAsync(verifyUrl, requestBody);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync();
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
            var result = JsonSerializer.Deserialize<AppleReceiptResponse>(responseContent, jsonOptions);

            if (result == null)
            {
                throw new InvalidOperationException("Invalid response from Apple");
            }

            // Status 21007 = Sandbox receipt sent to production, retry with sandbox
            if (result.Status == 21007 && !isSandbox)
            {
                _logger.LogInformation("Receipt is from sandbox, retrying with sandbox URL");
                return await ValidateReceiptAsync(receiptData, isSandbox: true);
            }

            if (result.Status != 0)
            {
                _logger.LogWarning("Apple receipt validation failed with status {Status}", result.Status);
                return new AppleReceiptValidationResult
                {
                    IsValid = false,
                    Status = result.Status,
                    ErrorMessage = GetStatusMessage(result.Status)
                };
            }

            // Receipt'ten subscription bilgilerini çıkar
            var latestReceiptInfo = result.LatestReceiptInfo?.LastOrDefault();
            if (latestReceiptInfo == null)
            {
                return new AppleReceiptValidationResult
                {
                    IsValid = false,
                    ErrorMessage = "No subscription found in receipt"
                };
            }

            return new AppleReceiptValidationResult
            {
                IsValid = true,
                OriginalTransactionId = latestReceiptInfo.OriginalTransactionId,
                TransactionId = latestReceiptInfo.TransactionId,
                ProductId = latestReceiptInfo.ProductId,
                ExpiresDate = latestReceiptInfo.ExpiresDateMs.HasValue
                    ? DateTimeOffset.FromUnixTimeMilliseconds(latestReceiptInfo.ExpiresDateMs.Value).UtcDateTime
                    : null,
                PurchaseDate = latestReceiptInfo.PurchaseDateMs.HasValue
                    ? DateTimeOffset.FromUnixTimeMilliseconds(latestReceiptInfo.PurchaseDateMs.Value).UtcDateTime
                    : DateTime.UtcNow,
                IsTrialPeriod = latestReceiptInfo.IsTrialPeriod == "true",
                IsInIntroOfferPeriod = latestReceiptInfo.IsInIntroOfferPeriod == "true",
                CancellationDate = latestReceiptInfo.CancellationDateMs.HasValue
                    ? DateTimeOffset.FromUnixTimeMilliseconds(latestReceiptInfo.CancellationDateMs.Value).UtcDateTime
                    : null,
                CancellationReason = latestReceiptInfo.CancellationReason
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating Apple receipt");
            throw;
        }
    }

    public async Task ProcessWebhookAsync(AppleNotificationPayload payload)
    {
        // Apple Server-to-Server Notifications v2 format
        var notificationType = payload.NotificationType;
        if (string.IsNullOrEmpty(notificationType))
        {
            _logger.LogWarning("Apple webhook payload missing notification type");
            return;
        }

        // Idempotency kontrolü - unified_receipt içindeki notification_id kullan
        var notificationId = payload.UnifiedReceipt?.NotificationId;
        if (!string.IsNullOrEmpty(notificationId))
        {
            var existingEvent = await _db.EntitlementEvents
                .FirstOrDefaultAsync(e => e.ExternalEventId == notificationId);

            if (existingEvent != null)
            {
                _logger.LogInformation("Apple webhook event already processed: {NotificationId}", notificationId);
                return;
            }
        }

        _logger.LogInformation("Processing Apple webhook notification: {NotificationType}, NotificationId: {NotificationId}",
            notificationType, notificationId);

        var unifiedReceipt = payload.UnifiedReceipt;
        if (unifiedReceipt?.LatestReceiptInfo == null || unifiedReceipt.LatestReceiptInfo.Count == 0)
        {
            _logger.LogWarning("Apple webhook missing receipt info");
            return;
        }

        // En son receipt info'yu al
        var latestReceiptInfo = unifiedReceipt.LatestReceiptInfo.OrderByDescending(r => r.PurchaseDateMs ?? 0).First();
        var originalTransactionId = latestReceiptInfo.OriginalTransactionId;
        var productId = latestReceiptInfo.ProductId;

        if (string.IsNullOrEmpty(originalTransactionId) || string.IsNullOrEmpty(productId))
        {
            _logger.LogWarning("Apple webhook missing original transaction ID or product ID");
            return;
        }

        // Bu transaction ID'ye sahip entitlement'ı bul
        var entitlement = await _db.UserEntitlements
            .FirstOrDefaultAsync(e =>
                e.Source == EntitlementSource.AppStore &&
                e.ExternalSubscriptionId == originalTransactionId);

        if (entitlement == null)
        {
            _logger.LogWarning("Entitlement not found for Apple transaction: {OriginalTransactionId}", originalTransactionId);
            return;
        }

        var now = DateTime.UtcNow;
        var expiresDate = latestReceiptInfo.ExpiresDateMs.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(latestReceiptInfo.ExpiresDateMs.Value).UtcDateTime
            : (DateTime?)null;
        var purchaseDate = latestReceiptInfo.PurchaseDateMs.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(latestReceiptInfo.PurchaseDateMs.Value).UtcDateTime
            : now;
        var cancellationDate = latestReceiptInfo.CancellationDateMs.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(latestReceiptInfo.CancellationDateMs.Value).UtcDateTime
            : (DateTime?)null;

        // Notification type'a göre işlem yap
        switch (notificationType)
        {
            case "INITIAL_BUY":
            case "DID_RENEW":
                // Yeni satın alma veya yenileme
                entitlement.Status = EntitlementStatus.Active;
                entitlement.CurrentPeriodStartUtc = purchaseDate;
                entitlement.CurrentPeriodEndUtc = expiresDate;
                entitlement.AutoRenews = expiresDate.HasValue && expiresDate.Value > now;
                entitlement.CancelAtPeriodEnd = false;
                entitlement.CancelledAtUtc = null;
                entitlement.UpdatedAtUtc = now;

                // Event kaydet
                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Renewed, now,
                    $"Apple webhook: {notificationType}", notificationId);

                _logger.LogInformation("Apple subscription renewed for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "DID_FAIL_TO_RENEW":
                // Yenileme başarısız (grace period'a girebilir)
                entitlement.Status = EntitlementStatus.Active; // Grace period'da hala aktif
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Failed, now,
                    $"Apple webhook: {notificationType}", notificationId);

                _logger.LogWarning("Apple subscription failed to renew for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "CANCEL":
                // İptal edildi (period sonunda bitecek)
                entitlement.CancelAtPeriodEnd = true;
                entitlement.CancelledAtUtc = cancellationDate ?? now;
                entitlement.AutoRenews = false;
                entitlement.Status = EntitlementStatus.Cancelled;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Cancelled, now,
                    $"Apple webhook: {notificationType}", notificationId);

                _logger.LogInformation("Apple subscription cancelled for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "REFUND":
                // İade edildi - premium'u iptal et
                entitlement.Status = EntitlementStatus.Revoked;
                entitlement.CancelledAtUtc = cancellationDate ?? now;
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                // Premium'u revoke et
                await _entitlementService.RevokePremiumAsync(entitlement.UserId, null,
                    $"Apple webhook: {notificationType}");

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Revoked, now,
                    $"Apple webhook: {notificationType}", notificationId);

                _logger.LogWarning("Apple subscription refunded for entitlement {EntitlementId}", entitlement.Id);
                break;

            case "EXPIRED":
                // Süresi doldu
                entitlement.Status = EntitlementStatus.Expired;
                entitlement.AutoRenews = false;
                entitlement.UpdatedAtUtc = now;

                await AddEntitlementEventAsync(entitlement.Id, EntitlementEventType.Expired, now,
                    $"Apple webhook: {notificationType}", notificationId);

                // Plan değişimini tetikle (Premium -> Standard)
                var wasPremium = await _entitlementService.IsPremiumAsync(entitlement.UserId);
                await _entitlementService.OnPlanChangedAsync(entitlement.UserId, wasPremium, false);

                _logger.LogInformation("Apple subscription expired for entitlement {EntitlementId}", entitlement.Id);
                break;

            default:
                _logger.LogInformation("Unhandled Apple notification type: {NotificationType}", notificationType);
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

    private string GetStatusMessage(int status)
    {
        return status switch
        {
            0 => "Valid",
            21000 => "The App Store could not read the JSON object you provided",
            21002 => "The data in the receipt-data property was malformed or missing",
            21003 => "The receipt could not be authenticated",
            21004 => "The shared secret you provided does not match the shared secret on file",
            21005 => "The receipt server is not currently available",
            21006 => "This receipt is valid but the subscription has expired",
            21007 => "This receipt is from the test environment, but it was sent to the production environment",
            21008 => "This receipt is from the production environment, but it was sent to the test environment",
            21010 => "This receipt could not be authorized",
            _ => $"Unknown status: {status}"
        };
    }
}

// Apple API Response Models
public class AppleReceiptResponse
{
    public int Status { get; set; }
    public AppleReceiptInfo? Receipt { get; set; }
    public List<AppleLatestReceiptInfo>? LatestReceiptInfo { get; set; }
    public string? LatestReceipt { get; set; }
    public string? Environment { get; set; }
}

public class AppleReceiptInfo
{
    public string? BundleId { get; set; }
    public string? ApplicationVersion { get; set; }
    public long? ReceiptCreationDate { get; set; }
}

public class AppleLatestReceiptInfo
{
    public string? OriginalTransactionId { get; set; }
    public string? TransactionId { get; set; }
    public string? ProductId { get; set; }
    public long? ExpiresDateMs { get; set; }
    public long? PurchaseDateMs { get; set; }
    public string? IsTrialPeriod { get; set; }
    public string? IsInIntroOfferPeriod { get; set; }
    public long? CancellationDateMs { get; set; }
    public string? CancellationReason { get; set; }
}

public class AppleReceiptValidationResult
{
    public bool IsValid { get; set; }
    public int Status { get; set; }
    public string? ErrorMessage { get; set; }
    public string? OriginalTransactionId { get; set; }
    public string? TransactionId { get; set; }
    public string? ProductId { get; set; }
    public DateTime? ExpiresDate { get; set; }
    public DateTime PurchaseDate { get; set; }
    public bool IsTrialPeriod { get; set; }
    public bool IsInIntroOfferPeriod { get; set; }
    public DateTime? CancellationDate { get; set; }
    public string? CancellationReason { get; set; }
}

public class AppleNotificationPayload
{
    [System.Text.Json.Serialization.JsonPropertyName("notification_type")]
    public string? NotificationType { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("unified_receipt")]
    public AppleUnifiedReceipt? UnifiedReceipt { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("environment")]
    public string? Environment { get; set; }
}

public class AppleUnifiedReceipt
{
    [System.Text.Json.Serialization.JsonPropertyName("notification_id")]
    public string? NotificationId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("latest_receipt_info")]
    public List<AppleLatestReceiptInfo>? LatestReceiptInfo { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("latest_receipt")]
    public string? LatestReceipt { get; set; }
}
