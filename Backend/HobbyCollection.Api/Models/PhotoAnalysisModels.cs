using System.Text.Json.Serialization;

namespace HobbyCollection.Api.Models;

public class PhotoAnalysisRequest
{
    public List<IFormFile> Photos { get; set; } = new();
    public string? UserId { get; set; }
}

public class PhotoAnalysisResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public PhotoAnalysisResult? Result { get; set; }
}

// ========================================
// YENİ GELİŞMİŞ ANALİZ MODELLERİ
// ========================================

public class EnhancedAnalysisResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public EnhancedAnalysisResult? Result { get; set; }
}

public class EnhancedAnalysisResult
{
    [JsonPropertyName("dataCollection")]
    public AnalysisDataCollection DataCollection { get; set; } = new();

    [JsonPropertyName("finalIdentification")]
    public ProductIdentificationResult FinalIdentification { get; set; } = new();

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    [JsonPropertyName("processingTime")]
    public TimeSpan ProcessingTime { get; set; }

    [JsonPropertyName("hashtags")]
    public List<string> Hashtags { get; set; } = new();
    
    [JsonPropertyName("detectedCategory")]
    public string? DetectedCategory { get; set; }
    
    [JsonPropertyName("categorySpecificData")]
    public CategorySpecificData? CategorySpecificData { get; set; }
    
    [JsonPropertyName("geminiDescription")]
    public string? GeminiDescription { get; set; }
    
    [JsonPropertyName("geminiHashtags")]
    public List<string> GeminiHashtags { get; set; } = new();
}

/// <summary>
/// Kategori özel veri modeli (kitap, para, pul, saat vb. için özel bilgiler)
/// </summary>
public class CategorySpecificData
{
    // Kitap bilgileri
    [JsonPropertyName("author")]
    public string? Author { get; set; }
    
    [JsonPropertyName("bookTitle")]
    public string? BookTitle { get; set; }
    
    [JsonPropertyName("isbn")]
    public string? ISBN { get; set; }
    
    [JsonPropertyName("publisher")]
    public string? Publisher { get; set; }
    
    // Para/Pul bilgileri
    [JsonPropertyName("country")]
    public string? Country { get; set; }
    
    [JsonPropertyName("year")]
    public string? Year { get; set; }
    
    [JsonPropertyName("denomination")]
    public string? Denomination { get; set; }
    
    [JsonPropertyName("rarity")]
    public string? Rarity { get; set; }
    
    // Saat bilgileri
    [JsonPropertyName("watchType")]
    public string? WatchType { get; set; }
    
    [JsonPropertyName("movement")]
    public string? Movement { get; set; }
    
    // Kamera bilgileri
    [JsonPropertyName("cameraType")]
    public string? CameraType { get; set; }
    
    [JsonPropertyName("lensMount")]
    public string? LensMount { get; set; }
    
    // Oyun bilgileri
    [JsonPropertyName("platform")]
    public string? Platform { get; set; }
    
    [JsonPropertyName("gameTitle")]
    public string? GameTitle { get; set; }
    
    // Genel bilgiler
    [JsonPropertyName("dominantColors")]
    public List<string>? DominantColors { get; set; } // Dominant renkler (hex format)
    
    [JsonPropertyName("additionalProperties")]
    public Dictionary<string, string> AdditionalProperties { get; set; } = new();
}

public class AnalysisDataCollection
{
    [JsonPropertyName("visionResults")]
    public List<VisionAnalysisData> VisionResults { get; set; } = new();

    [JsonPropertyName("ocrText")]
    public string OcrText { get; set; } = string.Empty;

    [JsonPropertyName("webSearchResults")]
    public List<SerpResult> WebSearchResults { get; set; } = new();
}

public class ProductIdentificationResult
{
    [JsonPropertyName("productName")]
    public string ProductName { get; set; } = string.Empty;

    [JsonPropertyName("brand")]
    public string Brand { get; set; } = string.Empty;

    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    [JsonPropertyName("reasoning")]
    public string Reasoning { get; set; } = string.Empty;

    [JsonPropertyName("evidence")]
    public List<string> Evidence { get; set; } = new();
}

public class SerpResult
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("link")]
    public string Link { get; set; } = string.Empty;

    [JsonPropertyName("snippet")]
    public string Snippet { get; set; } = string.Empty;

    [JsonPropertyName("source")]
    public string Source { get; set; } = string.Empty;

    [JsonPropertyName("displayLink")]
    public string DisplayLink { get; set; } = string.Empty;
}

