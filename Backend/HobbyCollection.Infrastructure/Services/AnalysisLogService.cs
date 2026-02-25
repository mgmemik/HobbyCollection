using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Services;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Infrastructure.Services;

public class AnalysisLogService : IAnalysisLogService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<AnalysisLogService> _logger;
    private int _entryOrderCounter = 0;

    public AnalysisLogService(AppDbContext dbContext, ILogger<AnalysisLogService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<string> StartAnalysisAsync(string userId, int photoCount, string language = "en")
    {
        try
        {
            var analysisLog = new AnalysisLog
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                Language = language,
                PhotoCount = photoCount,
                CreatedAtUtc = DateTime.UtcNow
            };

            _dbContext.AnalysisLogs.Add(analysisLog);
            await _dbContext.SaveChangesAsync();

            _entryOrderCounter = 0; // Reset counter for new analysis
            _logger.LogInformation("Analysis log started: {AnalysisLogId} for user {UserId}", analysisLog.Id, userId);
            
            return analysisLog.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start analysis log");
            throw;
        }
    }

    public async Task AddLogEntryAsync(string analysisLogId, string step, string stepName, string message, string level = "Information", string? data = null, long? durationMs = null)
    {
        try
        {
            var entry = new AnalysisLogEntry
            {
                Id = Guid.NewGuid().ToString(),
                AnalysisLogId = analysisLogId,
                Step = step,
                StepName = stepName,
                Message = message,
                Level = level,
                Data = data,
                DurationMs = durationMs,
                Order = ++_entryOrderCounter,
                CreatedAtUtc = DateTime.UtcNow
            };

            _dbContext.AnalysisLogEntries.Add(entry);
            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add log entry for analysis {AnalysisLogId}", analysisLogId);
            // Don't throw - log failures shouldn't break the analysis
        }
    }

    public async Task CompleteAnalysisAsync(string analysisLogId, string? productId, string? finalProductName, double? finalConfidence, string? detectedCategory, long processingTimeMs, bool isSuccessful, string? errorMessage = null)
    {
        try
        {
            var analysisLog = await _dbContext.AnalysisLogs.FindAsync(analysisLogId);
            if (analysisLog == null)
            {
                _logger.LogWarning("Analysis log not found: {AnalysisLogId}", analysisLogId);
                return;
            }

            analysisLog.ProductId = productId;
            analysisLog.FinalProductName = finalProductName;
            analysisLog.FinalConfidence = finalConfidence;
            analysisLog.DetectedCategory = detectedCategory;
            analysisLog.ProcessingTimeMs = processingTimeMs;
            analysisLog.IsSuccessful = isSuccessful;
            analysisLog.ErrorMessage = errorMessage;

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Analysis log completed: {AnalysisLogId}, Success: {IsSuccessful}", analysisLogId, isSuccessful);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to complete analysis log {AnalysisLogId}", analysisLogId);
            // Don't throw - log failures shouldn't break the analysis
        }
    }
}

