using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Pul kategorisi için özel bilgi çıkarıcı
/// </summary>
public class StampExtractor : ICategorySpecificExtractor
{
    private readonly ILogger<StampExtractor> _logger;

    public StampExtractor(ILogger<StampExtractor> logger)
    {
        _logger = logger;
    }

    public ProductCategory Category => ProductCategory.Stamp;

    public Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult)
    {
        var result = new Models.CategorySpecificData();
        var ocrText = data.OcrText.ToUpper();
        var searchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}")).ToUpper();
        var allText = $"{ocrText} {searchText}";

        // Ülke çıkar (CoinCurrencyExtractor ile aynı mantık)
        var knownCountries = new Dictionary<string, string>
        {
            { "USA", "United States" }, { "UNITED STATES", "United States" }, { "AMERICA", "United States" },
            { "UK", "United Kingdom" }, { "UNITED KINGDOM", "United Kingdom" }, { "ENGLAND", "United Kingdom" },
            { "GERMANY", "Germany" }, { "DEUTSCHLAND", "Germany" }, { "ALMANYA", "Germany" },
            { "FRANCE", "France" }, { "FRANSA", "France" },
            { "ITALY", "Italy" }, { "ITALIA", "Italy" }, { "İTALYA", "Italy" },
            { "SPAIN", "Spain" }, { "ESPAÑA", "Spain" }, { "İSPANYA", "Spain" },
            { "JAPAN", "Japan" }, { "JAPONYA", "Japan" }, { "日本", "Japan" },
            { "CHINA", "China" }, { "ÇİN", "China" }, { "中国", "China" },
            { "TURKEY", "Turkey" }, { "TÜRKİYE", "Turkey" }, { "TURKIYE", "Turkey" },
            { "RUSSIA", "Russia" }, { "RUSYA", "Russia" }, { "РОССИЯ", "Russia" },
            { "CANADA", "Canada" }, { "KANADA", "Canada" },
            { "AUSTRALIA", "Australia" }, { "AVUSTRALYA", "Australia" },
        };

        foreach (var kvp in knownCountries)
        {
            if (allText.Contains(kvp.Key))
            {
                result.Country = kvp.Value;
                _logger.LogInformation($"[STAMP] Ülke bulundu: {result.Country}");
                break;
            }
        }

        // Yıl çıkar
        var yearPattern = @"\b(1[89]\d{2}|20[0-2]\d)\b";
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
            _logger.LogInformation($"[STAMP] Yıl bulundu: {result.Year}");
        }

        // Değer çıkar (postage değeri)
        var denominationPatterns = new[]
        {
            @"(\d+)\s*(CENT|CENTS)",
            @"(\d+)\s*(PENNY|PENCE)",
            @"(\d+)\s*(KURUS|KURUŞ)",
        };

        foreach (var pattern in denominationPatterns)
        {
            var match = Regex.Match(allText, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                result.Denomination = $"{match.Groups[1].Value} {match.Groups[2].Value}";
                _logger.LogInformation($"[STAMP] Değer bulundu: {result.Denomination}");
                break;
            }
        }

        // Nadir/Common bilgisi
        if (searchText.Contains("RARE") || searchText.Contains("SCARCE"))
        {
            result.Rarity = "Rare";
            _logger.LogInformation($"[STAMP] Nadir pul tespit edildi");
        }
        else if (searchText.Contains("COMMON"))
        {
            result.Rarity = "Common";
            _logger.LogInformation($"[STAMP] Yaygın pul tespit edildi");
        }

        return result;
    }
}

