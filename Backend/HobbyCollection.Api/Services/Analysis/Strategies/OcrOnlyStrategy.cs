using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// Sadece OCR stratejisi
/// </summary>
public class OcrOnlyStrategy : IIdentificationStrategy
{
    private readonly ILogger<OcrOnlyStrategy> _logger;

    public OcrOnlyStrategy(ILogger<OcrOnlyStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 3;
    public string StrategyName => "OcrOnly";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // OCR net bir ürün bulmuşsa ama Web Search ile uyumlu değilse
        return ocrResult.Confidence > 0.7 && 
               !string.IsNullOrEmpty(ocrResult.Brand) && 
               !string.IsNullOrEmpty(ocrResult.Model);
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {ocrResult.ProductName}");
        return ocrResult;
    }
}

