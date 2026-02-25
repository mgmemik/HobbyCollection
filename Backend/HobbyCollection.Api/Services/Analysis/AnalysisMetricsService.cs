using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis;

/// <summary>
/// Analiz metriklerini toplayan ve raporlayan servis
/// </summary>
public class AnalysisMetricsService
{
    private readonly ILogger<AnalysisMetricsService> _logger;
    private static readonly Dictionary<string, AnalysisMetrics> _metrics = new();
    private static readonly object _metricsLock = new object();

    public AnalysisMetricsService(ILogger<AnalysisMetricsService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Analiz sonucunu kaydet
    /// </summary>
    public void RecordAnalysisResult(ProductIdentificationResult result, AnalysisDataCollection data, TimeSpan processingTime)
    {
        lock (_metricsLock)
        {
            var today = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");
            
            if (!_metrics.ContainsKey(today))
            {
                _metrics[today] = new AnalysisMetrics
                {
                    Date = today,
                    TotalAnalyses = 0,
                    SuccessfulIdentifications = 0,
                    FailedIdentifications = 0,
                    AverageConfidence = 0.0,
                    AverageProcessingTime = TimeSpan.Zero,
                    ConfidenceDistribution = new Dictionary<string, int>(),
                    StrategyUsage = new Dictionary<string, int>(),
                    ErrorCount = 0
                };
            }

            var metrics = _metrics[today];
            metrics.TotalAnalyses++;
            metrics.AverageProcessingTime = TimeSpan.FromMilliseconds(
                (metrics.AverageProcessingTime.TotalMilliseconds * (metrics.TotalAnalyses - 1) + processingTime.TotalMilliseconds) / metrics.TotalAnalyses
            );

            // Confidence dağılımı
            var confidenceRange = GetConfidenceRange(result.Confidence);
            if (!metrics.ConfidenceDistribution.ContainsKey(confidenceRange))
                metrics.ConfidenceDistribution[confidenceRange] = 0;
            metrics.ConfidenceDistribution[confidenceRange]++;

            // Başarılı/başarısız sayısı
            if (result.Confidence >= 0.5 && !string.IsNullOrEmpty(result.ProductName) && result.ProductName != "Bilinmeyen Ürün")
            {
                metrics.SuccessfulIdentifications++;
            }
            else
            {
                metrics.FailedIdentifications++;
            }

            // Ortalama confidence
            metrics.AverageConfidence = (metrics.AverageConfidence * (metrics.TotalAnalyses - 1) + result.Confidence) / metrics.TotalAnalyses;

            // Strategy kullanımı (reasoning'den çıkar)
            if (!string.IsNullOrEmpty(result.Reasoning))
            {
                var strategy = ExtractStrategyFromReasoning(result.Reasoning);
                if (!string.IsNullOrEmpty(strategy))
                {
                    if (!metrics.StrategyUsage.ContainsKey(strategy))
                        metrics.StrategyUsage[strategy] = 0;
                    metrics.StrategyUsage[strategy]++;
                }
            }
        }
    }

    /// <summary>
    /// Hata kaydet
    /// </summary>
    public void RecordError(string errorType, string errorMessage)
    {
        lock (_metricsLock)
        {
            var today = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");
            
            if (!_metrics.ContainsKey(today))
            {
                _metrics[today] = new AnalysisMetrics { Date = today };
            }

            _metrics[today].ErrorCount++;
            _logger.LogWarning($"[METRICS] Hata kaydedildi: {errorType} - {errorMessage}");
        }
    }

    /// <summary>
    /// Bugünkü metrikleri al
    /// </summary>
    public AnalysisMetrics GetTodayMetrics()
    {
        lock (_metricsLock)
        {
            var today = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");
            return _metrics.ContainsKey(today) ? _metrics[today] : new AnalysisMetrics { Date = today };
        }
    }

    /// <summary>
    /// Tüm metrikleri al
    /// </summary>
    public Dictionary<string, AnalysisMetrics> GetAllMetrics()
    {
        lock (_metricsLock)
        {
            return new Dictionary<string, AnalysisMetrics>(_metrics);
        }
    }

    /// <summary>
    /// Metrikleri logla
    /// </summary>
    public void LogMetrics()
    {
        var metrics = GetTodayMetrics();
        
        _logger.LogInformation($"[METRICS] === Bugünkü Analiz Metrikleri ({metrics.Date}) ===");
        _logger.LogInformation($"[METRICS] Toplam Analiz: {metrics.TotalAnalyses}");
        _logger.LogInformation($"[METRICS] Başarılı: {metrics.SuccessfulIdentifications} ({GetPercentage(metrics.SuccessfulIdentifications, metrics.TotalAnalyses):F1}%)");
        _logger.LogInformation($"[METRICS] Başarısız: {metrics.FailedIdentifications} ({GetPercentage(metrics.FailedIdentifications, metrics.TotalAnalyses):F1}%)");
        _logger.LogInformation($"[METRICS] Ortalama Confidence: {metrics.AverageConfidence:F3}");
        _logger.LogInformation($"[METRICS] Ortalama İşlem Süresi: {metrics.AverageProcessingTime.TotalMilliseconds:F0}ms");
        _logger.LogInformation($"[METRICS] Hata Sayısı: {metrics.ErrorCount}");
        
        if (metrics.ConfidenceDistribution.Any())
        {
            _logger.LogInformation($"[METRICS] Confidence Dağılımı:");
            foreach (var kvp in metrics.ConfidenceDistribution.OrderBy(k => k.Key))
            {
                _logger.LogInformation($"[METRICS]   {kvp.Key}: {kvp.Value}");
            }
        }
        
        if (metrics.StrategyUsage.Any())
        {
            _logger.LogInformation($"[METRICS] Strateji Kullanımı:");
            foreach (var kvp in metrics.StrategyUsage.OrderByDescending(k => k.Value))
            {
                _logger.LogInformation($"[METRICS]   {kvp.Key}: {kvp.Value}");
            }
        }
        
        _logger.LogInformation($"[METRICS] ==========================================");
    }

    private string GetConfidenceRange(double confidence)
    {
        if (confidence >= 0.9) return "0.9-1.0";
        if (confidence >= 0.8) return "0.8-0.9";
        if (confidence >= 0.7) return "0.7-0.8";
        if (confidence >= 0.6) return "0.6-0.7";
        if (confidence >= 0.5) return "0.5-0.6";
        if (confidence >= 0.3) return "0.3-0.5";
        return "0.0-0.3";
    }

    private string ExtractStrategyFromReasoning(string reasoning)
    {
        if (reasoning.Contains("Web Search", StringComparison.OrdinalIgnoreCase))
            return "WebSearch";
        if (reasoning.Contains("OCR", StringComparison.OrdinalIgnoreCase))
            return "OCR";
        if (reasoning.Contains("Labels", StringComparison.OrdinalIgnoreCase))
            return "Labels";
        if (reasoning.Contains("Web Detection", StringComparison.OrdinalIgnoreCase))
            return "WebDetection";
        if (reasoning.Contains("Fallback", StringComparison.OrdinalIgnoreCase))
            return "Fallback";
        return "Unknown";
    }

    private double GetPercentage(int value, int total)
    {
        return total > 0 ? (value * 100.0 / total) : 0.0;
    }
}

/// <summary>
/// Analiz metrikleri modeli
/// </summary>
public class AnalysisMetrics
{
    public string Date { get; set; } = string.Empty;
    public int TotalAnalyses { get; set; }
    public int SuccessfulIdentifications { get; set; }
    public int FailedIdentifications { get; set; }
    public double AverageConfidence { get; set; }
    public TimeSpan AverageProcessingTime { get; set; }
    public Dictionary<string, int> ConfidenceDistribution { get; set; } = new();
    public Dictionary<string, int> StrategyUsage { get; set; } = new();
    public int ErrorCount { get; set; }
}

