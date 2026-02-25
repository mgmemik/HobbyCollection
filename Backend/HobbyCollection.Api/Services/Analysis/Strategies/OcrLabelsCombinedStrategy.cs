using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// OCR + Labels kombinasyon stratejisi
/// </summary>
public class OcrLabelsCombinedStrategy : IIdentificationStrategy
{
    private readonly ILogger<OcrLabelsCombinedStrategy> _logger;

    public OcrLabelsCombinedStrategy(ILogger<OcrLabelsCombinedStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 5;
    public string StrategyName => "OcrLabelsCombined";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // OCR + Labels kombinasyonu (OCR'dan brand, Labels'dan kategori)
        return ocrResult.Confidence > 0.5 && labelsResult.Confidence > 0.6;
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        var result = CombineResults(ocrResult, labelsResult);
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {result.ProductName}");
        return result;
    }

    private ProductIdentificationResult CombineResults(ProductIdentificationResult ocr, ProductIdentificationResult labels)
    {
        var result = new ProductIdentificationResult
        {
            Brand = ocr.Brand,
            Model = ocr.Model,
            ProductName = !string.IsNullOrEmpty(ocr.ProductName) ? ocr.ProductName : labels.ProductName,
            Confidence = HobbyCollection.Api.Services.Analysis.ConfidenceCalculator.CalculateCombinedConfidence(ocr.Confidence, labels.Confidence, true),
            Reasoning = $"OCR: {ocr.Reasoning} + Labels: {labels.Reasoning}",
            Evidence = new List<string>(ocr.Evidence.Concat(labels.Evidence))
        };
        return result;
    }
}

