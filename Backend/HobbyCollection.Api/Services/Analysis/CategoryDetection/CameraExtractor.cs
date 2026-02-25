using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Kamera kategorisi için özel bilgi çıkarıcı
/// </summary>
public class CameraExtractor : ICategorySpecificExtractor
{
    private readonly ILogger<CameraExtractor> _logger;

    public CameraExtractor(ILogger<CameraExtractor> logger)
    {
        _logger = logger;
    }

    public ProductCategory Category => ProductCategory.Camera;

    public Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult)
    {
        var result = new Models.CategorySpecificData();
        var ocrText = data.OcrText.ToUpper();
        var searchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}")).ToUpper();
        var allText = $"{ocrText} {searchText}";

        // Kamera tipi tespit et
        var labels = data.VisionResults
            .SelectMany(v => v.Labels ?? new List<LabelInfo>())
            .Select(l => l.Description.ToLower())
            .ToList();

        if (labels.Any(l => l.Contains("instant camera")) || ocrText.Contains("INSTANT") || ocrText.Contains("POLAROID"))
        {
            result.CameraType = "Instant Camera";
            _logger.LogInformation($"[CAMERA] Tip: Instant Camera");
        }
        else if (labels.Any(l => l.Contains("slr")) || allText.Contains("SLR") || allText.Contains("REFLEX"))
        {
            result.CameraType = "SLR";
            _logger.LogInformation($"[CAMERA] Tip: SLR");
        }
        else if (labels.Any(l => l.Contains("digital camera")) || allText.Contains("DIGITAL"))
        {
            result.CameraType = "Digital Camera";
            _logger.LogInformation($"[CAMERA] Tip: Digital Camera");
        }
        else if (allText.Contains("FILM") || allText.Contains("35MM"))
        {
            result.CameraType = "Film Camera";
            _logger.LogInformation($"[CAMERA] Tip: Film Camera");
        }

        // Lens mount tespit et (Canon EF, Nikon F, vb.)
        var lensMountPatterns = new[]
        {
            @"CANON\s+EF",
            @"NIKON\s+F",
            @"SONY\s+E",
            @"OLYMPUS\s+OM",
            @"PENTAX\s+K",
        };

        foreach (var pattern in lensMountPatterns)
        {
            if (Regex.IsMatch(allText, pattern))
            {
                result.LensMount = Regex.Match(allText, pattern).Value;
                _logger.LogInformation($"[CAMERA] Lens Mount: {result.LensMount}");
                break;
            }
        }

        // Yıl çıkar
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
            _logger.LogInformation($"[CAMERA] Yıl bulundu: {result.Year}");
        }

        return result;
    }
}

