using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// Web Search yüksek confidence stratejisi (EN ÖNEMLİ!)
/// </summary>
public class WebSearchHighConfidenceStrategy : IIdentificationStrategy
{
    private readonly ILogger<WebSearchHighConfidenceStrategy> _logger;

    public WebSearchHighConfidenceStrategy(ILogger<WebSearchHighConfidenceStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 1; // En yüksek öncelik
    public string StrategyName => "WebSearchHighConfidence";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // Web Search sonuçları yüksek confidence ile brand+model bulduysa
        return webSearchResult.Confidence > 0.75 && 
               !string.IsNullOrEmpty(webSearchResult.Brand) && 
               !string.IsNullOrEmpty(webSearchResult.Model);
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {webSearchResult.ProductName}");
        return webSearchResult;
    }
}

