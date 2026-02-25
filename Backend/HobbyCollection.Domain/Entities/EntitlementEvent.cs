namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Entitlement değişiklik olayları (audit + idempotency için)
/// Store webhook'ları ve admin aksiyonları burada loglanır.
/// </summary>
public class EntitlementEvent
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// İlişkili entitlement ID
    /// </summary>
    public Guid EntitlementId { get; set; }
    
    /// <summary>
    /// İlişkili entitlement
    /// </summary>
    public UserEntitlement? Entitlement { get; set; }
    
    /// <summary>
    /// Olay türü
    /// </summary>
    public EntitlementEventType EventType { get; set; }
    
    /// <summary>
    /// Olayın gerçekleşme zamanı
    /// </summary>
    public DateTime EventTimeUtc { get; set; }
    
    /// <summary>
    /// Harici olay ID'si (Store notification ID - idempotency için)
    /// </summary>
    public string? ExternalEventId { get; set; }
    
    /// <summary>
    /// Ham payload (Store webhook body veya admin action details)
    /// </summary>
    public string? RawPayloadJson { get; set; }
    
    /// <summary>
    /// İşlenme zamanı
    /// </summary>
    public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// İşlemi yapan kullanıcı (admin aksiyonları için)
    /// </summary>
    public string? ProcessedByUserId { get; set; }
    
    /// <summary>
    /// Ek notlar
    /// </summary>
    public string? Notes { get; set; }
}

/// <summary>
/// Entitlement olay türleri
/// </summary>
public enum EntitlementEventType
{
    /// <summary>
    /// Yeni entitlement oluşturuldu
    /// </summary>
    Created = 1,
    
    /// <summary>
    /// Entitlement yenilendi (renewal)
    /// </summary>
    Renewed = 2,
    
    /// <summary>
    /// İptal edildi
    /// </summary>
    Cancelled = 3,
    
    /// <summary>
    /// Süresi doldu
    /// </summary>
    Expired = 4,
    
    /// <summary>
    /// Duraklatıldı
    /// </summary>
    Paused = 5,
    
    /// <summary>
    /// Devam ettirildi (pause'dan çıkış)
    /// </summary>
    Resumed = 6,
    
    /// <summary>
    /// Grace period'a girdi
    /// </summary>
    EnteredGrace = 7,
    
    /// <summary>
    /// Grace period'dan çıktı (ödeme yapıldı)
    /// </summary>
    ExitedGrace = 8,
    
    /// <summary>
    /// Plan yükseltildi
    /// </summary>
    Upgraded = 9,
    
    /// <summary>
    /// Plan düşürüldü
    /// </summary>
    Downgraded = 10,
    
    /// <summary>
    /// Manuel olarak iptal edildi (admin)
    /// </summary>
    Revoked = 11,
    
    /// <summary>
    /// Manuel olarak uzatıldı (admin)
    /// </summary>
    Extended = 12,

    /// <summary>
    /// Yenileme başarısız (örn. Apple DID_FAIL_TO_RENEW)
    /// </summary>
    Failed = 13,
}
