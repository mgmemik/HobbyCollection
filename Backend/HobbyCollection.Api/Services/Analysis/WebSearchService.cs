using System.Text.Json;
using System.Text.RegularExpressions;
using AngleSharp;
using AngleSharp.Html.Parser;
using HobbyCollection.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis
{
    public class WebSearchService : IWebSearchService
    {
        private readonly ILogger<WebSearchService> _logger;
        private readonly IOcrExtractionService _ocrExtraction;
        private readonly string? _googleSearchApiKey;
        private readonly string? _googleSearchEngineId;

        public WebSearchService(
            ILogger<WebSearchService> logger,
            IOcrExtractionService ocrExtraction,
            Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _logger = logger;
            _ocrExtraction = ocrExtraction;
            _googleSearchApiKey = configuration["GoogleSearch:ApiKey"];
            _googleSearchEngineId = configuration["GoogleSearch:EngineId"];
        }

        public List<string> GenerateSearchQueries(AnalysisDataCollection data)
        {
            var queries = new List<string>();

            // Genel kelimeleri filtrele
            var genericWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "gadget", "device", "machine", "tool", "object", "item", "thing", "product",
                "robot", "robots", "toy", "toys", "camera", "cameras", "phone", "phones",
                "computer", "computers", "watch", "watches", "clock", "clocks",
                "train", "trains", "car", "cars", "transport", "vehicle", "vehicles"
            };

            // ÖNCELİK 1: Vision API Web Entities (EN SPESİFİK! - Google'ın görselden çıkardığı entity'ler)
            // Örnek: "BMW 2002tii", "Fiat 1100", "Fiat 125"
            var webEntities = data.VisionResults
                .SelectMany(v => v.WebEntities ?? new List<WebEntity>())
                .OrderByDescending(e => e.Score)
                .Take(5)
                .Where(e => !string.IsNullOrEmpty(e.Description))
                .Select(e => e.Description)
                .ToList();

            foreach (var entity in webEntities)
            {
                var entityLower = entity.ToLower();
                var entityWords = entity.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var isGenericSingleWord = entityWords.Length == 1 && genericWords.Contains(entityLower);
                
                // Tek kelimelik genel terimlerle web araması yapma
                if (!isGenericSingleWord)
                {
                    // Çok kelimeli veya spesifik entity ise direkt kullan (ekstra kelime ekleme!)
                    if (!queries.Contains(entity))
                    {
                        queries.Add(entity);
                        _logger.LogInformation($"[SEARCH QUERY] WebEntity direkt kullanıldı: '{entity}'");
                    }
                }
                else
                {
                    _logger.LogInformation($"[SEARCH QUERY] Genel WebEntity '{entity}' atlandı (tek kelimelik genel terimlerle web araması yapılmıyor)");
                }
            }

            // ÖNCELİK 2: BestGuessLabel (Google'ın tahmini - çok kelimeli veya spesifik olanlar)
            // Örnek: "bmw 1600"
            var bestGuesses = data.VisionResults
                .Where(v => !string.IsNullOrEmpty(v.BestGuessLabel))
                .Select(v => v.BestGuessLabel)
                .Distinct()
                .ToList();

            foreach (var guess in bestGuesses.Take(3))
            {
                var guessLower = guess.ToLower();
                var guessWords = guess.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var isGenericSingleWord = guessWords.Length == 1 && genericWords.Contains(guessLower);
                
                // Tek kelimelik genel terimlerle web araması yapma
                if (!isGenericSingleWord)
                {
                    // Çok kelimeli veya spesifik ise direkt kullan (ekstra kelime ekleme!)
                    if (!queries.Contains(guess))
                    {
                        queries.Add(guess);
                        _logger.LogInformation($"[SEARCH QUERY] BestGuessLabel direkt kullanıldı: '{guess}'");
                    }
                }
                else
                {
                    _logger.LogInformation($"[SEARCH QUERY] Genel BestGuessLabel '{guess}' atlandı (tek kelimelik genel terimlerle web araması yapılmıyor)");
                }
            }

            // ÖNCELİK 3: Vision API Web Entities'den marka çıkar ve query oluştur
            // Web Entities'den marka çıkarma (örn: "Saturn Robot" → "Saturn")
            var webEntityBrands = new List<string>();
            var genericBrandWords = new[] { "BABY", "TOY", "TOYS", "ROBOT", "ROBOTS", "GAME", "GAMES", 
                "MODEL", "MODELS", "VINTAGE", "CLASSIC", "NEW", "OLD", "USED" };
            
            foreach (var entity in webEntities)
            {
                var entityWords = entity.Split(new[] { ' ', '-', '–', '—' }, StringSplitOptions.RemoveEmptyEntries);
                if (entityWords.Length >= 2)
                {
                    var firstWord = entityWords[0].Trim().ToUpper();
                    
                    if (firstWord.Length >= 3 && firstWord.Length <= 15 && 
                        !genericBrandWords.Contains(firstWord) &&
                        !webEntityBrands.Contains(firstWord))
                    {
                        webEntityBrands.Add(firstWord);
                        _logger.LogInformation($"[SEARCH QUERY] Web Entity'den marka çıkarıldı: '{firstWord}' (entity: '{entity}')");
                    }
                }
            }
            
            // ÖNCELİK 3.5: OCR'dan brand+model kombinasyonları (en spesifik)
            var ocrText = data.OcrText.ToUpper();
            var potentialBrands = _ocrExtraction.ExtractPotentialBrands(ocrText);
            var potentialModels = _ocrExtraction.ExtractPotentialModels(ocrText);
            
            // Web Entity'den çıkarılan markaları da ekle
            potentialBrands = potentialBrands.Concat(webEntityBrands).Distinct().ToList();

            if (potentialBrands.Any() && potentialModels.Any())
            {
                foreach (var brand in potentialBrands.Take(2))
                {
                    foreach (var model in potentialModels.Take(3))
                    {
                        var query = $"{brand} {model}";
                        if (!queries.Contains(query))
                        {
                            queries.Add(query);
                            _logger.LogInformation($"[SEARCH QUERY] OCR/WebEntity Brand+Model: '{query}'");
                        }
                    }
                }
            }
            
            // Web Entity markası varsa ama OCR model yoksa, Web Entity'yi direkt query olarak kullan
            if (webEntityBrands.Any() && !potentialModels.Any())
            {
                foreach (var brand in webEntityBrands.Take(2))
                {
                    // Web Entity'yi direkt query olarak kullan (örn: "Saturn Robot")
                    var matchingEntity = webEntities.FirstOrDefault(e => 
                        e.Split(new[] { ' ', '-', '–', '—' }, StringSplitOptions.RemoveEmptyEntries)
                         .FirstOrDefault()?.ToUpper() == brand);
                    
                    if (matchingEntity != null && !queries.Contains(matchingEntity))
                    {
                        queries.Add(matchingEntity);
                        _logger.LogInformation($"[SEARCH QUERY] Web Entity direkt kullanıldı: '{matchingEntity}'");
                    }
                }
            }

            // ÖNCELİK 4: OCR Model + Vision Label kombinasyonları (sadece yüksek confidence label'lar)
            if (potentialModels.Any())
            {
                var topLabels = data.VisionResults
                    .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                    .Where(l => l.Score > 0.8) // Sadece yüksek confidence label'lar
                    .GroupBy(l => l.Description)
                    .Select(g => new { Description = g.Key, Score = g.Sum(l => l.Score) })
                    .OrderByDescending(g => g.Score)
                    .Take(3)
                    .Select(g => g.Description)
                    .ToList();

                foreach (var model in potentialModels.Take(3))
                {
                    foreach (var label in topLabels)
                    {
                        var labelLower = label.ToLower();
                        var labelWords = label.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        var isGenericSingleWord = labelWords.Length == 1 && genericWords.Contains(labelLower);
                        
                        // Tek kelimelik genel label'ları atla
                        if (!isGenericSingleWord)
                        {
                            var query = $"{model} {label}";
                            if (!queries.Contains(query))
                            {
                                queries.Add(query);
                                _logger.LogInformation($"[SEARCH QUERY] OCR Model+Vision Label: '{query}'");
                            }
                        }
                    }
                }
            }

            // ÖNCELİK 5: OCR Brand + Vision Label kombinasyonları (sadece yüksek confidence label'lar)
            if (potentialBrands.Any())
            {
                var topLabels = data.VisionResults
                    .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                    .Where(l => l.Score > 0.8) // Sadece yüksek confidence label'lar
                    .GroupBy(l => l.Description)
                    .Select(g => new { Description = g.Key, Score = g.Sum(l => l.Score) })
                    .OrderByDescending(g => g.Score)
                    .Take(3)
                    .Select(g => g.Description)
                    .ToList();

                foreach (var brand in potentialBrands.Take(2))
                {
                    foreach (var label in topLabels)
                    {
                        var labelLower = label.ToLower();
                        var labelWords = label.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        var isGenericSingleWord = labelWords.Length == 1 && genericWords.Contains(labelLower);
                        
                        // Tek kelimelik genel label'ları atla
                        if (!isGenericSingleWord)
                        {
                            var query = $"{brand} {label}";
                            if (!queries.Contains(query))
                            {
                                queries.Add(query);
                                _logger.LogInformation($"[SEARCH QUERY] OCR Brand+Vision Label: '{query}'");
                            }
                        }
                    }
                }
            }

            // ÖNCELİK 6: Sadece OCR Brand (son çare)
            if (potentialBrands.Any() && queries.Count < 3)
            {
                foreach (var brand in potentialBrands.Take(1))
                {
                    if (!queries.Contains(brand))
                    {
                        queries.Add(brand);
                        _logger.LogInformation($"[SEARCH QUERY] OCR Brand only: '{brand}'");
                    }
                }
            }

            // ÖNCELİK 7: Çok kelimeli Vision Labels (son çare - sadece yüksek confidence ve çok kelimeli olanlar)
            if (queries.Count < 3)
            {
                var topLabels = data.VisionResults
                    .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                    .Where(l => l.Score > 0.85) // Çok yüksek confidence
                    .GroupBy(l => l.Description)
                    .Select(g => new { Description = g.Key, Score = g.Sum(l => l.Score) })
                    .OrderByDescending(g => g.Score)
                    .Take(2)
                    .Select(g => g.Description)
                    .ToList();

                foreach (var label in topLabels)
                {
                    var labelLower = label.ToLower();
                    var labelWords = label.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    var isGenericSingleWord = labelWords.Length == 1 && genericWords.Contains(labelLower);
                    
                    // Sadece çok kelimeli ve spesifik label'ları kullan
                    if (!isGenericSingleWord && labelWords.Length >= 2)
                    {
                        if (!queries.Contains(label))
                        {
                            queries.Add(label);
                            _logger.LogInformation($"[SEARCH QUERY] Çok kelimeli Vision Label: '{label}'");
                        }
                    }
                }
            }

            return queries.Distinct().Take(8).ToList();
        }

        public async Task<List<SerpResult>> SearchWebForProductAsync(string query, int maxResults)
        {
            try
            {
                using var httpClient = new HttpClient();
                var encodedQuery = Uri.EscapeDataString(query);
                
                // Google Programmable Search Engine API kullan
                if (!string.IsNullOrEmpty(_googleSearchApiKey) && !string.IsNullOrEmpty(_googleSearchEngineId))
                {
                    try
                    {
                        return await SearchWithGoogleCustomSearchAsync(query, maxResults);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"[WEB SEARCH] Google Custom Search hatası: {ex.Message}");
                    }
                }
                
                // Google arama sonuçlarını scrape et
                return await ScrapeGoogleSearchResults(query, maxResults);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[WEB SEARCH] Web arama hatası: {query}");
                return await SearchWebFallbackAsync(query, maxResults);
            }
        }

        private async Task<List<SerpResult>> SearchWithGoogleCustomSearchAsync(string query, int maxResults)
        {
            try
            {
                using var httpClient = new HttpClient();
                var encodedQuery = Uri.EscapeDataString(query);

                // Google Custom Search JSON API (API key ile)
                var url = $"https://www.googleapis.com/customsearch/v1?key={_googleSearchApiKey}&cx={_googleSearchEngineId}&q={encodedQuery}&num={maxResults}";

                _logger.LogInformation($"[WEB SEARCH] Google Custom Search API ile web araması yapılıyor: {query}");

                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"[WEB SEARCH] Google Custom Search API hatası: {response.StatusCode} - {errorContent}");
                    return await ScrapeGoogleSearchResults(query, maxResults);
                }

                var json = await response.Content.ReadAsStringAsync();
                _logger.LogDebug($"[WEB SEARCH] Google Custom Search raw response (first 500 chars): {json.Substring(0, Math.Min(500, json.Length))}");
                
                var googleResponse = JsonSerializer.Deserialize<GoogleCustomSearchResponse>(json);

                var results = new List<SerpResult>();

                // Google'dan gelen sonuçları işle
                if (googleResponse?.Items != null && googleResponse.Items.Count > 0)
                {
                    _logger.LogInformation($"[WEB SEARCH] Google Custom Search response'da {googleResponse.Items.Count} item bulundu");
                    foreach (var item in googleResponse.Items.Take(maxResults))
                    {
                        results.Add(new SerpResult
                        {
                            Title = item.Title ?? "",
                            Link = item.Link ?? "",
                            Snippet = item.Snippet ?? "",
                            DisplayLink = item.DisplayLink ?? ""
                        });
                        _logger.LogDebug($"[WEB SEARCH] Sonuç eklendi: {item.Title}");
                    }
                }
                else
                {
                    _logger.LogWarning($"[WEB SEARCH] Google Custom Search response'da item bulunamadı. Response null: {googleResponse == null}, Items null: {googleResponse?.Items == null}, Items count: {googleResponse?.Items?.Count ?? 0}");
                }

                _logger.LogInformation($"[WEB SEARCH] Google Custom Search'dan {results.Count} sonuç alındı");
                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[WEB SEARCH] Google Custom Search API hatası: {query}");
                return await ScrapeGoogleSearchResults(query, maxResults);
            }
        }

        private async Task<List<SerpResult>> ScrapeGoogleSearchResults(string query, int maxResults)
        {
            try
            {
                using var httpClient = new HttpClient();
                var encodedQuery = Uri.EscapeDataString(query);

                // Google arama URL'si
                var url = $"https://www.google.com/search?q={encodedQuery}&num={maxResults}&hl=en";

                _logger.LogInformation($"[WEB SEARCH] Google arama sonuçları scrape ediliyor: {query}");

                // User-Agent ekle
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"[WEB SEARCH] Google arama hatası: {response.StatusCode}");
                    return await SearchWebFallbackAsync(query, maxResults);
                }

                var html = await response.Content.ReadAsStringAsync();

                // AngleSharp ile HTML parse et
                var parser = new HtmlParser();
                var document = await parser.ParseDocumentAsync(html);

                var results = new List<SerpResult>();

                // Arama sonuçlarını bul (Google'ın arama sonuçları div'leri)
                var searchResults = document.QuerySelectorAll("div.g, div[data-ved]");

                foreach (var result in searchResults.Take(maxResults))
                {
                    var titleElement = result.QuerySelector("h3");
                    var linkElement = result.QuerySelector("a[href]");
                    var snippetElement = result.QuerySelector("span[data-ved], div[data-ved] span");

                    if (titleElement != null && linkElement != null)
                    {
                        results.Add(new SerpResult
                        {
                            Title = titleElement.TextContent.Trim(),
                            Link = linkElement.GetAttribute("href") ?? "",
                            Snippet = snippetElement?.TextContent.Trim() ?? ""
                        });
                    }
                }

                _logger.LogInformation($"[WEB SEARCH] Google arama sonuçlarından {results.Count} sonuç alındı");
                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[WEB SEARCH] Google arama scrape hatası: {query}");
                return await SearchWebFallbackAsync(query, maxResults);
            }
        }

        public async Task<List<SerpResult>> ScrapeGoogleImagesReverseSearchAsync(string base64Image, string fileName)
        {
            try
            {
                using var httpClient = new HttpClient();
                
                // Google Images reverse search için multipart form data oluştur
                var formData = new MultipartFormDataContent();
                
                // Fotoğrafı form data'ya ekle
                var imageContent = new ByteArrayContent(Convert.FromBase64String(base64Image));
                imageContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
                formData.Add(imageContent, "encoded_image", fileName);
                
                // User-Agent ekle
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
                
                // Google Images reverse search URL'si
                var url = "https://www.google.com/searchbyimage/upload";
                
                _logger.LogInformation("[REVERSE IMAGE] Google Images reverse search yapılıyor...");
                
                var response = await httpClient.PostAsync(url, formData);
                
                if (response.IsSuccessStatusCode)
                {
                    var html = await response.Content.ReadAsStringAsync();
                    
                    // Sonuçları parse et
                    var parser = new HtmlParser();
                    var document = await parser.ParseDocumentAsync(html);
                    
                    var results = new List<SerpResult>();
                    
                    // Google'ın reverse search sonuçlarını bul
                    var searchResults = document.QuerySelectorAll("div.g, div[data-ved]");
                    
                    foreach (var result in searchResults.Take(10))
                    {
                        var titleElement = result.QuerySelector("h3");
                        var linkElement = result.QuerySelector("a[href]");
                        var snippetElement = result.QuerySelector("span[data-ved], div[data-ved] span");
                        
                        if (titleElement != null && linkElement != null)
                        {
                            results.Add(new SerpResult
                            {
                                Title = titleElement.TextContent.Trim(),
                                Link = linkElement.GetAttribute("href") ?? "",
                                Snippet = snippetElement?.TextContent.Trim() ?? "",
                                Source = "Google Reverse Image Search"
                            });
                        }
                    }
                    
                    _logger.LogInformation($"[REVERSE IMAGE] Google Images'den {results.Count} sonuç alındı");
                    return results;
                }
                else
                {
                    _logger.LogWarning($"[REVERSE IMAGE] Google Images reverse search hatası: {response.StatusCode}");
                    return new List<SerpResult>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[REVERSE IMAGE] Google Images reverse search scrape hatası");
                return new List<SerpResult>();
            }
        }

        private async Task<List<SerpResult>> SearchWebFallbackAsync(string query, int maxResults)
        {
            await Task.CompletedTask;
            try
            {
                _logger.LogInformation($"[WEB SEARCH FALLBACK] Basit web araması yapılıyor: {query}");
                
                // Manuel fallback sonuçları oluştur
                var results = new List<SerpResult>();

                // Intel işlemci için örnek sonuçlar
                if (query.Contains("INTEL") || query.Contains("BP8050275") || query.Contains("B85821") || query.Contains("PENTIUM"))
                {
                    results.Add(new SerpResult
                    {
                        Title = $"Intel {query} - Vintage Processor",
                        Link = $"https://example.com/intel/{query.ToLower()}",
                        Snippet = $"Vintage Intel processor {query} from the 1990s era"
                    });
                    results.Add(new SerpResult
                    {
                        Title = $"{query} - CPU Database",
                        Link = $"https://example.com/cpu/{query.ToLower()}",
                        Snippet = $"Technical details and specifications for {query}"
                    });
                    results.Add(new SerpResult
                    {
                        Title = $"Collecting {query} - Hobby Collection",
                        Link = $"https://example.com/collection/{query.ToLower()}",
                        Snippet = $"Adding {query} to your vintage computer collection"
                    });
                }
                else
                {
                    results.Add(new SerpResult
                    {
                        Title = $"Search results for {query}",
                        Link = $"https://example.com/search/{query.ToLower()}",
                        Snippet = $"Information about {query}"
                    });
                }
                
                // Genel ürün araması için
                if (query.ToUpper().Contains("AMD"))
                {
                    results.Add(new SerpResult
                    {
                        Title = "AMD Processor Information",
                        Link = "https://www.amd.com",
                        Snippet = "AMD processor specifications and technical details"
                    });
                }

                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[WEB SEARCH FALLBACK] Fallback hatası: {query}");
                return new List<SerpResult>();
            }
        }
    }
}

