using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HobbyCollection.Api.Services;
using System.Security.Claims;

namespace HobbyCollection.Api.Controllers;

/// <summary>
/// Plan/Abonelik yönetimi endpoint'leri
/// </summary>
[ApiController]
[Route("api")]
[Authorize]
public class PlanController : ControllerBase
{
    private readonly IEntitlementService _entitlementService;
    private readonly ILogger<PlanController> _logger;
    
    public PlanController(
        IEntitlementService entitlementService,
        ILogger<PlanController> logger)
    {
        _entitlementService = entitlementService;
        _logger = logger;
    }
    
    /// <summary>
    /// Kullanıcının mevcut plan bilgilerini getirir
    /// </summary>
    [HttpGet("me/plan")]
    public async Task<ActionResult<PlanResponse>> GetMyPlan()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        
        var details = await _entitlementService.GetPlanDetailsAsync(userId);
        if (details == null)
            return NotFound();
        
        return Ok(new PlanResponse
        {
            Plan = details.Plan.ToString().ToLowerInvariant(),
            IsPremium = details.IsPremium,
            Source = details.Source?.ToString(),
            StartsAt = details.StartsAtUtc,
            EndsAt = details.EndsAtUtc,
            AutoRenews = details.AutoRenews,
            CancelAtPeriodEnd = details.CancelAtPeriodEnd,
            DaysRemaining = details.DaysRemaining,
            MonthlyAICredits = details.MonthlyAICredits,
            Features = details.Features,
        });
    }
    
    /// <summary>
    /// Kullanıcının belirli bir özelliğe erişimi var mı kontrol eder
    /// </summary>
    [HttpGet("me/plan/feature/{feature}")]
    public async Task<ActionResult<FeatureAccessResponse>> CheckFeatureAccess(string feature)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        
        // Feature string'i enum'a çevir
        if (!Enum.TryParse<PremiumFeature>(feature, ignoreCase: true, out var premiumFeature))
        {
            return BadRequest(new { message = $"Geçersiz özellik: {feature}" });
        }
        
        var hasAccess = await _entitlementService.HasFeatureAsync(userId, premiumFeature);
        
        return Ok(new FeatureAccessResponse
        {
            Feature = feature,
            HasAccess = hasAccess,
            RequiresPremium = true, // Tüm listelenen özellikler premium gerektirir
        });
    }
    
    /// <summary>
    /// Tüm premium özellikleri ve kullanıcının erişim durumunu listeler
    /// </summary>
    [HttpGet("me/plan/features")]
    public async Task<ActionResult<AllFeaturesResponse>> GetAllFeatures()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        
        var isPremium = await _entitlementService.IsPremiumAsync(userId);
        
        var features = Enum.GetValues<PremiumFeature>()
            .Select(f => new FeatureInfo
            {
                Feature = f.ToString(),
                HasAccess = isPremium,
                RequiresPremium = true,
            })
            .ToList();
        
        return Ok(new AllFeaturesResponse
        {
            IsPremium = isPremium,
            Features = features,
        });
    }
    
    /// <summary>
    /// Plan bilgilerini karşılaştırma için getirir (public - auth gerektirmez)
    /// Not: Fiyatlar fallback değerlerdir. Gerçek fiyatlar mobile app'ten App Store/Play Store'dan çekilir.
    /// </summary>
    [HttpGet("plans")]
    [AllowAnonymous]
    public ActionResult<PlansComparisonResponse> GetPlansComparison()
    {
        return Ok(new PlansComparisonResponse
        {
            Plans = new List<PlanComparisonItem>
            {
                new()
                {
                    Id = "standard",
                    Name = "Standard",
                    Description = "Ücretsiz plan",
                    Price = 0,
                    Currency = "TRY",
                    BillingPeriod = null,
                    MonthlyAICredits = 50,
                    Features = new List<string>
                    {
                        "Koleksiyon yönetimi",
                        "AI destekli ürün tanıma",
                        "Sosyal özellikler",
                        "Mesajlaşma",
                    },
                },
                new()
                {
                    Id = "premium",
                    Name = "Premium",
                    Description = "Tüm özellikler dahil",
                    Price = 4.99m,
                    Currency = "USD",
                    BillingPeriod = "monthly",
                    MonthlyAICredits = 300,
                    Features = new List<string>
                    {
                        "Koleksiyon yönetimi",
                        "AI destekli ürün tanıma (6x daha fazla)",
                        "Sosyal özellikler",
                        "Mesajlaşma",
                        "Koleksiyon CSV export",
                        "Ürün badge'leri (Rare, Mint vs.)",
                        "Private ürünler",
                        "Vitrin (Showcase)",
                        "Koleksiyon raporu",
                    },
                },
            },
        });
    }
}

// Response DTOs

public class PlanResponse
{
    public string Plan { get; init; } = "standard";
    public bool IsPremium { get; init; }
    public string? Source { get; init; }
    public DateTime? StartsAt { get; init; }
    public DateTime? EndsAt { get; init; }
    public bool AutoRenews { get; init; }
    public bool CancelAtPeriodEnd { get; init; }
    public int? DaysRemaining { get; init; }
    public int MonthlyAICredits { get; init; }
    public List<string> Features { get; init; } = new();
}

public class FeatureAccessResponse
{
    public string Feature { get; init; } = string.Empty;
    public bool HasAccess { get; init; }
    public bool RequiresPremium { get; init; }
}

public class AllFeaturesResponse
{
    public bool IsPremium { get; init; }
    public List<FeatureInfo> Features { get; init; } = new();
}

public class FeatureInfo
{
    public string Feature { get; init; } = string.Empty;
    public bool HasAccess { get; init; }
    public bool RequiresPremium { get; init; }
}

public class PlansComparisonResponse
{
    public List<PlanComparisonItem> Plans { get; init; } = new();
}

public class PlanComparisonItem
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public string Currency { get; init; } = "USD";
    public string? BillingPeriod { get; init; }
    public int MonthlyAICredits { get; init; }
    public List<string> Features { get; init; } = new();
}
