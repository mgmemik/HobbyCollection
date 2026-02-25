using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis;

/// <summary>
/// Confidence skorlarını standardize eden servis
/// Tüm servislerde tutarlı confidence hesaplaması için kullanılır
/// </summary>
public static class ConfidenceCalculator
{
    /// <summary>
    /// OCR sonuçları için confidence hesaplar
    /// </summary>
    public static double CalculateOcrConfidence(bool hasBrand, bool hasModel, int ocrLength, int brandCount = 1, int modelCount = 1)
    {
        double confidence = 0.3; // Base confidence
        
        // Brand varsa +0.25
        if (hasBrand)
        {
            confidence += 0.25;
            // Birden fazla brand varsa biraz daha artır
            if (brandCount > 1) confidence += 0.05;
        }
        
        // Model varsa +0.25
        if (hasModel)
        {
            confidence += 0.25;
            // Birden fazla model varsa biraz daha artır
            if (modelCount > 1) confidence += 0.05;
        }
        
        // OCR uzunluğu uzunsa +0.1 (daha fazla bilgi var)
        if (ocrLength > 50) confidence += 0.1;
        else if (ocrLength > 20) confidence += 0.05;
        
        // Brand + Model birlikte varsa bonus
        if (hasBrand && hasModel) confidence += 0.1;
        
        return Math.Min(confidence, 0.95); // Maksimum 0.95
    }
    
    /// <summary>
    /// Web Search sonuçları için confidence hesaplar
    /// </summary>
    public static double CalculateWebSearchConfidence(int matchCount, bool hasBrand, bool hasModel, bool hasBrandModelCombination, int totalResults = 0)
    {
        double confidence = 0.4; // Base confidence
        
        // Match sayısına göre confidence artır
        if (matchCount >= 10) confidence += 0.35;
        else if (matchCount >= 5) confidence += 0.25;
        else if (matchCount >= 3) confidence += 0.15;
        else if (matchCount >= 2) confidence += 0.10;
        else if (matchCount >= 1) confidence += 0.05;
        
        // Brand varsa +0.15
        if (hasBrand) confidence += 0.15;
        
        // Model varsa +0.15
        if (hasModel) confidence += 0.15;
        
        // Brand+Model kombinasyonu varsa bonus
        if (hasBrandModelCombination) confidence += 0.10;
        
        // Toplam sonuç sayısına göre (daha fazla sonuç = daha güvenilir)
        if (totalResults > 50) confidence += 0.05;
        else if (totalResults > 20) confidence += 0.03;
        
        return Math.Min(confidence, 0.95); // Maksimum 0.95
    }
    
    /// <summary>
    /// Vision Labels için confidence hesaplar
    /// </summary>
    public static double CalculateLabelsConfidence(double topLabelScore, int labelCount, bool isSpecificProduct = false)
    {
        double confidence = topLabelScore * 0.7; // Vision API score'unu %70'e indir (çünkü genel kategoriler)
        
        // Spesifik ürün ise (Game Boy, PlayStation gibi) bonus
        if (isSpecificProduct) confidence += 0.20;
        
        // Birden fazla label varsa biraz daha artır
        if (labelCount > 5) confidence += 0.05;
        else if (labelCount > 3) confidence += 0.03;
        
        return Math.Min(confidence, 0.90); // Maksimum 0.90 (labels genelde genel kategoriler)
    }
    
    /// <summary>
    /// Web Detection (Web Entities) için confidence hesaplar
    /// </summary>
    public static double CalculateWebDetectionConfidence(double webEntityScore, bool hasBestGuess, bool hasMultipleEntities = false)
    {
        double confidence = webEntityScore * 0.75; // Vision API score'unu %75'e indir
        
        // BestGuess varsa bonus
        if (hasBestGuess) confidence += 0.10;
        
        // Birden fazla entity varsa biraz daha artır
        if (hasMultipleEntities) confidence += 0.05;
        
        return Math.Min(confidence, 0.85); // Maksimum 0.85
    }
    
    /// <summary>
    /// Kombine sonuçlar için confidence hesaplar (örn: OCR + Web Search)
    /// </summary>
    public static double CalculateCombinedConfidence(double confidence1, double confidence2, bool areCompatible = true)
    {
        if (!areCompatible)
        {
            // Uyumsuzsa daha düşük confidence
            return Math.Max(confidence1, confidence2) * 0.8;
        }
        
        // Uyumluysa ortalamadan biraz daha yüksek
        var average = (confidence1 + confidence2) / 2.0;
        return Math.Min(average + 0.05, 0.95); // Ortalama + 0.05 bonus
    }
    
    /// <summary>
    /// Fallback confidence (en düşük güvenilirlik)
    /// </summary>
    public static double CalculateFallbackConfidence(double baseScore = 0.3)
    {
        return Math.Min(baseScore, 0.50); // Maksimum 0.50 (fallback için düşük)
    }
}

