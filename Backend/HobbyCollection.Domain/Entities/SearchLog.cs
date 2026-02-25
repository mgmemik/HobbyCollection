namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Arama logları - Kullanıcıların yaptığı aramaların kaydı
/// </summary>
public class SearchLog
{
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Kullanıcı ID (anonim aramalar için boş olabilir)
    /// </summary>
    public string? UserId { get; set; }
    
    /// <summary>
    /// Arama tipi (Products, Users)
    /// </summary>
    public string SearchType { get; set; } = string.Empty;
    
    /// <summary>
    /// Arama sorgusu (query)
    /// </summary>
    public string? Query { get; set; }
    
    /// <summary>
    /// Kategori ID (ürün araması için)
    /// </summary>
    public Guid? CategoryId { get; set; }
    
    /// <summary>
    /// Sonuç sayısı
    /// </summary>
    public int ResultCount { get; set; }
    
    /// <summary>
    /// IP adresi
    /// </summary>
    public string IpAddress { get; set; } = string.Empty;
    
    /// <summary>
    /// User Agent
    /// </summary>
    public string? UserAgent { get; set; }
    
    /// <summary>
    /// Dil kodu (tr, en)
    /// </summary>
    public string? Language { get; set; }
    
    /// <summary>
    /// Arama tarihi
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Arama tipleri
/// </summary>
public static class SearchType
{
    public const string Products = "Products";
    public const string Users = "Users";
}

