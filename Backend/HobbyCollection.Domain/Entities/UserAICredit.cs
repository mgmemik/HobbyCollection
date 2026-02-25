namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Kullanıcı AI Kredi Durumu
/// </summary>
public class UserAICredit
{
    public int Id { get; set; }
    
    /// <summary>
    /// Kullanıcı ID
    /// </summary>
    public string UserId { get; set; } = string.Empty;
    
    /// <summary>
    /// Kullanıcının seçtiği paket ID
    /// </summary>
    public int PackageId { get; set; }
    
    /// <summary>
    /// İlişkili paket
    /// </summary>
    public AICreditPackage? Package { get; set; }
    
    /// <summary>
    /// Mevcut kredi bakiyesi (Recurring + Bonus)
    /// </summary>
    public int CurrentBalance { get; set; }
    
    /// <summary>
    /// Bonus krediler (Admin verdiği, expire olmayan)
    /// </summary>
    public int BonusBalance { get; set; }
    
    /// <summary>
    /// Toplam kazanılan kredi
    /// </summary>
    public int TotalEarned { get; set; }
    
    /// <summary>
    /// Toplam harcanan kredi
    /// </summary>
    public int TotalSpent { get; set; }
    
    /// <summary>
    /// Son kredi yüklenme tarihi
    /// </summary>
    public DateTime LastRechargeDate { get; set; }
    
    /// <summary>
    /// Bir sonraki kredi yüklenme tarihi
    /// </summary>
    public DateTime NextRechargeDate { get; set; }
    
    /// <summary>
    /// Son refresh'teki plan tipi (standard/premium)
    /// </summary>
    public string LastPlanType { get; set; } = "standard";
    
    /// <summary>
    /// Son refresh'te eklenen recurring kredi miktarı
    /// </summary>
    public int LastRefreshAmount { get; set; }
    
    /// <summary>
    /// Oluşturulma tarihi
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Güncellenme tarihi
    /// </summary>
    public DateTime? UpdatedAt { get; set; }
}

