using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// Web Detection stratejisi
/// </summary>
public class WebDetectionStrategy : IIdentificationStrategy
{
    private readonly ILogger<WebDetectionStrategy> _logger;

    public WebDetectionStrategy(ILogger<WebDetectionStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 6;
    public string StrategyName => "WebDetection";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // Web Detection en yüksekse
        return webResult.Confidence > Math.Max(ocrResult.Confidence, labelsResult.Confidence);
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {webResult.ProductName}");
        return webResult;
    }
}

