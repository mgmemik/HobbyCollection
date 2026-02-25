using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IProductIdentificationService
    {
        Task<ProductIdentificationResult> IdentifyProductAdvancedAsync(AnalysisDataCollection data, string language = "en");
        Task<ProductIdentificationResult> IdentifyFromWebSearchResultsAsync(AnalysisDataCollection data);
        ProductIdentificationResult IdentifyFromWebDetection(AnalysisDataCollection data);
        ProductIdentificationResult IdentifyFromVisionLabels(AnalysisDataCollection data);
        ProductIdentificationResult IdentifyProductSimple(AnalysisDataCollection data);
        ProductIdentificationResult CombineResults(ProductIdentificationResult ocrResult, ProductIdentificationResult labelsResult);
    }
}

