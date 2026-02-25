using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IOcrExtractionService
    {
        List<string> ExtractPotentialBrands(string ocrText);
        List<string> ExtractPotentialModels(string ocrText);
        List<string> ExtractProductTypes(string ocrText);
        ProductIdentificationResult ExtractProductFromOCR(AnalysisDataCollection data);
    }
}

