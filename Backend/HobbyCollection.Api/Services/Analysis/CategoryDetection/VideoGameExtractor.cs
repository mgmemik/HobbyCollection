using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Video oyunu kategorisi için özel bilgi çıkarıcı
/// </summary>
public class VideoGameExtractor : ICategorySpecificExtractor
{
    private readonly ILogger<VideoGameExtractor> _logger;

    public VideoGameExtractor(ILogger<VideoGameExtractor> logger)
    {
        _logger = logger;
    }

    public ProductCategory Category => ProductCategory.VideoGame;

    public Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult)
    {
        var result = new Models.CategorySpecificData();
        var ocrText = data.OcrText.ToUpper();
        var searchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}")).ToUpper();
        var allText = $"{ocrText} {searchText}";

        // Platform tespit et (Nintendo, PlayStation, Xbox, vb.)
        var knownPlatforms = new Dictionary<string, string>
        {
            { "NINTENDO", "Nintendo" },
            { "GAME BOY", "Nintendo Game Boy" },
            { "GAMEBOY", "Nintendo Game Boy" },
            { "NES", "Nintendo NES" },
            { "SNES", "Nintendo SNES" },
            { "N64", "Nintendo 64" },
            { "PLAYSTATION", "Sony PlayStation" },
            { "PSP", "Sony PSP" },
            { "PS1", "Sony PlayStation 1" },
            { "PS2", "Sony PlayStation 2" },
            { "PS3", "Sony PlayStation 3" },
            { "PS4", "Sony PlayStation 4" },
            { "PS5", "Sony PlayStation 5" },
            { "XBOX", "Microsoft Xbox" },
            { "ATARI", "Atari" },
            { "SEGA", "Sega" },
            { "MEGADRIVE", "Sega Mega Drive" },
            { "GENESIS", "Sega Genesis" },
        };

        foreach (var kvp in knownPlatforms)
        {
            if (allText.Contains(kvp.Key))
            {
                result.Platform = kvp.Value;
                _logger.LogInformation($"[GAME] Platform bulundu: {result.Platform}");
                break;
            }
        }

        // Oyun adı çıkar (web search sonuçlarından, sık geçen uzun kelimeler)
        var titleCandidates = new Dictionary<string, int>();
        
        foreach (var searchResult in data.WebSearchResults)
        {
            if (string.IsNullOrEmpty(searchResult.Title)) continue;
            
            // Title'ı parçala ve 4-20 karakter arası kelimeleri al
            var words = searchResult.Title
                .Split(new[] { '-', '|', ':', '–', '—' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(w => w.Trim())
                .Where(w => w.Length >= 4 && w.Length <= 20)
                .ToList();

            foreach (var word in words)
            {
                // Genel kelimeleri filtrele
                var commonWords = new[] { "Game", "Video", "Console", "For", "The", "And", "With", "Edition" };
                if (!commonWords.Any(cw => word.Equals(cw, StringComparison.OrdinalIgnoreCase)))
                {
                    titleCandidates[word] = titleCandidates.GetValueOrDefault(word, 0) + 1;
                }
            }
        }

        if (titleCandidates.Any())
        {
            var bestTitle = titleCandidates.OrderByDescending(kvp => kvp.Value).First();
            if (bestTitle.Value >= 2) // En az 2 kez geçmeli
            {
                result.GameTitle = bestTitle.Key;
                _logger.LogInformation($"[GAME] Oyun adı bulundu: {result.GameTitle} ({bestTitle.Value} kez)");
            }
        }

        return result;
    }
}

