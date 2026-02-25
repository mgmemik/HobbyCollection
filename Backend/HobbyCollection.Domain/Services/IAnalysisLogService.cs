using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Services;

public interface IAnalysisLogService
{
    Task<string> StartAnalysisAsync(string userId, int photoCount, string language = "en");
    Task AddLogEntryAsync(string analysisLogId, string step, string stepName, string message, string level = "Information", string? data = null, long? durationMs = null);
    Task CompleteAnalysisAsync(string analysisLogId, string? productId, string? finalProductName, double? finalConfidence, string? detectedCategory, long processingTimeMs, bool isSuccessful, string? errorMessage = null);
}

