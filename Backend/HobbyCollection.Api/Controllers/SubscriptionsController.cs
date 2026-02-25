using HobbyCollection.Api.Services;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HobbyCollection.Api.Controllers;

/// <summary>
/// Subscription (App Store / Play Store) yönetimi için controller
/// </summary>
[ApiController]
[Route("api/subscriptions")]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly IAppleSubscriptionService _appleService;
    private readonly IGoogleSubscriptionService _googleService;
    private readonly IEntitlementService _entitlementService;
    private readonly AppDbContext _db;
    private readonly ILogger<SubscriptionsController> _logger;

    public SubscriptionsController(
        IAppleSubscriptionService appleService,
        IGoogleSubscriptionService googleService,
        IEntitlementService entitlementService,
        AppDbContext db,
        ILogger<SubscriptionsController> logger)
    {
        _appleService = appleService;
        _googleService = googleService;
        _entitlementService = entitlementService;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Apple App Store receipt validation
    /// </summary>
    [HttpPost("apple/validate")]
    public async Task<IActionResult> ValidateAppleReceipt([FromBody] ValidateAppleReceiptRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.ReceiptData))
        {
            return BadRequest(new { message = "Receipt data is required" });
        }

        try
        {
            // Receipt'i validate et
            var validationResult = await _appleService.ValidateReceiptAsync(request.ReceiptData, request.IsSandbox ?? false);

            if (!validationResult.IsValid)
            {
                return BadRequest(new
                {
                    message = validationResult.ErrorMessage ?? "Receipt validation failed",
                    status = validationResult.Status
                });
            }

            // Mevcut entitlement var mı kontrol et
            var existingEntitlement = await _db.UserEntitlements
                .FirstOrDefaultAsync(e =>
                    e.UserId == userId &&
                    e.Source == EntitlementSource.AppStore &&
                    e.ExternalSubscriptionId == validationResult.OriginalTransactionId &&
                    e.Status == EntitlementStatus.Active);

            if (existingEntitlement != null)
            {
                // Mevcut entitlement'ı güncelle
                existingEntitlement.CurrentPeriodEndUtc = validationResult.ExpiresDate;
                existingEntitlement.CurrentPeriodStartUtc = validationResult.PurchaseDate;
                existingEntitlement.AutoRenews = validationResult.ExpiresDate.HasValue && 
                    validationResult.ExpiresDate.Value > DateTime.UtcNow;
                existingEntitlement.UpdatedAtUtc = DateTime.UtcNow;

                if (validationResult.CancellationDate.HasValue)
                {
                    existingEntitlement.CancelAtPeriodEnd = true;
                    existingEntitlement.CancelledAtUtc = validationResult.CancellationDate;
                    existingEntitlement.Status = EntitlementStatus.Cancelled;
                }

                await _db.SaveChangesAsync();

                return Ok(new
                {
                    message = "Subscription updated",
                    entitlement = new
                    {
                        id = existingEntitlement.Id,
                        expiresAt = existingEntitlement.CurrentPeriodEndUtc,
                        autoRenews = existingEntitlement.AutoRenews
                    }
                });
            }

            // Yeni entitlement oluştur
            var now = DateTime.UtcNow;
            var endsAt = validationResult.ExpiresDate ?? now.AddMonths(1); // Default 1 ay

            var entitlement = await _entitlementService.GrantPremiumAsync(new HobbyCollection.Api.Services.GrantPremiumRequest
            {
                UserId = userId,
                Duration = endsAt > now ? (TimeSpan?)(endsAt - now) : null,
                Source = EntitlementSource.AppStore
            });

            // Store bilgilerini ekle
            entitlement.ExternalProductId = validationResult.ProductId;
            entitlement.ExternalSubscriptionId = validationResult.OriginalTransactionId;
            entitlement.AutoRenews = validationResult.ExpiresDate.HasValue && 
                validationResult.ExpiresDate.Value > DateTime.UtcNow;
            entitlement.CurrentPeriodStartUtc = validationResult.PurchaseDate;
            entitlement.CurrentPeriodEndUtc = validationResult.ExpiresDate;

            if (validationResult.CancellationDate.HasValue)
            {
                entitlement.CancelAtPeriodEnd = true;
                entitlement.CancelledAtUtc = validationResult.CancellationDate;
                entitlement.Status = EntitlementStatus.Cancelled;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Apple subscription validated and entitlement created for user {UserId}", userId);

            return Ok(new
            {
                message = "Subscription validated and premium activated",
                entitlement = new
                {
                    id = entitlement.Id,
                    expiresAt = entitlement.CurrentPeriodEndUtc,
                    autoRenews = entitlement.AutoRenews
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating Apple receipt for user {UserId}", userId);
            return StatusCode(500, new { message = "Error validating receipt" });
        }
    }

    /// <summary>
    /// Google Play Store purchase validation
    /// </summary>
    [HttpPost("google/validate")]
    public async Task<IActionResult> ValidateGooglePurchase([FromBody] ValidateGooglePurchaseRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.PackageName) ||
            string.IsNullOrWhiteSpace(request.SubscriptionId) ||
            string.IsNullOrWhiteSpace(request.PurchaseToken))
        {
            return BadRequest(new { message = "Package name, subscription ID, and purchase token are required" });
        }

        try
        {
            // Purchase token'ı validate et
            var validationResult = await _googleService.ValidatePurchaseAsync(
                request.PackageName,
                request.SubscriptionId,
                request.PurchaseToken);

            if (!validationResult.IsValid)
            {
                return BadRequest(new
                {
                    message = validationResult.ErrorMessage ?? "Purchase validation failed"
                });
            }

            // Mevcut entitlement var mı kontrol et
            var existingEntitlement = await _db.UserEntitlements
                .FirstOrDefaultAsync(e =>
                    e.UserId == userId &&
                    e.Source == EntitlementSource.PlayStore &&
                    e.ExternalSubscriptionId == validationResult.PurchaseToken &&
                    e.Status == EntitlementStatus.Active);

            if (existingEntitlement != null)
            {
                // Mevcut entitlement'ı güncelle
                existingEntitlement.CurrentPeriodEndUtc = validationResult.ExpiryTime;
                existingEntitlement.CurrentPeriodStartUtc = validationResult.StartTime;
                existingEntitlement.AutoRenews = validationResult.AutoRenewing;
                existingEntitlement.UpdatedAtUtc = DateTime.UtcNow;

                if (validationResult.CancelTime.HasValue)
                {
                    existingEntitlement.CancelAtPeriodEnd = true;
                    existingEntitlement.CancelledAtUtc = validationResult.CancelTime;
                    existingEntitlement.Status = EntitlementStatus.Cancelled;
                }

                await _db.SaveChangesAsync();

                return Ok(new
                {
                    message = "Subscription updated",
                    entitlement = new
                    {
                        id = existingEntitlement.Id,
                        expiresAt = existingEntitlement.CurrentPeriodEndUtc,
                        autoRenews = existingEntitlement.AutoRenews
                    }
                });
            }

            // Yeni entitlement oluştur
            var now = DateTime.UtcNow;
            var endsAt = validationResult.ExpiryTime ?? now.AddMonths(1);

            var entitlement = await _entitlementService.GrantPremiumAsync(new HobbyCollection.Api.Services.GrantPremiumRequest
            {
                UserId = userId,
                Duration = endsAt > now ? (TimeSpan?)(endsAt - now) : null,
                Source = EntitlementSource.PlayStore
            });

            // Store bilgilerini ekle
            entitlement.ExternalProductId = validationResult.ProductId;
            entitlement.ExternalSubscriptionId = validationResult.PurchaseToken;
            entitlement.AutoRenews = validationResult.AutoRenewing;
            entitlement.CurrentPeriodStartUtc = validationResult.StartTime;
            entitlement.CurrentPeriodEndUtc = validationResult.ExpiryTime;

            if (validationResult.CancelTime.HasValue)
            {
                entitlement.CancelAtPeriodEnd = true;
                entitlement.CancelledAtUtc = validationResult.CancelTime;
                entitlement.Status = EntitlementStatus.Cancelled;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Google Play subscription validated and entitlement created for user {UserId}", userId);

            return Ok(new
            {
                message = "Subscription validated and premium activated",
                entitlement = new
                {
                    id = entitlement.Id,
                    expiresAt = entitlement.CurrentPeriodEndUtc,
                    autoRenews = entitlement.AutoRenews
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating Google Play purchase for user {UserId}", userId);
            return StatusCode(500, new { message = "Error validating purchase" });
        }
    }

    /// <summary>
    /// Kullanıcının mevcut subscription durumunu getir
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> GetSubscriptionStatus()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var entitlement = await _db.UserEntitlements
            .Where(e => e.UserId == userId &&
                       (e.Source == EntitlementSource.AppStore || e.Source == EntitlementSource.PlayStore) &&
                       e.Status == EntitlementStatus.Active)
            .OrderByDescending(e => e.CurrentPeriodEndUtc ?? e.EndsAtUtc ?? DateTime.MaxValue)
            .FirstOrDefaultAsync();

        if (entitlement == null)
        {
            return Ok(new
            {
                hasActiveSubscription = false,
                message = "No active subscription found"
            });
        }

        return Ok(new
        {
            hasActiveSubscription = true,
            source = entitlement.Source.ToString(),
            productId = entitlement.ExternalProductId,
            subscriptionId = entitlement.ExternalSubscriptionId,
            expiresAt = entitlement.CurrentPeriodEndUtc ?? entitlement.EndsAtUtc,
            autoRenews = entitlement.AutoRenews,
            cancelAtPeriodEnd = entitlement.CancelAtPeriodEnd,
            status = entitlement.Status.ToString()
        });
    }

    /// <summary>
    /// Apple App Store webhook endpoint (Server-to-Server Notifications)
    /// </summary>
    [HttpPost("apple/webhook")]
    [AllowAnonymous] // Apple'dan gelen webhook'lar için
    public async Task<IActionResult> AppleWebhook([FromBody] AppleNotificationPayload payload)
    {
        try
        {
            await _appleService.ProcessWebhookAsync(payload);
            return Ok(new { message = "Webhook processed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Apple webhook");
            return StatusCode(500, new { message = "Error processing webhook" });
        }
    }

    /// <summary>
    /// Google Play Store webhook endpoint (Pub/Sub)
    /// </summary>
    [HttpPost("google/webhook")]
    [AllowAnonymous] // Google'dan gelen webhook'lar için
    public async Task<IActionResult> GoogleWebhook([FromBody] GooglePubSubMessage message)
    {
        try
        {
            await _googleService.ProcessPubSubMessageAsync(message);
            return Ok(new { message = "Webhook processed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Google Play webhook");
            return StatusCode(500, new { message = "Error processing webhook" });
        }
    }
}

// Request Models
public record ValidateAppleReceiptRequest(
    string ReceiptData,
    bool? IsSandbox = null
);

public record ValidateGooglePurchaseRequest(
    string PackageName,
    string SubscriptionId,
    string PurchaseToken
);
