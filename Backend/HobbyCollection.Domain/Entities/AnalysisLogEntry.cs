namespace HobbyCollection.Domain.Entities;

public class AnalysisLogEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AnalysisLogId { get; set; } = string.Empty;
    public string Step { get; set; } = string.Empty; // STEP 1, STEP 2, vb.
    public string StepName { get; set; } = string.Empty; // "Vision API Analysis", "OCR Processing", vb.
    public string Message { get; set; } = string.Empty; // Log mesajı
    public string? Data { get; set; } // JSON formatında ekstra veri
    public string Level { get; set; } = "Information"; // Information, Warning, Error
    public long? DurationMs { get; set; } // Bu adımın süresi (milisaniye)
    public int Order { get; set; } // Sıralama
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public AnalysisLog? AnalysisLog { get; set; }
}

