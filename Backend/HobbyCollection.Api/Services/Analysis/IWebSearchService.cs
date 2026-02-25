using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IWebSearchService
    {
        List<string> GenerateSearchQueries(AnalysisDataCollection data);
        Task<List<SerpResult>> SearchWebForProductAsync(string query, int maxResults);
        Task<List<SerpResult>> ScrapeGoogleImagesReverseSearchAsync(string base64Image, string fileName);
    }
}

