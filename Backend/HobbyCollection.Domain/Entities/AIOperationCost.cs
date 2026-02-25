namespace HobbyCollection.Domain.Entities;

/// <summary>
/// AI İşlem Maliyetleri - Her AI operasyonunun kredi maliyeti
/// </summary>
public class AIOperationCost
{
    public int Id { get; set; }
    
    /// <summary>
    /// İşlem tipi (örn: "ProductRecognition", "PriceDetection")
    /// </summary>
    public string OperationType { get; set; } = string.Empty;
    
    /// <summary>
    /// İşlem açıklaması
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// İşlem maliyeti (kredi cinsinden)
    /// </summary>
    public int CreditCost { get; set; }
    
    /// <summary>
    /// Aktif mi?
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Oluşturulma tarihi
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Güncellenme tarihi
    /// </summary>
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// AI İşlem Tipleri
/// </summary>
public static class AIOperationType
{
    public const string ProductRecognition = "ProductRecognition";
    public const string PriceDetection = "PriceDetection";
    public const string CategoryDetection = "CategoryDetection";
}

