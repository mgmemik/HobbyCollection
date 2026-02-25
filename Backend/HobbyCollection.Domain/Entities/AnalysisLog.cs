namespace HobbyCollection.Domain.Entities;

public class AnalysisLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? ProductId { get; set; } // Analiz sonucu ürün oluşturulduysa
    public string UserId { get; set; } = string.Empty; // Analizi yapan kullanıcı
    public string Language { get; set; } = "en"; // Analiz dili
    public int PhotoCount { get; set; } // Analiz edilen fotoğraf sayısı
    public string? FinalProductName { get; set; } // Final ürün adı
    public double? FinalConfidence { get; set; } // Final confidence
    public string? DetectedCategory { get; set; } // Tespit edilen kategori
    public long ProcessingTimeMs { get; set; } // İşlem süresi (milisaniye)
    public bool IsSuccessful { get; set; } // Başarılı mı?
    public string? ErrorMessage { get; set; } // Hata mesajı (varsa)
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public List<AnalysisLogEntry> Entries { get; set; } = new();
}

