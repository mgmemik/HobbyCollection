using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Ürün kategorisini tespit eden servis
/// </summary>
public class CategoryDetectionService
{
    private readonly ILogger<CategoryDetectionService> _logger;

    public CategoryDetectionService(ILogger<CategoryDetectionService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Vision API ve OCR verilerinden ürün kategorisini tespit et
    /// </summary>
    public ProductCategory DetectCategory(AnalysisDataCollection data)
    {
        var categoryScores = new Dictionary<ProductCategory, double>();

        // Vision Labels'dan kategori tespit et
        var labels = data.VisionResults
            .SelectMany(v => v.Labels ?? new List<LabelInfo>())
            .ToList();

        foreach (var label in labels)
        {
            var labelLower = label.Description.ToLower();
            
            // Kitap kategorisi
            if (labelLower.Contains("book") || labelLower.Contains("publication") || 
                labelLower.Contains("novel") || labelLower.Contains("magazine") ||
                labelLower.Contains("comic"))
            {
                categoryScores[ProductCategory.Book] = 
                    categoryScores.GetValueOrDefault(ProductCategory.Book, 0) + label.Score;
            }
            
            // Para/Pul kategorisi
            if (labelLower.Contains("coin") || labelLower.Contains("currency") || 
                labelLower.Contains("money") || labelLower.Contains("banknote") ||
                labelLower.Contains("stamp") || labelLower.Contains("postage"))
            {
                var category = labelLower.Contains("stamp") ? ProductCategory.Stamp : ProductCategory.Coin;
                categoryScores[category] = 
                    categoryScores.GetValueOrDefault(category, 0) + label.Score;
            }
            
            // Saat kategorisi
            if (labelLower.Contains("watch") || labelLower.Contains("clock") || 
                labelLower.Contains("timepiece"))
            {
                categoryScores[ProductCategory.Watch] = 
                    categoryScores.GetValueOrDefault(ProductCategory.Watch, 0) + label.Score;
            }
            
            // Oyun kategorisi
            if (labelLower.Contains("game") || labelLower.Contains("console") || 
                labelLower.Contains("controller") || labelLower.Contains("cartridge"))
            {
                categoryScores[ProductCategory.VideoGame] = 
                    categoryScores.GetValueOrDefault(ProductCategory.VideoGame, 0) + label.Score;
            }
            
            // Kamera kategorisi
            if (labelLower.Contains("camera") || labelLower.Contains("lens") || 
                labelLower.Contains("photography"))
            {
                categoryScores[ProductCategory.Camera] = 
                    categoryScores.GetValueOrDefault(ProductCategory.Camera, 0) + label.Score;
            }
            
            // Oyuncak kategorisi
            if (labelLower.Contains("toy") || labelLower.Contains("doll") || 
                labelLower.Contains("figure") || labelLower.Contains("robot"))
            {
                categoryScores[ProductCategory.Toy] = 
                    categoryScores.GetValueOrDefault(ProductCategory.Toy, 0) + label.Score;
            }
        }

        // OCR'dan kategori tespit et (ek ipuçları)
        var ocrText = data.OcrText.ToUpper();
        
        if (ocrText.Contains("ISBN") || ocrText.Contains("CHAPTER") || ocrText.Contains("PAGE"))
            categoryScores[ProductCategory.Book] = categoryScores.GetValueOrDefault(ProductCategory.Book, 0) + 0.3;
        
        if (ocrText.Contains("CENT") || ocrText.Contains("DOLLAR") || ocrText.Contains("EURO"))
            categoryScores[ProductCategory.Coin] = categoryScores.GetValueOrDefault(ProductCategory.Coin, 0) + 0.3;
        
        if (ocrText.Contains("POSTAGE") || ocrText.Contains("STAMP"))
            categoryScores[ProductCategory.Stamp] = categoryScores.GetValueOrDefault(ProductCategory.Stamp, 0) + 0.3;
        
        if (ocrText.Contains("QUARTZ") || ocrText.Contains("AUTOMATIC"))
            categoryScores[ProductCategory.Watch] = categoryScores.GetValueOrDefault(ProductCategory.Watch, 0) + 0.3;

        // En yüksek skora sahip kategoriyi döndür
        if (categoryScores.Any())
        {
            var detectedCategory = categoryScores.OrderByDescending(kvp => kvp.Value).First().Key;
            var confidence = categoryScores[detectedCategory];
            
            _logger.LogInformation($"[CATEGORY] Tespit edilen kategori: {detectedCategory} (Confidence: {confidence:F3})");
            return detectedCategory;
        }

        _logger.LogInformation($"[CATEGORY] Kategori tespit edilemedi, General kullanılıyor");
        return ProductCategory.General;
    }
}

/// <summary>
/// Ürün kategorileri
/// </summary>
public enum ProductCategory
{
    General,        // Genel ürün (varsayılan)
    Book,           // Kitap
    Coin,           // Para
    Stamp,          // Pul
    Watch,          // Saat
    Camera,         // Kamera
    VideoGame,      // Video oyunu
    Toy,            // Oyuncak
    Electronics,    // Elektronik
    Collectible     // Koleksiyon ürünü
}
