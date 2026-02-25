using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// Web Search + OCR Brand kombinasyon stratejisi
/// </summary>
public class WebSearchWithOcrBrandStrategy : IIdentificationStrategy
{
    private readonly ILogger<WebSearchWithOcrBrandStrategy> _logger;

    public WebSearchWithOcrBrandStrategy(ILogger<WebSearchWithOcrBrandStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 4;
    public string StrategyName => "WebSearchWithOcrBrand";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // Web Search sonuçları var ama brand/model eksik, OCR'dan brand var
        return webSearchResult.Confidence > 0.65 &&
               string.IsNullOrEmpty(webSearchResult.Brand) &&
               !string.IsNullOrEmpty(ocrResult.Brand);
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        var result = webSearchResult;
        result.Brand = ocrResult.Brand; // OCR'dan brand ekle
        
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {result.ProductName}");
        return result;
    }
}

