using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Kullanıcı plan/hak yönetimi servisi
/// </summary>
public interface IEntitlementService
{
    /// <summary>
    /// Kullanıcının aktif planını döner
    /// </summary>
    Task<UserPlan> GetEffectivePlanAsync(string userId);
    
    /// <summary>
    /// Kullanıcı premium mu?
    /// </summary>
    Task<bool> IsPremiumAsync(string userId);
    
    /// <summary>
    /// Kullanıcı belirli bir özelliğe erişebilir mi?
    /// </summary>
    Task<bool> HasFeatureAsync(string userId, PremiumFeature feature);
    
    /// <summary>
    /// Kullanıcıya premium ver (admin grant veya promo code ile)
    /// </summary>
    Task<UserEntitlement> GrantPremiumAsync(GrantPremiumRequest request);
    
    /// <summary>
    /// Kullanıcının premium hakkını iptal et
    /// </summary>
    Task RevokePremiumAsync(string userId, string? revokedByUserId = null, string? reason = null);
    
    /// <summary>
    /// Kullanıcının premium süresini uzat
    /// </summary>
    Task ExtendPremiumAsync(string userId, TimeSpan duration, string? extendedByUserId = null, string? reason = null);
    
    /// <summary>
    /// Kullanıcının plan detaylarını getir
    /// </summary>
    Task<PlanDetails?> GetPlanDetailsAsync(string userId);
    
    /// <summary>
    /// Kullanıcının aktif entitlement'ını getir
    /// </summary>
    Task<UserEntitlement?> GetActiveEntitlementAsync(string userId);
    
    /// <summary>
    /// Süresi dolan entitlement'ları işle (background job için)
    /// </summary>
    Task ProcessExpiredEntitlementsAsync();
    
    /// <summary>
    /// Kullanıcının planı değiştiğinde AI kredilerini güncelle (Premium upgrade/downgrade)
    /// </summary>
    Task OnPlanChangedAsync(string userId, bool wasPremium, bool isPremium);
}

/// <summary>
/// Kullanıcı planı
/// </summary>
public enum UserPlan
{
    /// <summary>
    /// Standart (ücretsiz) plan
    /// </summary>
    Standard = 0,
    
    /// <summary>
    /// Premium (ücretli) plan
    /// </summary>
    Premium = 1,
}

/// <summary>
/// Premium özellikleri
/// </summary>
public enum PremiumFeature
{
    /// <summary>
    /// Koleksiyon CSV export
    /// </summary>
    CsvExport,
    
    /// <summary>
    /// Ürün badge'leri (Rare, Mint, Damaged vs.)
    /// </summary>
    ProductBadges,
    
    /// <summary>
    /// Private ürünler
    /// </summary>
    PrivateProducts,
    
    /// <summary>
    /// Vitrin (Showcase) özelliği
    /// </summary>
    Showcase,
    
    /// <summary>
    /// Koleksiyon raporu
    /// </summary>
    CollectionReport,
    
    /// <summary>
    /// Premium AI kredileri (300/ay vs 50/ay)
    /// </summary>
    PremiumAICredits,
}

/// <summary>
/// Premium verme isteği
/// </summary>
public class GrantPremiumRequest
{
    /// <summary>
    /// Hedef kullanıcı ID
    /// </summary>
    public required string UserId { get; init; }
    
    /// <summary>
    /// Premium süresi (null = süresiz/lifetime)
    /// </summary>
    public TimeSpan? Duration { get; init; }
    
    /// <summary>
    /// Kaynak (AdminGrant veya PromoCode)
    /// </summary>
    public EntitlementSource Source { get; init; } = EntitlementSource.AdminGrant;
    
    /// <summary>
    /// İşlemi yapan admin ID (AdminGrant için)
    /// </summary>
    public string? GrantedByUserId { get; init; }
    
    /// <summary>
    /// Promo kodu ID (PromoCode için)
    /// </summary>
    public Guid? PromoCodeId { get; init; }
    
    /// <summary>
    /// Notlar
    /// </summary>
    public string? Notes { get; init; }
}

/// <summary>
/// Kullanıcı plan detayları
/// </summary>
public class PlanDetails
{
    /// <summary>
    /// Aktif plan
    /// </summary>
    public UserPlan Plan { get; init; }
    
    /// <summary>
    /// Premium mi?
    /// </summary>
    public bool IsPremium { get; init; }
    
    /// <summary>
    /// Planın kaynağı (null = Standard)
    /// </summary>
    public EntitlementSource? Source { get; init; }
    
    /// <summary>
    /// Başlangıç tarihi (null = Standard)
    /// </summary>
    public DateTime? StartsAtUtc { get; init; }
    
    /// <summary>
    /// Bitiş tarihi (null = süresiz veya Standard)
    /// </summary>
    public DateTime? EndsAtUtc { get; init; }
    
    /// <summary>
    /// Otomatik yenilenecek mi?
    /// </summary>
    public bool AutoRenews { get; init; }
    
    /// <summary>
    /// Dönem sonunda iptal mi?
    /// </summary>
    public bool CancelAtPeriodEnd { get; init; }
    
    /// <summary>
    /// Kalan gün (null = süresiz veya Standard)
    /// </summary>
    public int? DaysRemaining { get; init; }
    
    /// <summary>
    /// Aylık AI kredisi
    /// </summary>
    public int MonthlyAICredits => IsPremium ? 300 : 50;
    
    /// <summary>
    /// Erişilebilir özellikler
    /// </summary>
    public List<string> Features { get; init; } = new();
}
