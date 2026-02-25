using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IAiEnrichmentService
    {
        Task<ProductIdentificationResult> IdentifyProductWithAIAsync(AnalysisDataCollection data, string language = "en");
    }
}

