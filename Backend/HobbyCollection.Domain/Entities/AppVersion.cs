namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Uygulama sürümü yönetimi
/// </summary>
public class AppVersion
{
    public Guid Id { get; set; }
    
    /// <summary>
    /// Sürüm string'i (örn: "1.0.0", "2.1.3")
    /// </summary>
    public string Version { get; set; } = string.Empty;
    
    /// <summary>
    /// Bu sürüm geçerli mi? (false ise kullanıcılar güncelleme isteyecek)
    /// </summary>
    public bool IsValid { get; set; } = true;
    
    /// <summary>
    /// Oluşturulma tarihi
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Güncellenme tarihi
    /// </summary>
    public DateTime? UpdatedAtUtc { get; set; }
}
