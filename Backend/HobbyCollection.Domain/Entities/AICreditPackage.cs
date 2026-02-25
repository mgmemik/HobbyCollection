namespace HobbyCollection.Domain.Entities;

/// <summary>
/// AI Kredi Paketleri - Standart, Premium, Enterprise gibi farklı paket seçenekleri
/// </summary>
public class AICreditPackage
{
    public int Id { get; set; }
    
    /// <summary>
    /// Paket adı (örn: "Standard", "Premium", "Enterprise")
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Paket açıklaması
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Aylık verilen AI kredisi miktarı
    /// </summary>
    public int MonthlyCredits { get; set; }
    
    /// <summary>
    /// Paket fiyatı (gelecekte ücretli paketler için)
    /// </summary>
    public decimal Price { get; set; }
    
    /// <summary>
    /// Paket aktif mi?
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Varsayılan paket mi? (Yeni kullanıcılar için)
    /// </summary>
    public bool IsDefault { get; set; } = false;
    
    /// <summary>
    /// Oluşturulma tarihi
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Güncellenme tarihi
    /// </summary>
    public DateTime? UpdatedAt { get; set; }
}

