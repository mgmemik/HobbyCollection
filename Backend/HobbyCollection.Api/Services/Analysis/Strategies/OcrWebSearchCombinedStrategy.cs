using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// OCR + Web Search kombinasyon stratejisi
/// </summary>
public class OcrWebSearchCombinedStrategy : IIdentificationStrategy
{
    private readonly ILogger<OcrWebSearchCombinedStrategy> _logger;

    public OcrWebSearchCombinedStrategy(ILogger<OcrWebSearchCombinedStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 2;
    public string StrategyName => "OcrWebSearchCombined";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // OCR net bir ürün bulmuşsa (brand + model) VE Web Search ile uyumluysa
        return ocrResult.Confidence > 0.7 && 
               !string.IsNullOrEmpty(ocrResult.Brand) && 
               !string.IsNullOrEmpty(ocrResult.Model) &&
               webSearchResult.Confidence > 0.6 &&
               SimilarProducts(ocrResult.ProductName, webSearchResult.ProductName);
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // Web Search'in daha detaylı ismini kullan
        var result = webSearchResult;
        result.Brand = ocrResult.Brand; // OCR'dan brand'i koru
        result.Confidence = HobbyCollection.Api.Services.Analysis.ConfidenceCalculator.CalculateCombinedConfidence(
            confidence1: ocrResult.Confidence,
            confidence2: webSearchResult.Confidence,
            areCompatible: true
        );
        
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {result.ProductName}");
        return result;
    }

    private static bool SimilarProducts(string product1, string product2)
    {
        if (string.IsNullOrEmpty(product1) || string.IsNullOrEmpty(product2))
            return false;

        var words1 = product1.ToUpper().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var words2 = product2.ToUpper().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        
        var commonWords = words1.Intersect(words2).Count();
        return commonWords >= 2; // En az 2 ortak kelime
    }
}

