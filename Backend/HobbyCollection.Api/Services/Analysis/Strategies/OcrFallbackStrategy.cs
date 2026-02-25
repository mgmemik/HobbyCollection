using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// OCR Fallback stratejisi (son çare)
/// </summary>
public class OcrFallbackStrategy : IIdentificationStrategy
{
    private readonly ILogger<OcrFallbackStrategy> _logger;

    public OcrFallbackStrategy(ILogger<OcrFallbackStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 8; // En düşük öncelik (fallback)
    public string StrategyName => "OcrFallback";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // Her zaman handle edebilir (fallback)
        return true;
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {ocrResult.ProductName}");
        return ocrResult;
    }
}

