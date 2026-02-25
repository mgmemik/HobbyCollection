namespace HobbyCollection.Domain.Entities;

/// <summary>
/// AI Kredi İşlemleri - Tüm yükleme ve harcama işlemlerinin detaylı kaydı
/// </summary>
public class AICreditTransaction
{
    public int Id { get; set; }
    
    /// <summary>
    /// Kullanıcı ID
    /// </summary>
    public string UserId { get; set; } = string.Empty;
    
    /// <summary>
    /// İşlem tipi (Charge=Yükleme, Spend=Harcama, Refund=İade)
    /// </summary>
    public string TransactionType { get; set; } = string.Empty;
    
    /// <summary>
    /// Kredi miktarı (pozitif: yükleme/iade, negatif: harcama)
    /// </summary>
    public int Amount { get; set; }
    
    /// <summary>
    /// İşlem öncesi bakiye
    /// </summary>
    public int BalanceBefore { get; set; }
    
    /// <summary>
    /// İşlem sonrası bakiye
    /// </summary>
    public int BalanceAfter { get; set; }
    
    /// <summary>
    /// AI işlem tipi (ProductRecognition, PriceDetection vb.)
    /// Sadece Spend ve Refund için dolu
    /// </summary>
    public string? OperationType { get; set; }
    
    /// <summary>
    /// İşlem açıklaması/nedeni
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// İlişkili Product ID (varsa)
    /// </summary>
    public int? ProductId { get; set; }
    
    /// <summary>
    /// İşlem başarılı mı?
    /// </summary>
    public bool IsSuccessful { get; set; } = true;
    
    /// <summary>
    /// İşlem tarihi
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// İşlem Tipleri
/// </summary>
public static class TransactionType
{
    public const string Charge = "Charge";      // Kredi yükleme
    public const string Spend = "Spend";        // Kredi harcama
    public const string Refund = "Refund";      // Kredi iadesi
}

