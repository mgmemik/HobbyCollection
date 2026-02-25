using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IHashtagGenerationService
    {
        string GenerateEnhancedHashtags(ProductIdentificationResult result, AnalysisDataCollection data);
    }
}

