namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Kullanıcı hak/yetkilendirme kaydı (Premium abonelik, hediye premium vb.)
/// Tek gerçek kaynak (source of truth) olarak premium durumunu belirler.
/// </summary>
public class UserEntitlement
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Kullanıcı ID
    /// </summary>
    public string UserId { get; set; } = string.Empty;
    
    /// <summary>
    /// Hak türü (şimdilik sadece "premium")
    /// </summary>
    public EntitlementType EntitlementType { get; set; } = EntitlementType.Premium;
    
    /// <summary>
    /// Hakkın kaynağı (admin grant, promo code, app store, play store)
    /// </summary>
    public EntitlementSource Source { get; set; } = EntitlementSource.AdminGrant;
    
    /// <summary>
    /// Hak durumu
    /// </summary>
    public EntitlementStatus Status { get; set; } = EntitlementStatus.Active;
    
    /// <summary>
    /// Hakkın başlangıç tarihi
    /// </summary>
    public DateTime StartsAtUtc { get; set; }
    
    /// <summary>
    /// Hakkın bitiş tarihi (null = süresiz/lifetime)
    /// </summary>
    public DateTime? EndsAtUtc { get; set; }
    
    /// <summary>
    /// Otomatik yenileme var mı? (Store abonelikleri için)
    /// </summary>
    public bool AutoRenews { get; set; } = false;
    
    /// <summary>
    /// Mevcut dönem başlangıcı (Store abonelikleri için)
    /// </summary>
    public DateTime? CurrentPeriodStartUtc { get; set; }
    
    /// <summary>
    /// Mevcut dönem bitişi (Store abonelikleri için)
    /// </summary>
    public DateTime? CurrentPeriodEndUtc { get; set; }
    
    /// <summary>
    /// Dönem sonunda iptal edilecek mi?
    /// </summary>
    public bool CancelAtPeriodEnd { get; set; } = false;
    
    /// <summary>
    /// İptal edilme tarihi
    /// </summary>
    public DateTime? CancelledAtUtc { get; set; }
    
    /// <summary>
    /// Store ürün ID'si (app_store/play_store için)
    /// </summary>
    public string? ExternalProductId { get; set; }
    
    /// <summary>
    /// Store abonelik ID'si (app_store/play_store için)
    /// </summary>
    public string? ExternalSubscriptionId { get; set; }
    
    /// <summary>
    /// Admin notları veya ek bilgiler
    /// </summary>
    public string? Notes { get; set; }
    
    /// <summary>
    /// Promo code ID (eğer promo ile geldiyse)
    /// </summary>
    public Guid? PromoCodeId { get; set; }
    
    /// <summary>
    /// Oluşturulma tarihi
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Güncellenme tarihi
    /// </summary>
    public DateTime? UpdatedAtUtc { get; set; }
    
    /// <summary>
    /// Grant eden admin user ID (admin grant için)
    /// </summary>
    public string? GrantedByUserId { get; set; }
}

/// <summary>
/// Hak türleri
/// </summary>
public enum EntitlementType
{
    /// <summary>
    /// Premium abonelik
    /// </summary>
    Premium = 1,
}

/// <summary>
/// Hakkın kaynağı
/// </summary>
public enum EntitlementSource
{
    /// <summary>
    /// Admin tarafından manuel verildi
    /// </summary>
    AdminGrant = 1,
    
    /// <summary>
    /// Promo/hediye kodu ile
    /// </summary>
    PromoCode = 2,
    
    /// <summary>
    /// Apple App Store aboneliği
    /// </summary>
    AppStore = 3,
    
    /// <summary>
    /// Google Play Store aboneliği
    /// </summary>
    PlayStore = 4,
}

/// <summary>
/// Hak durumu
/// </summary>
public enum EntitlementStatus
{
    /// <summary>
    /// Aktif
    /// </summary>
    Active = 1,
    
    /// <summary>
    /// Süresi dolmuş
    /// </summary>
    Expired = 2,
    
    /// <summary>
    /// İptal edilmiş
    /// </summary>
    Cancelled = 3,
    
    /// <summary>
    /// Grace period (ödeme sorunu, kısa süre aktif)
    /// </summary>
    Grace = 4,
    
    /// <summary>
    /// Duraklatılmış (Google Play)
    /// </summary>
    Paused = 5,

    /// <summary>
    /// İade/revoke edilmiş (abonelik iptal edildi)
    /// </summary>
    Revoked = 6,
}
