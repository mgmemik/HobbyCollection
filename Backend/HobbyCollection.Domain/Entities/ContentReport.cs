namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Kullanıcıların içerikleri (ürün, kullanıcı, yorum) şikayet etmesi için entity
/// </summary>
public class ContentReport
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Şikayeti yapan kullanıcı
    /// </summary>
    public string ReporterUserId { get; set; } = string.Empty;
    
    /// <summary>
    /// Şikayet edilen içerik tipi: "product", "user", "comment"
    /// </summary>
    public string ContentType { get; set; } = string.Empty;
    
    /// <summary>
    /// Şikayet edilen içeriğin ID'si (ProductId, UserId, CommentId)
    /// </summary>
    public string ContentId { get; set; } = string.Empty;
    
    /// <summary>
    /// Şikayet sebebi: "spam", "inappropriate", "hate_speech", "copyright", "fake_account", "other"
    /// </summary>
    public string Reason { get; set; } = string.Empty;
    
    /// <summary>
    /// Kullanıcının eklediği açıklama (opsiyonel)
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Şikayet durumu: "pending", "reviewed", "resolved", "rejected"
    /// </summary>
    public string Status { get; set; } = "pending";
    
    /// <summary>
    /// Admin'in eklediği not (değerlendirme sonrası)
    /// </summary>
    public string? AdminNote { get; set; }
    
    /// <summary>
    /// Şikayeti değerlendiren admin kullanıcı ID'si
    /// </summary>
    public string? ReviewedByUserId { get; set; }
    
    /// <summary>
    /// Şikayet oluşturulma tarihi
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Şikayet değerlendirme tarihi
    /// </summary>
    public DateTime? ReviewedAt { get; set; }
}