public class PhotoAnalysisResult
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description_tr")]
    public string DescriptionTr { get; set; } = string.Empty;

    [JsonPropertyName("description_en")]
    public string DescriptionEn { get; set; } = string.Empty;

    [JsonPropertyName("hashtags")]
    public List<string> Hashtags { get; set; } = new();

    [JsonPropertyName("entities")]
    public List<DetectedEntity> Entities { get; set; } = new();

    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("materials")]
    public List<string> Materials { get; set; } = new();

    [JsonPropertyName("condition")]
    public string Condition { get; set; } = string.Empty;

    [JsonPropertyName("rarity")]
    public string Rarity { get; set; } = string.Empty;

    [JsonPropertyName("confidence_overall")]
    public double ConfidenceOverall { get; set; }

    [JsonPropertyName("evidence")]
    public List<string> Evidence { get; set; } = new();

    // Vision API ham sonuçları
    public VisionAnalysisData? VisionData { get; set; }
}

public class DetectedEntity
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
}

public class VisionAnalysisData
{
    public List<LabelInfo> Labels { get; set; } = new();
    public List<WebEntity> WebEntities { get; set; } = new();
    public List<WebPage> WebPages { get; set; } = new();
    public List<WebImage> VisuallySimilarImages { get; set; } = new();
    public List<ObjectInfo> Objects { get; set; } = new();
    public List<LogoInfo> Logos { get; set; } = new(); // LOGO DETECTION - Marka tespiti için çok güvenilir!
    public List<string> DominantColors { get; set; } = new(); // Dominant renkler
    public List<BarcodeInfo> Barcodes { get; set; } = new(); // Barcode/QR code detection
    public string ExtractedText { get; set; } = string.Empty;
    public string BestGuessLabel { get; set; } = string.Empty;
}

public class LabelInfo
{
    public string Description { get; set; } = string.Empty;
    public float Score { get; set; }
}

public class WebEntity
{
    public string EntityId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public float Score { get; set; }
}

public class WebPage
{
    public string Url { get; set; } = string.Empty;
    public string PageTitle { get; set; } = string.Empty;
    public float Score { get; set; }
}

public class WebImage
{
    public string Url { get; set; } = string.Empty;
    public float Score { get; set; }
}

public class ObjectInfo
{
    public string Name { get; set; } = string.Empty;
    public float Score { get; set; }
    public BoundingBox BoundingBox { get; set; } = new();
}

public class LogoInfo
{
    public string Description { get; set; } = string.Empty;
    public float Score { get; set; }
    public BoundingBox BoundingBox { get; set; } = new();
}

public class BarcodeInfo
{
    public string RawValue { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty; // EAN_13, UPC_A, QR_CODE, vb.
}

public class BoundingBox
{
    public List<Vertex> Vertices { get; set; } = new();
}

public class Vertex
{
    public int X { get; set; }
    public int Y { get; set; }
}

// ========================================
// SERPAPI GOOGLE LENS MODELLERİ
// ========================================

public class SerpApiGoogleLensResponse
{
    [JsonPropertyName("visual_matches")]
    public List<SerpApiVisualMatch>? VisualMatches { get; set; }
    
    [JsonPropertyName("text_results")]
    public List<SerpApiTextResult>? TextResults { get; set; }
    
    [JsonPropertyName("search_information")]
    public SerpApiSearchInformation? SearchInformation { get; set; }
}

public class SerpApiVisualMatch
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
    
    [JsonPropertyName("link")]
    public string? Link { get; set; }
    
    [JsonPropertyName("source")]
    public string? Source { get; set; }
    
    [JsonPropertyName("thumbnail")]
    public string? Thumbnail { get; set; }
}

public class SerpApiTextResult
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
    
    [JsonPropertyName("link")]
    public string? Link { get; set; }
    
    [JsonPropertyName("snippet")]
    public string? Snippet { get; set; }
}

public class SerpApiSearchInformation
{
    [JsonPropertyName("total_results")]
    public long? TotalResults { get; set; }
    
    [JsonPropertyName("query_displayed")]
    public string? QueryDisplayed { get; set; }
}

// ========================================
// GOOGLE CUSTOM SEARCH MODELLERİ
// ========================================

public class GoogleCustomSearchResponse
{
    [JsonPropertyName("items")]
    public List<GoogleCustomSearchItem>? Items { get; set; }
    
    [JsonPropertyName("searchInformation")]
    public GoogleCustomSearchInformation? SearchInformation { get; set; }
}

public class GoogleCustomSearchItem
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
    
    [JsonPropertyName("link")]
    public string? Link { get; set; }
    
    [JsonPropertyName("snippet")]
    public string? Snippet { get; set; }
    
    [JsonPropertyName("displayLink")]
    public string? DisplayLink { get; set; }
}

public class GoogleCustomSearchInformation
{
    [JsonPropertyName("totalResults")]
    public string? TotalResults { get; set; }
    
    [JsonPropertyName("searchTime")]
    public double? SearchTime { get; set; }
}

