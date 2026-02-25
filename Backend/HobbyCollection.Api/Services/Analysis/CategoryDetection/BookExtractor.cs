using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Kitap kategorisi için özel bilgi çıkarıcı
/// </summary>
public class BookExtractor : ICategorySpecificExtractor
{
    private readonly ILogger<BookExtractor> _logger;

    public BookExtractor(ILogger<BookExtractor> logger)
    {
        _logger = logger;
    }

    public ProductCategory Category => ProductCategory.Book;

    public Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult)
    {
        var result = new Models.CategorySpecificData();
        var ocrText = data.OcrText;
        
        // ISBN çıkar
        var isbnPattern = @"ISBN[:\s-]*(\d{10}|\d{13}|\d{1,5}[- ]\d{1,7}[- ]\d{1,7}[- ]\d{1,7})";
        var isbnMatch = Regex.Match(ocrText, isbnPattern, RegexOptions.IgnoreCase);
        if (isbnMatch.Success)
        {
            result.ISBN = isbnMatch.Groups[1].Value.Replace(" ", "").Replace("-", "");
            _logger.LogInformation($"[BOOK] ISBN bulundu: {result.ISBN}");
        }

        // Yazar çıkar (Web Search sonuçlarından)
        var searchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}"));
        
        // "by Author Name" pattern'i
        var authorPatterns = new[]
        {
            @"by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",  // "by Stephen King"
            @"author:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",  // "author: Stephen King"
            @"written\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})",  // "written by Stephen King"
        };

        foreach (var pattern in authorPatterns)
        {
            var match = Regex.Match(searchText, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                result.Author = match.Groups[1].Value.Trim();
                _logger.LogInformation($"[BOOK] Yazar bulundu: {result.Author}");
                break;
            }
        }

        // Kitap adını Web Search sonuçlarından çıkar
        // En sık geçen 2-6 kelimelik kombinasyonlar kitap adı olabilir
        var titleWords = data.WebSearchResults
            .Where(r => !string.IsNullOrEmpty(r.Title))
            .SelectMany(r => r.Title.Split(new[] { '-', '|', ':' }, StringSplitOptions.RemoveEmptyEntries))
            .Select(t => t.Trim())
            .Where(t => t.Split(' ').Length >= 2 && t.Split(' ').Length <= 6)
            .GroupBy(t => t, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .FirstOrDefault();

        if (titleWords != null && titleWords.Count() >= 2)
        {
            result.BookTitle = titleWords.Key;
            _logger.LogInformation($"[BOOK] Kitap adı bulundu: {result.BookTitle}");
        }

        // Yayınevi çıkar (bilinen yayınevleri)
        var knownPublishers = new[] 
        { 
            "Penguin", "Random House", "HarperCollins", "Simon & Schuster", 
            "Macmillan", "Hachette", "Scholastic", "Pearson", "Oxford", "Cambridge"
        };

        foreach (var publisher in knownPublishers)
        {
            if (searchText.Contains(publisher, StringComparison.OrdinalIgnoreCase))
            {
                result.Publisher = publisher;
                _logger.LogInformation($"[BOOK] Yayınevi bulundu: {result.Publisher}");
                break;
            }
        }

        return result;
    }
}

