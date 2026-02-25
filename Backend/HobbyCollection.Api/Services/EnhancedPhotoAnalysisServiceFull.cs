using HobbyCollection.Api.Models;
using HobbyCollection.Api.Services.Analysis;
using HobbyCollection.Api.Services.Analysis.CategoryDetection;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Text.Json;
using HobbyCollection.Domain.Services;

namespace HobbyCollection.Api.Services
{
    // YEDEK: Gelişmiş analiz servisi (Full versiyon - şu anda kullanılmıyor)
    public interface IEnhancedPhotoAnalysisServiceFull
    {
        Task<EnhancedAnalysisResult> EnhancedProductAnalysisAsync(List<IFormFile> photos, string language = "en", string? analysisLogId = null);
    }

    public class EnhancedPhotoAnalysisServiceFull : IEnhancedPhotoAnalysisServiceFull
    {
        private readonly ILogger<EnhancedPhotoAnalysisServiceFull> _logger;
        private readonly IVisionApiService _visionApi;
        private readonly IWebSearchService _webSearch;
        private readonly IProductIdentificationService _productIdentification;
        private readonly IAiEnrichmentService _aiEnrichment;
        private readonly IHashtagGenerationService _hashtagGeneration;
        private readonly IUrlParserService _urlParser;
        private readonly AnalysisMetricsService _metricsService;
        private readonly CategoryDetectionService _categoryDetection;
        private readonly IEnumerable<ICategorySpecificExtractor> _categoryExtractors;
        private readonly IAnalysisLogService? _analysisLogService;
        private readonly IGeminiAnalysisService? _geminiAnalysis;

        public EnhancedPhotoAnalysisServiceFull(
            ILogger<EnhancedPhotoAnalysisServiceFull> logger,
            IVisionApiService visionApi,
            IWebSearchService webSearch,
            IProductIdentificationService productIdentification,
            IAiEnrichmentService aiEnrichment,
            IHashtagGenerationService hashtagGeneration,
            IUrlParserService urlParser,
            AnalysisMetricsService metricsService,
            CategoryDetectionService categoryDetection,
            IEnumerable<ICategorySpecificExtractor> categoryExtractors,
            IAnalysisLogService? analysisLogService = null,
            IGeminiAnalysisService? geminiAnalysis = null)
        {
            _logger = logger;
            _visionApi = visionApi;
            _webSearch = webSearch;
            _productIdentification = productIdentification;
            _aiEnrichment = aiEnrichment;
            _hashtagGeneration = hashtagGeneration;
            _urlParser = urlParser;
            _metricsService = metricsService;
            _categoryDetection = categoryDetection;
            _categoryExtractors = categoryExtractors;
            _analysisLogService = analysisLogService;
            _geminiAnalysis = geminiAnalysis;
        }

