using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Para/Madeni para kategorisi için özel bilgi çıkarıcı
/// </summary>
public class CoinCurrencyExtractor : ICategorySpecificExtractor
{
    private readonly ILogger<CoinCurrencyExtractor> _logger;

    public CoinCurrencyExtractor(ILogger<CoinCurrencyExtractor> logger)
    {
        _logger = logger;
    }

    public ProductCategory Category => ProductCategory.Coin;

    public Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult)
    {
        var result = new Models.CategorySpecificData();
        var ocrText = data.OcrText.ToUpper();
        var searchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}")).ToUpper();
        var allText = $"{ocrText} {searchText}";

        // Ülke çıkar (bilinen ülke isimleri ve OCR'dan)
        var knownCountries = new Dictionary<string, string>
        {
            // İngilizce ve Türkçe ülke isimleri
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
            { "GREECE", "Greece" }, { "ΕΛΛΆΔΑ", "Greece" }, { "YUNANİSTAN", "Greece" },
            { "NETHERLANDS", "Netherlands" }, { "HOLLAND", "Netherlands" }, { "HOLLANDA", "Netherlands" },
            { "BELGIUM", "Belgium" }, { "BELÇİKA", "Belgium" },
            { "SWITZERLAND", "Switzerland" }, { "SCHWEIZ", "Switzerland" }, { "İSVİÇRE", "Switzerland" },
            { "AUSTRIA", "Austria" }, { "ÖSTERREICH", "Austria" }, { "AVUSTURYA", "Austria" },
            { "POLAND", "Poland" }, { "POLSKA", "Poland" }, { "POLONYA", "Poland" },
            { "SWEDEN", "Sweden" }, { "SVERIGE", "Sweden" }, { "İSVEÇ", "Sweden" },
            { "NORWAY", "Norway" }, { "NORGE", "Norway" }, { "NORVEÇ", "Norway" },
            { "DENMARK", "Denmark" }, { "DANMARK", "Denmark" }, { "DANİMARKA", "Denmark" },
        };

        foreach (var kvp in knownCountries)
        {
            if (allText.Contains(kvp.Key))
            {
                result.Country = kvp.Value;
                _logger.LogInformation($"[COIN] Ülke bulundu: {result.Country} (kaynak: {kvp.Key})");
                break;
            }
        }

        // Yıl çıkar (4 haneli sayılar 1800-2025 arası)
        var yearPattern = @"\b(1[89]\d{2}|20[0-2]\d)\b";
        var yearMatches = Regex.Matches(allText, yearPattern);
        if (yearMatches.Count > 0)
        {
            // En sık geçen yılı al
            var mostCommonYear = yearMatches
                .Cast<Match>()
                .Select(m => m.Value)
                .GroupBy(y => y)
                .OrderByDescending(g => g.Count())
                .First()
                .Key;
            
            result.Year = mostCommonYear;
            _logger.LogInformation($"[COIN] Yıl bulundu: {result.Year}");
        }

        // Değer çıkar (1 cent, 5 euro, 10 dollar, vb.)
        var denominationPatterns = new[]
        {
            @"(\d+)\s*(CENT|CENTS)",
            @"(\d+)\s*(DOLLAR|DOLLARS)",
            @"(\d+)\s*(EURO|EUROS)",
            @"(\d+)\s*(POUND|POUNDS)",
            @"(\d+)\s*(YEN)",
            @"(\d+)\s*(LIRA|TL)",
        };

        foreach (var pattern in denominationPatterns)
        {
            var match = Regex.Match(allText, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                result.Denomination = $"{match.Groups[1].Value} {match.Groups[2].Value}";
                _logger.LogInformation($"[COIN] Değer bulundu: {result.Denomination}");
                break;
            }
        }

        // Nadir/Common bilgisi (web search sonuçlarından)
        if (searchText.Contains("RARE") || searchText.Contains("SCARCE"))
        {
            result.Rarity = "Rare";
            _logger.LogInformation($"[COIN] Nadir para tespit edildi");
        }
        else if (searchText.Contains("COMMON"))
        {
            result.Rarity = "Common";
            _logger.LogInformation($"[COIN] Yaygın para tespit edildi");
        }

        return result;
    }
}

