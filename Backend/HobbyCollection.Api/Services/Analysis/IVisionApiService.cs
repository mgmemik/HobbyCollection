using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis
{
    public interface IVisionApiService
    {
        Task<VisionAnalysisData> AnalyzePhotoAsync(IFormFile photo);
    }
}

