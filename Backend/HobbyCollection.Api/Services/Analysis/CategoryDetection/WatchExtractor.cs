using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Saat kategorisi için özel bilgi çıkarıcı
/// </summary>
public class WatchExtractor : ICategorySpecificExtractor
{
    private readonly ILogger<WatchExtractor> _logger;

    public WatchExtractor(ILogger<WatchExtractor> logger)
    {
        _logger = logger;
    }

    public ProductCategory Category => ProductCategory.Watch;

    public Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult)
    {
        var result = new Models.CategorySpecificData();
        var ocrText = data.OcrText.ToUpper();
        var searchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}")).ToUpper();
        var allText = $"{ocrText} {searchText}";

        // Saat tipi tespit et (Analog/Digital/Hybrid)
        var labels = data.VisionResults
            .SelectMany(v => v.Labels ?? new List<LabelInfo>())
            .ToList();

        if (labels.Any(l => l.Description.Contains("Analog", StringComparison.OrdinalIgnoreCase)))
        {
            result.WatchType = "Analog";
            _logger.LogInformation($"[WATCH] Saat tipi: Analog");
        }
        else if (labels.Any(l => l.Description.Contains("Digital", StringComparison.OrdinalIgnoreCase)))
        {
            result.WatchType = "Digital";
            _logger.LogInformation($"[WATCH] Saat tipi: Digital");
        }
        else if (ocrText.Contains("LCD") || ocrText.Contains("LED"))
        {
            result.WatchType = "Digital";
            _logger.LogInformation($"[WATCH] Saat tipi: Digital (OCR'dan)");
        }

        // Hareket tipi (Quartz/Automatic/Mechanical)
        if (ocrText.Contains("QUARTZ"))
        {
            result.Movement = "Quartz";
            _logger.LogInformation($"[WATCH] Hareket tipi: Quartz");
        }
        else if (allText.Contains("AUTOMATIC"))
        {
            result.Movement = "Automatic";
            _logger.LogInformation($"[WATCH] Hareket tipi: Automatic");
        }
        else if (allText.Contains("MECHANICAL"))
        {
            result.Movement = "Mechanical";
            _logger.LogInformation($"[WATCH] Hareket tipi: Mechanical");
        }

        // Yıl çıkar (4 haneli sayılar 1900-2025 arası)
        var yearPattern = @"\b(19\d{2}|20[0-2]\d)\b";
        var yearMatches = Regex.Matches(allText, yearPattern);
        if (yearMatches.Count > 0)
        {
            var mostCommonYear = yearMatches
                .Cast<Match>()
                .Select(m => m.Value)
                .GroupBy(y => y)
                .OrderByDescending(g => g.Count())
                .First()
                .Key;
            
            result.Year = mostCommonYear;
            _logger.LogInformation($"[WATCH] Yıl bulundu: {result.Year}");
        }

        return result;
    }
}

