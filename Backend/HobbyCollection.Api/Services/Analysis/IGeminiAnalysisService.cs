using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IGeminiAnalysisService
    {
        Task<GeminiAnalysisResult> AnalyzeProductAsync(byte[] imageBytes, string language = "en");
        Task<PriceEstimationResult> EstimatePriceAsync(string productDescription, string language = "en");
        Task<CategorySuggestionResult> SuggestCategoryAsync(string productText, IReadOnlyList<CategoryCandidate> candidates, string language = "en");
    }

    public class GeminiAnalysisResult
    {
        public string Description { get; set; } = string.Empty;
        public List<string> Hashtags { get; set; } = new List<string>();
        public double Confidence { get; set; }
        public string? Error { get; set; }
    }

    public class PriceEstimationResult
    {
        public decimal? EstimatedPrice { get; set; }
        public string? Currency { get; set; }
        public string? Error { get; set; }
        public string? Reasoning { get; set; }
    }

    public sealed class CategoryCandidate
    {
        public string Id { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty; // "Root / Child / Leaf"
    }

    public class CategorySuggestionResult
    {
        public string? CategoryId { get; set; }
        public double? Confidence { get; set; }
        public string? Reasoning { get; set; }
        public string? Error { get; set; }
    }
}

