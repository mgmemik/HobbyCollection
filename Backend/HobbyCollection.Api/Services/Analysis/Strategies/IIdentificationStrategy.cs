using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis.Strategies;

/// <summary>
/// Ürün tanıma stratejileri için interface
/// </summary>
public interface IIdentificationStrategy
{
    /// <summary>
    /// Bu strateji bu veri için uygun mu?
    /// </summary>
    bool CanHandle(AnalysisDataCollection data, ProductIdentificationResult ocrResult, 
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult, 
        ProductIdentificationResult webSearchResult);
    
    /// <summary>
    /// Ürünü tanımla
    /// </summary>
    ProductIdentificationResult Identify(AnalysisDataCollection data, ProductIdentificationResult ocrResult,
        ProductIdentificationResult labelsResult, ProductIdentificationResult webResult,
        ProductIdentificationResult webSearchResult);
    
    /// <summary>
    /// Strateji önceliği (düşük sayı = yüksek öncelik)
    /// </summary>
    int Priority { get; }
    
    /// <summary>
    /// Strateji adı (logging için)
    /// </summary>
    string StrategyName { get; }
}

