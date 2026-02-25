using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// Labels stratejisi
/// </summary>
public class LabelsStrategy : IIdentificationStrategy
{
    private readonly ILogger<LabelsStrategy> _logger;

    public LabelsStrategy(ILogger<LabelsStrategy> logger)
    {
        _logger = logger;
    }

    public int Priority => 7;
    public string StrategyName => "Labels";

    public bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        // Labels en yüksekse
        return labelsResult.Confidence > ocrResult.Confidence;
    }

    public ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult)
    {
        _logger.LogInformation($"[STRATEGY] {StrategyName} seçildi: {labelsResult.ProductName}");
        return labelsResult;
    }
}