        private async Task LogStepAsync(string? analysisLogId, string step, string stepName, string message, string level = "Information", object? data = null, long? durationMs = null)
        {
            if (!string.IsNullOrEmpty(analysisLogId) && _analysisLogService != null)
            {
                try
                {
                    string? dataJson = null;
                    if (data != null)
                    {
                        dataJson = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = false });
                    }
                    await _analysisLogService.AddLogEntryAsync(analysisLogId, step, stepName, message, level, dataJson, durationMs);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Log entry kaydedilemedi: {Step}", step);
                }
            }
        }

        public async Task<EnhancedAnalysisResult> EnhancedProductAnalysisAsync(List<IFormFile> photos, string language = "en", string? analysisLogId = null)
        {
            var stopwatch = Stopwatch.StartNew();
            _logger.LogInformation($"=== GELİŞMİŞ ANALİZ BAŞLATILIYOR === (Dil: {language})");
            await LogStepAsync(analysisLogId, "START", "Analysis Started", $"Gelişmiş analiz başlatıldı. Dil: {language}, Fotoğraf sayısı: {photos.Count}");

            var allData = new AnalysisDataCollection();

            // STEP 1: Fotoğrafları sırayla Vision API ile analiz et - sonuç bulunana kadar devam et
            var step1Stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("[STEP 1] Fotoğraflar sırayla analiz ediliyor (sonuç bulunana kadar)...");
            _logger.LogInformation($"Toplam fotoğraf sayısı: {photos.Count}");
            await LogStepAsync(analysisLogId, "STEP 1", "Vision API Analysis", $"Fotoğraflar sırayla analiz ediliyor (sonuç bulunana kadar). Toplam fotoğraf sayısı: {photos.Count}");

            int analyzedPhotoCount = 0;
            bool foundSufficientResult = false;

            foreach (var photo in photos)
            {
                analyzedPhotoCount++;
                var photoIndex = analyzedPhotoCount;
                var photoStopwatch = Stopwatch.StartNew();
                _logger.LogInformation($"[STEP 1.{photoIndex}] Fotoğraf {photoIndex}/{photos.Count} analiz ediliyor: {photo.FileName}, Boyut: {photo.Length} bytes");
                var photoData = await _visionApi.AnalyzePhotoAsync(photo);
                photoStopwatch.Stop();
                allData.VisionResults.Add(photoData);
                _logger.LogInformation($"[STEP 1.{photoIndex}] Vision API sonuçları - Labels: {photoData.Labels?.Count ?? 0}, OCR: {photoData.ExtractedText?.Length ?? 0} karakter");
                await LogStepAsync(analysisLogId, $"STEP 1.{photoIndex}", "Vision API Photo Analysis", 
                    $"Fotoğraf analiz edildi: {photo.FileName}, Labels: {photoData.Labels?.Count ?? 0}, OCR: {photoData.ExtractedText?.Length ?? 0} karakter",
                    data: new { fileName = photo.FileName, fileSize = photo.Length, labelCount = photoData.Labels?.Count ?? 0, ocrLength = photoData.ExtractedText?.Length ?? 0 },
                    durationMs: photoStopwatch.ElapsedMilliseconds);

                // Sonuç kontrolü: Eğer yeterli veri varsa (OCR text, labels, web entities vb.), erken çıkış yap
                var hasOcrText = !string.IsNullOrWhiteSpace(photoData.ExtractedText) && photoData.ExtractedText.Length > 10;
                var hasLabels = photoData.Labels != null && photoData.Labels.Any(l => l.Score > 0.7);
                var hasWebEntities = photoData.WebEntities != null && photoData.WebEntities.Any(e => e.Score > 0.7);
                var hasBestGuess = !string.IsNullOrWhiteSpace(photoData.BestGuessLabel);
                var hasWebPages = photoData.WebPages != null && photoData.WebPages.Any();

                // Yeterli sonuç kriterleri: OCR text veya yüksek skorlu label/web entity veya best guess
                foundSufficientResult = hasOcrText || hasLabels || hasWebEntities || hasBestGuess || hasWebPages;

                if (foundSufficientResult)
                {
                    _logger.LogInformation($"[STEP 1.{photoIndex}] Fotoğraf {photoIndex}'den yeterli sonuç bulundu! (OCR: {hasOcrText}, Labels: {hasLabels}, WebEntities: {hasWebEntities}, BestGuess: {hasBestGuess}, WebPages: {hasWebPages})");
                    _logger.LogInformation($"[STEP 1] Erken çıkış: Toplam {analyzedPhotoCount} fotoğraf analiz edildi, {photos.Count - analyzedPhotoCount} fotoğraf atlandı. Maliyet optimizasyonu sağlandı.");
                    await LogStepAsync(analysisLogId, "STEP 1", "Vision API Analysis - Early Exit", 
                        $"Fotoğraf {photoIndex}'den yeterli sonuç bulundu. Toplam {analyzedPhotoCount} fotoğraf analiz edildi, {photos.Count - analyzedPhotoCount} fotoğraf atlandı.",
                        data: new { analyzedCount = analyzedPhotoCount, skippedCount = photos.Count - analyzedPhotoCount, hasOcrText, hasLabels, hasWebEntities, hasBestGuess, hasWebPages });
                    break;
                }
                else
                {
                    _logger.LogInformation($"[STEP 1.{photoIndex}] Fotoğraf {photoIndex}'den yeterli sonuç bulunamadı, bir sonraki fotoğrafa geçiliyor...");
                }
            }
            
            step1Stopwatch.Stop();
            if (foundSufficientResult)
            {
                await LogStepAsync(analysisLogId, "STEP 1", "Vision API Analysis Complete (Early Exit)", 
                    $"Yeterli sonuç bulundu. Toplam {analyzedPhotoCount} fotoğraf analiz edildi, {photos.Count - analyzedPhotoCount} fotoğraf atlandı.", 
                    durationMs: step1Stopwatch.ElapsedMilliseconds);
            }
            else
            {
                await LogStepAsync(analysisLogId, "STEP 1", "Vision API Analysis Complete", 
                    $"Tüm fotoğraflar analiz edildi ancak yeterli sonuç bulunamadı. Toplam {analyzedPhotoCount} fotoğraf işlendi.", 
                    durationMs: step1Stopwatch.ElapsedMilliseconds);
            }

            // STEP 2: OCR verilerini birleştir ve filtrele
            var step2Stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("[STEP 2] OCR verilerini birleştiriliyor...");
            var combinedOcrText = string.Join(" ", allData.VisionResults.Select(v => v.ExtractedText));
            
            // OCR metnini filtrele: anlamsız karakterleri ve Vision API sonuçlarıyla eşleşmeyen metinleri temizle
            var filteredOcrText = FilterOcrText(combinedOcrText, allData);
            allData.OcrText = filteredOcrText;
            step2Stopwatch.Stop();
            _logger.LogInformation($"[STEP 2] OCR metni birleştirildi: {combinedOcrText.Length} karakter, filtrelenmiş: {filteredOcrText.Length} karakter");
            if (combinedOcrText.Length > 0)
            {
                _logger.LogInformation($"[STEP 2] OCR içeriği (ham): '{combinedOcrText.Substring(0, Math.Min(200, combinedOcrText.Length))}'");
            }
            if (filteredOcrText.Length > 0 && filteredOcrText != combinedOcrText)
            {
                _logger.LogInformation($"[STEP 2] OCR içeriği (filtrelenmiş): '{filteredOcrText.Substring(0, Math.Min(200, filteredOcrText.Length))}'");
            }
            await LogStepAsync(analysisLogId, "STEP 2", "OCR Text Combination", 
                $"OCR verileri birleştirildi: {combinedOcrText.Length} karakter, filtrelenmiş: {filteredOcrText.Length} karakter",
                data: new { ocrLength = combinedOcrText.Length, filteredLength = filteredOcrText.Length, preview = filteredOcrText.Length > 0 ? filteredOcrText.Substring(0, Math.Min(200, filteredOcrText.Length)) : "" },
                durationMs: step2Stopwatch.ElapsedMilliseconds);

            // STEP 3: Vision API'nin bulduğu web sayfalarını kullan
            var step3Stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("[STEP 3] Vision API Web Detection sonuçları işleniyor...");
            await LogStepAsync(analysisLogId, "STEP 3", "Vision Web Detection", "Vision API Web Detection sonuçları işleniyor...");
            var webPagesFromVision = allData.VisionResults
                .SelectMany(v => v.WebPages ?? new List<WebPage>())
                .Where(p => !string.IsNullOrEmpty(p.PageTitle))
                .Take(10)
                .ToList();
            
            // VisuallySimilarImages'dan da web sayfaları çıkar
            var visuallySimilarUrls = allData.VisionResults
                .SelectMany(v => v.VisuallySimilarImages ?? new List<WebImage>())
                .Where(img => !string.IsNullOrEmpty(img.Url))
                .Select(img => img.Url)
                .Distinct()
                .Take(10)
                .ToList();
            
            _logger.LogInformation($"[STEP 3] Vision API'den {webPagesFromVision.Count} web sayfası bulundu");
            _logger.LogInformation($"[STEP 3] Vision API'den {visuallySimilarUrls.Count} görsel benzeri URL bulundu");
            await LogStepAsync(analysisLogId, "STEP 3", "Vision Web Detection Results", 
                $"Vision API'den {webPagesFromVision.Count} web sayfası ve {visuallySimilarUrls.Count} görsel benzeri URL bulundu",
                data: new { webPageCount = webPagesFromVision.Count, visuallySimilarCount = visuallySimilarUrls.Count });
            
            // Web sayfalarını SerpResult formatına çevir
            foreach (var page in webPagesFromVision)
            {
                allData.WebSearchResults.Add(new SerpResult
                {
                    Title = page.PageTitle,
                    Snippet = $"Vision API tarafından bulunan görsel eşleşmesi (Score: {page.Score})",
                    Link = page.Url,
                    Source = "Google Vision Web Detection"
                });
                _logger.LogInformation($"[STEP 3] Web sayfası eklendi: {page.PageTitle} - {page.Url}");
            }
            
            // VisuallySimilarImages URL'lerini de ekle (görsel bazlı eşleşmeler)
            foreach (var url in visuallySimilarUrls)
            {
                try
                {
                    var uri = new Uri(url);
                    var domain = uri.Host;
                    var path = uri.AbsolutePath;
                    
                    // URL'den ürün adı çıkarmaya çalış
                    var title = _urlParser.ExtractProductNameFromUrl(url, domain, path);
                    
                    // Eğer title null veya anlamsızsa, ekleme
                    if (string.IsNullOrEmpty(title) || _urlParser.IsMeaninglessTitle(title))
                    {
                        _logger.LogInformation($"[STEP 3] Anlamsız title atlandı: {title ?? "null"} ({url})");
                        continue;
                    }
                    
                    allData.WebSearchResults.Add(new SerpResult
                    {
                        Title = title,
                        Snippet = $"Vision API görsel benzeri eşleşmesi ({domain})",
                        Link = url,
                        Source = "Google Vision Visually Similar"
                    });
                    _logger.LogInformation($"[STEP 3] Görsel benzeri URL eklendi: {title} ({url})");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"[STEP 3] URL parse hatası: {url}");
                }
            }

            // STEP 3.1: Eğer Vision Web Detection çalışmadıysa veya OCR yoksa, görsel bazlı arama yap
            var hasOcrData = !string.IsNullOrWhiteSpace(allData.OcrText) && allData.OcrText.Length > 10;
            var hasVisionWebPages = webPagesFromVision.Count > 0;
            var hasMeaningfulWebResults = allData.WebSearchResults.Any(r => !_urlParser.IsMeaninglessTitle(r.Title ?? ""));
            
            if (!hasVisionWebPages || (!hasMeaningfulWebResults && !hasOcrData))
            {
                _logger.LogInformation($"[STEP 3.1] Vision Web Pages: {hasVisionWebPages}, Anlamlı Web Results: {hasMeaningfulWebResults}, OCR: {hasOcrData}");
                _logger.LogInformation("[STEP 3.1] Google Custom Search başlatılıyor...");
                
                // ÖNCELİK 1: OCR yoksa → Google Images Reverse Search
                if (!hasOcrData)
                {
                    _logger.LogInformation("[STEP 3.1] OCR verisi yok, Google Images Reverse Search yapılıyor...");
                    
                    var firstPhoto = photos.FirstOrDefault();
                    if (firstPhoto != null)
                    {
                        try
                        {
                            byte[] imageBytes;
                            using (var memoryStream = new MemoryStream())
                            {
                                await firstPhoto.CopyToAsync(memoryStream);
                                imageBytes = memoryStream.ToArray();
                            }
                            var base64Image = Convert.ToBase64String(imageBytes);
                            
                            var reverseSearchResults = await _webSearch.ScrapeGoogleImagesReverseSearchAsync(base64Image, firstPhoto.FileName);
                            
                            foreach (var result in reverseSearchResults)
                            {
                                allData.WebSearchResults.Add(result);
                                _logger.LogInformation($"[STEP 3.1] Reverse Image Search sonucu eklendi: {result.Title}");
                            }
                            
                            _logger.LogInformation($"[STEP 3.1] Toplam {reverseSearchResults.Count} Reverse Image Search sonucu eklendi");
                        }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[STEP 3.1] Reverse Image Search hatası, text-based search'e geçiliyor");
                    _metricsService.RecordError("ReverseImageSearch", ex.Message);
                }
                    }
                }
                
                // ÖNCELİK 2: Text-based Google Custom Search
                _logger.LogInformation("[STEP 3.1] Text-based Google Custom Search başlatılıyor...");
                var searchQueries = _webSearch.GenerateSearchQueries(allData);
                _logger.LogInformation($"[STEP 3.1] {searchQueries.Count} sorgu oluşturuldu: {string.Join(", ", searchQueries)}");
                
                foreach (var query in searchQueries.Take(8))
                {
                    _logger.LogInformation($"[STEP 3.1] Google Custom Search yapılıyor: '{query}'");
                    var webResults = await _webSearch.SearchWebForProductAsync(query, 10);
                    _logger.LogInformation($"[STEP 3.1] '{query}' sorgusu için {webResults.Count} sonuç bulundu");
                    
                    foreach (var result in webResults)
                    {
                        allData.WebSearchResults.Add(new SerpResult
                        {
                            Title = result.Title,
                            Snippet = result.Snippet,
                            Link = result.Link,
                            Source = "Google Custom Search"
                        });
                        _logger.LogInformation($"[STEP 3.1] Google Custom Search sonucu eklendi: {result.Title}");
                    }
                }
                
                _logger.LogInformation($"[STEP 3.1] Toplam {allData.WebSearchResults.Count} web arama sonucu eklendi");
            }
            else if (!hasOcrData && !hasMeaningfulWebResults)
            {
                // Vision Web Detection çalıştı ama OCR yok VE anlamlı sonuç yok → Google Custom Search yap
                _logger.LogInformation("[STEP 3.1] Vision Web Detection var ama OCR yok ve anlamlı sonuç yok, Google Custom Search yapılıyor...");
                
                var searchQueries = _webSearch.GenerateSearchQueries(allData);
                _logger.LogInformation($"[STEP 3.1] {searchQueries.Count} sorgu oluşturuldu: {string.Join(", ", searchQueries)}");
                
                foreach (var query in searchQueries.Take(8))
                {
                    _logger.LogInformation($"[STEP 3.1] Google Custom Search yapılıyor: '{query}'");
                    var webResults = await _webSearch.SearchWebForProductAsync(query, 10);
                    _logger.LogInformation($"[STEP 3.1] '{query}' sorgusu için {webResults.Count} sonuç bulundu");
                    
                    foreach (var result in webResults)
                    {
                        allData.WebSearchResults.Add(new SerpResult
                        {
                            Title = result.Title,
                            Snippet = result.Snippet,
                            Link = result.Link,
                            Source = "Google Custom Search"
                        });
                        _logger.LogInformation($"[STEP 3.1] Google Custom Search sonucu eklendi: {result.Title}");
                    }
                }
            }

            step3Stopwatch.Stop();
            await LogStepAsync(analysisLogId, "STEP 3", "Vision Web Detection Complete", 
                $"Vision Web Detection tamamlandı. Toplam {allData.WebSearchResults.Count} web sonucu eklendi.",
                durationMs: step3Stopwatch.ElapsedMilliseconds);

            // STEP 4: Yapay zeka ile final analiz
            var step4Stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("[STEP 4] Yapay zeka ile final analiz yapılıyor...");
            await LogStepAsync(analysisLogId, "STEP 4", "AI Product Identification", "Yapay zeka ile final analiz yapılıyor...");
            var finalResult = await _productIdentification.IdentifyProductAdvancedAsync(allData, language);
            step4Stopwatch.Stop();
            _logger.LogInformation($"[STEP 4] Final analiz tamamlandı: '{finalResult.ProductName}', Confidence: {finalResult.Confidence:F3}");
            await LogStepAsync(analysisLogId, "STEP 4", "AI Product Identification Complete", 
                $"Final analiz tamamlandı: '{finalResult.ProductName}', Confidence: {finalResult.Confidence:F3}",
                data: new { productName = finalResult.ProductName, confidence = finalResult.Confidence },
                durationMs: step4Stopwatch.ElapsedMilliseconds);

            // STEP 4.5: Kategori tespit et ve kategori özel bilgileri çıkar
            var step45Stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("[STEP 4.5] Ürün kategorisi tespit ediliyor...");
            await LogStepAsync(analysisLogId, "STEP 4.5", "Category Detection", "Ürün kategorisi tespit ediliyor...");
            var detectedCategory = _categoryDetection.DetectCategory(allData);
            step45Stopwatch.Stop();
            _logger.LogInformation($"[STEP 4.5] Tespit edilen kategori: {detectedCategory}");
            await LogStepAsync(analysisLogId, "STEP 4.5", "Category Detection Complete", 
                $"Kategori tespit edildi: {detectedCategory}",
                data: new { category = detectedCategory.ToString() },
                durationMs: step45Stopwatch.ElapsedMilliseconds);
            
            Models.CategorySpecificData? categorySpecificData = null;
            var extractor = _categoryExtractors.FirstOrDefault(e => e.Category == detectedCategory);
            if (extractor != null)
            {
                _logger.LogInformation($"[STEP 4.5] Kategori özel bilgiler çıkarılıyor: {detectedCategory}");
                categorySpecificData = extractor.ExtractCategoryData(allData, finalResult);
            }
            else
            {
                // Kategori özel extractor yoksa, genel bilgileri ekle
                categorySpecificData = new Models.CategorySpecificData();
            }
            
            // Dominant colors'ı ekle (her kategori için geçerli)
            var dominantColors = allData.VisionResults
                .SelectMany(v => v.DominantColors ?? new List<string>())
                .Distinct()
                .Take(5)
                .ToList();
            
            if (dominantColors.Any())
            {
                categorySpecificData.DominantColors = dominantColors;
                _logger.LogInformation($"[STEP 4.5] Dominant renkler eklendi: {string.Join(", ", dominantColors)}");
            }

            // STEP 5: AI ile zenginleştir (opsiyonel)
            if (finalResult.Confidence < 0.8)
            {
                var step5Stopwatch = Stopwatch.StartNew();
                try
                {
                    _logger.LogInformation("[STEP 5] AI zenginleştirme deneniyor...");
                    await LogStepAsync(analysisLogId, "STEP 5", "AI Enrichment", "AI zenginleştirme deneniyor...");
                    var aiResult = await _aiEnrichment.IdentifyProductWithAIAsync(allData, language);
                    step5Stopwatch.Stop();
                    
                    if (aiResult.Confidence > finalResult.Confidence + 0.1)
                    {
                        _logger.LogInformation($"[STEP 5] AI sonucu daha iyi: {aiResult.ProductName} (Confidence: {aiResult.Confidence:F3})");
                        finalResult = aiResult;
                        await LogStepAsync(analysisLogId, "STEP 5", "AI Enrichment Complete", 
                            $"AI sonucu daha iyi: {aiResult.ProductName} (Confidence: {aiResult.Confidence:F3})",
                            data: new { productName = aiResult.ProductName, confidence = aiResult.Confidence },
                            durationMs: step5Stopwatch.ElapsedMilliseconds);
                    }
                    else
                    {
                        await LogStepAsync(analysisLogId, "STEP 5", "AI Enrichment Skipped", 
                            "AI sonucu mevcut sonuçtan daha iyi değil, mevcut sonuç kullanılıyor",
                            durationMs: step5Stopwatch.ElapsedMilliseconds);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[STEP 5] AI zenginleştirme hatası, mevcut sonuç kullanılacak");
                    _metricsService.RecordError("AIEnrichment", ex.Message);
                    await LogStepAsync(analysisLogId, "STEP 5", "AI Enrichment Error", 
                        $"AI zenginleştirme hatası: {ex.Message}",
                        level: "Warning",
                        data: new { error = ex.Message });
                }
            }

            // STEP 6: Gemini AI ile ürün analizi (opsiyonel - API key varsa)
            string? geminiDescription = null;
            List<string> geminiHashtags = new List<string>();
            
            if (_geminiAnalysis != null && photos.Any())
            {
                var step6GeminiStopwatch = Stopwatch.StartNew();
                try
                {
                    _logger.LogInformation("[STEP 6] Gemini AI ile ürün analizi yapılıyor...");
                    await LogStepAsync(analysisLogId, "STEP 6", "Gemini AI Analysis", "Gemini AI ile ürün analizi yapılıyor...");
                    
                    var firstPhoto = photos.First();
                    byte[] imageBytes;
                    using (var memoryStream = new MemoryStream())
                    {
                        await firstPhoto.CopyToAsync(memoryStream);
                        imageBytes = memoryStream.ToArray();
                    }
                    
                    var geminiResult = await _geminiAnalysis.AnalyzeProductAsync(imageBytes, language);
                    step6GeminiStopwatch.Stop();
                    
                    if (!string.IsNullOrEmpty(geminiResult.Error))
                    {
                        _logger.LogWarning($"[STEP 6] Gemini AI hatası: {geminiResult.Error}");
                        await LogStepAsync(analysisLogId, "STEP 6", "Gemini AI Error", 
                            $"Gemini AI hatası: {geminiResult.Error}",
                            level: "Warning",
                            durationMs: step6GeminiStopwatch.ElapsedMilliseconds);
                    }
                    else
                    {
                        geminiDescription = geminiResult.Description;
                        geminiHashtags = geminiResult.Hashtags;
                        _logger.LogInformation($"[STEP 6] Gemini AI analizi tamamlandı: {geminiDescription}, Hashtag sayısı: {geminiHashtags.Count}");
                        await LogStepAsync(analysisLogId, "STEP 6", "Gemini AI Complete", 
                            $"Gemini AI analizi tamamlandı: {geminiDescription}, Hashtag sayısı: {geminiHashtags.Count}",
                            data: new { description = geminiDescription, hashtags = geminiHashtags },
                            durationMs: step6GeminiStopwatch.ElapsedMilliseconds);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[STEP 6] Gemini AI analizi hatası, fallback kullanılacak");
                    _metricsService.RecordError("GeminiAnalysis", ex.Message);
                    await LogStepAsync(analysisLogId, "STEP 6", "Gemini AI Error", 
                        $"Gemini AI analizi hatası: {ex.Message}",
                        level: "Warning",
                        data: new { error = ex.Message });
                }
            }

            // STEP 6.5: Gelişmiş hashtag'ler üret (Gemini hashtag'leri varsa onları da ekle)
            var step65Stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("[STEP 6.5] Gelişmiş hashtag'ler üretiliyor...");
            await LogStepAsync(analysisLogId, "STEP 6.5", "Hashtag Generation", "Gelişmiş hashtag'ler üretiliyor...");
            var enhancedHashtags = _hashtagGeneration.GenerateEnhancedHashtags(finalResult, allData);
            
            // Gemini hashtag'lerini ekle (eğer varsa ve henüz eklenmemişse)
            if (geminiHashtags.Any())
            {
                var existingHashtags = enhancedHashtags.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(h => h.ToLower().Replace("#", ""))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                
                foreach (var geminiHashtag in geminiHashtags)
                {
                    var hashtagClean = geminiHashtag.ToLower().Replace("#", "").Trim();
                    if (!string.IsNullOrEmpty(hashtagClean) && !existingHashtags.Contains(hashtagClean))
                    {
                        enhancedHashtags += $" #{hashtagClean}";
                    }
                }
            }
            
            step65Stopwatch.Stop();
            _logger.LogInformation($"[STEP 6.5] Üretilen hashtag'ler: {enhancedHashtags}");
            await LogStepAsync(analysisLogId, "STEP 6.5", "Hashtag Generation Complete", 
                $"Hashtag'ler üretildi: {enhancedHashtags}",
                data: new { hashtags = enhancedHashtags },
                durationMs: step65Stopwatch.ElapsedMilliseconds);

            stopwatch.Stop();
            _logger.LogInformation($"=== GELİŞMİŞ ANALİZ TAMAMLANDI (Süre: {stopwatch.ElapsedMilliseconds}ms) ===");
            await LogStepAsync(analysisLogId, "COMPLETE", "Analysis Complete", 
                $"Gelişmiş analiz tamamlandı. Süre: {stopwatch.ElapsedMilliseconds}ms",
                data: new { totalDurationMs = stopwatch.ElapsedMilliseconds, finalProductName = finalResult.ProductName, finalConfidence = finalResult.Confidence },
                durationMs: stopwatch.ElapsedMilliseconds);

            // Metrikleri kaydet
            try
            {
                _metricsService.RecordAnalysisResult(finalResult, allData, stopwatch.Elapsed);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[METRICS] Metrik kaydetme hatası");
            }

            // Hashtag'leri array'e çevir
            var hashtagList = enhancedHashtags.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).ToList();

            return new EnhancedAnalysisResult
            {
                DataCollection = allData,
                FinalIdentification = finalResult,
                Confidence = finalResult.Confidence,
                ProcessingTime = stopwatch.Elapsed,
                Hashtags = hashtagList,
                DetectedCategory = detectedCategory.ToString(),
                CategorySpecificData = categorySpecificData,
                GeminiDescription = geminiDescription,
                GeminiHashtags = geminiHashtags
            };
        }

        /// <summary>
        /// OCR metnini filtreler: anlamsız karakterleri ve Vision API sonuçlarıyla eşleşmeyen metinleri temizler
        /// </summary>
        private string FilterOcrText(string ocrText, AnalysisDataCollection data)
        {
            if (string.IsNullOrWhiteSpace(ocrText))
                return string.Empty;

            // Vision API'den çıkan label'ları ve web entity'leri al
            var visionLabels = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .Select(l => l.Description.ToUpper())
                .ToList();
            
            var visionWebEntities = data.VisionResults
                .SelectMany(v => v.WebEntities ?? new List<WebEntity>())
                .Select(e => e.Description.ToUpper())
                .ToList();

            var visionBestGuesses = data.VisionResults
                .Where(v => !string.IsNullOrEmpty(v.BestGuessLabel))
                .Select(v => v.BestGuessLabel!.ToUpper())
                .ToList();

            var allVisionKeywords = visionLabels
                .Concat(visionWebEntities)
                .Concat(visionBestGuesses)
                .Distinct()
                .ToList();

            // OCR metnini kelimelere ayır
            var words = ocrText.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            var filteredWords = new List<string>();

            foreach (var word in words)
            {
                var wordUpper = word.ToUpper().Trim();
                
                // Boş veya çok kısa kelimeleri atla
                if (string.IsNullOrWhiteSpace(word) || word.Length < 2)
                    continue;

                // Anlamsız karakterler içeren kelimeleri filtrele (örn: "目", "199 M 目")
                // Çince/Japonca karakterler, emoji'ler vb.
                if (System.Text.RegularExpressions.Regex.IsMatch(word, @"[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]"))
                {
                    _logger.LogInformation($"[OCR FILTER] Anlamsız karakter içeren kelime filtrelendi: '{word}'");
                    continue;
                }

                // Sadece sayı ve tek harf kombinasyonları (örn: "199 M") - Vision API ile eşleşmiyorsa filtrele
                if (System.Text.RegularExpressions.Regex.IsMatch(wordUpper, @"^\d+\s*[A-Z]$") || 
                    System.Text.RegularExpressions.Regex.IsMatch(wordUpper, @"^[A-Z]\s*\d+$"))
                {
                    // Vision API sonuçlarında bu kelime geçiyorsa tut, yoksa filtrele
                    var isInVisionResults = allVisionKeywords.Any(k => k.Contains(wordUpper) || wordUpper.Contains(k));
                    if (!isInVisionResults)
                    {
                        _logger.LogInformation($"[OCR FILTER] Sayı+harf kombinasyonu filtrelendi (Vision API ile eşleşmiyor): '{word}'");
                        continue;
                    }
                }

                // Tek karakterli kelimeleri filtrele (Vision API ile eşleşmiyorsa)
                if (word.Length == 1 && !allVisionKeywords.Any(k => k.Contains(wordUpper)))
                {
                    _logger.LogInformation($"[OCR FILTER] Tek karakterli kelime filtrelendi: '{word}'");
                    continue;
                }

                // Vision API sonuçlarıyla eşleşen kelimeleri tut
                var matchesVision = allVisionKeywords.Any(k => 
                    k.Contains(wordUpper) || 
                    wordUpper.Contains(k) ||
                    k.Split(' ').Any(vw => vw == wordUpper) ||
                    wordUpper.Split(' ').Any(ow => k.Contains(ow)));

                if (matchesVision)
                {
                    filteredWords.Add(word);
                    _logger.LogInformation($"[OCR FILTER] Kelime Vision API ile eşleşti, tutuldu: '{word}'");
                }
                else
                {
                    // Eğer kelime sayısal bir model numarası gibi görünüyorsa (örn: "199"), tut
                    if (System.Text.RegularExpressions.Regex.IsMatch(wordUpper, @"^\d{2,6}$"))
                    {
                        filteredWords.Add(word);
                        _logger.LogInformation($"[OCR FILTER] Model numarası gibi görünen kelime tutuldu: '{word}'");
                    }
                    else if (System.Text.RegularExpressions.Regex.IsMatch(wordUpper, @"^[A-Z]{2,10}$"))
                    {
                        // Büyük harflerle yazılmış kelimeler (marka/model olabilir)
                        filteredWords.Add(word);
                        _logger.LogInformation($"[OCR FILTER] Büyük harfli kelime tutuldu: '{word}'");
                    }
                    else
                    {
                        _logger.LogInformation($"[OCR FILTER] Vision API ile eşleşmeyen kelime filtrelendi: '{word}'");
                    }
                }
            }

            var filteredText = string.Join(" ", filteredWords);
            
            // Eğer filtrelenmiş metin çok kısaldıysa (orijinalin %20'sinden az), orijinal metni döndür
            // Çünkü belki çok fazla filtreleme yaptık
            if (filteredText.Length < ocrText.Length * 0.2 && ocrText.Length > 10)
            {
                _logger.LogWarning($"[OCR FILTER] Filtrelenmiş metin çok kısaldı ({filteredText.Length} < {ocrText.Length * 0.2}), orijinal metin kullanılıyor");
                return ocrText;
            }

            return filteredText;
        }
    }
}
