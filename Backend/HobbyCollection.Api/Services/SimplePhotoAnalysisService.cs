using HobbyCollection.Api.Models;
using HobbyCollection.Api.Services.Analysis;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace HobbyCollection.Api.Services
{
    public interface IEnhancedPhotoAnalysisService
    {
        Task<EnhancedAnalysisResult> EnhancedProductAnalysisAsync(List<IFormFile> photos, string language = "en", string? analysisLogId = null);
    }

    public interface ISimplePhotoAnalysisService
    {
        Task<EnhancedAnalysisResult> AnalyzeProductAsync(List<IFormFile> photos, string language = "en", string? analysisLogId = null);
    }

    public class SimplePhotoAnalysisService : ISimplePhotoAnalysisService, IEnhancedPhotoAnalysisService
    {
        private readonly ILogger<SimplePhotoAnalysisService> _logger;
        private readonly IGeminiAnalysisService? _geminiAnalysis;

        public SimplePhotoAnalysisService(
            ILogger<SimplePhotoAnalysisService> logger,
            IGeminiAnalysisService? geminiAnalysis = null)
        {
            _logger = logger;
            _geminiAnalysis = geminiAnalysis;
        }

        public async Task<EnhancedAnalysisResult> AnalyzeProductAsync(List<IFormFile> photos, string language = "en", string? analysisLogId = null)
        {
            return await AnalyzeProductSimpleAsync(photos, language);
        }

        public async Task<EnhancedAnalysisResult> EnhancedProductAnalysisAsync(List<IFormFile> photos, string language = "en", string? analysisLogId = null)
        {
            return await AnalyzeProductSimpleAsync(photos, language);
        }

        private async Task<EnhancedAnalysisResult> AnalyzeProductSimpleAsync(List<IFormFile> photos, string language = "en")
        {
            var stopwatch = Stopwatch.StartNew();
            _logger.LogInformation($"=== BASİT ANALİZ BAŞLATILIYOR === (Dil: {language})");

            if (photos == null || !photos.Any())
            {
                _logger.LogWarning("Fotoğraf bulunamadı");
                return new EnhancedAnalysisResult
                {
                    Confidence = 0.0,
                    ProcessingTime = stopwatch.Elapsed
                };
            }

            // Gemini analizi yap - sırayla fotoğrafları dene, sonuç bulunana kadar devam et
            string? geminiDescription = null;
            List<string> geminiHashtags = new List<string>();
            int analyzedPhotoCount = 0;
            bool foundResult = false;

            if (_geminiAnalysis != null)
            {
                // Fotoğrafları sırayla analiz et, sonuç bulunana kadar devam et
                foreach (var photo in photos)
                {
                    analyzedPhotoCount++;
                    _logger.LogInformation($"[BASİT ANALİZ] Fotoğraf {analyzedPhotoCount}/{photos.Count} analiz ediliyor: {photo.FileName}");

                    try
                    {
                        byte[] imageBytes;
                        using (var memoryStream = new MemoryStream())
                        {
                            await photo.CopyToAsync(memoryStream);
                            imageBytes = memoryStream.ToArray();
                        }

                        _logger.LogInformation($"[BASİT ANALİZ] Gemini AI ile ürün analizi yapılıyor (Fotoğraf {analyzedPhotoCount})...");
                    var geminiResult = await _geminiAnalysis.AnalyzeProductAsync(imageBytes, language);

                    if (!string.IsNullOrEmpty(geminiResult.Error))
                    {
                            _logger.LogWarning($"[BASİT ANALİZ] Fotoğraf {analyzedPhotoCount} için Gemini AI hatası: {geminiResult.Error}");
                            // Hata varsa bir sonraki fotoğrafa geç
                            continue;
                        }

                        // Sonuç kontrolü: Eğer description veya hashtag varsa, sonuç bulundu kabul et
                        var hasDescription = !string.IsNullOrWhiteSpace(geminiResult.Description);
                        var hasHashtags = geminiResult.Hashtags != null && geminiResult.Hashtags.Any();

                        if (hasDescription || hasHashtags)
                    {
                        geminiDescription = geminiResult.Description;
                            geminiHashtags = geminiResult.Hashtags ?? new List<string>();
                            foundResult = true;
                            
                            _logger.LogInformation($"[BASİT ANALİZ] Fotoğraf {analyzedPhotoCount}'den sonuç bulundu!");
                        _logger.LogInformation($"[BASİT ANALİZ] Gemini AI analizi tamamlandı: {geminiDescription}, Hashtag sayısı: {geminiHashtags.Count}");
                            if (geminiHashtags.Any())
                            {
                        _logger.LogInformation($"[BASİT ANALİZ] Hashtag'ler: {string.Join(", ", geminiHashtags)}");
                    }
                            
                            // Sonuç bulundu, diğer fotoğrafları analiz etmeye gerek yok
                            break;
                        }
                        else
                        {
                            _logger.LogInformation($"[BASİT ANALİZ] Fotoğraf {analyzedPhotoCount}'den sonuç bulunamadı (description veya hashtag yok), bir sonraki fotoğrafa geçiliyor...");
                        }
                    }
                    catch (Exception ex)
                {
                        _logger.LogWarning(ex, $"[BASİT ANALİZ] Fotoğraf {analyzedPhotoCount} için Gemini AI analizi hatası, bir sonraki fotoğrafa geçiliyor");
                        // Hata durumunda bir sonraki fotoğrafa geç
                        continue;
                    }
                }

                if (!foundResult)
                {
                    _logger.LogWarning($"[BASİT ANALİZ] Tüm {analyzedPhotoCount} fotoğraf analiz edildi ancak sonuç bulunamadı");
                }
                else
                {
                    _logger.LogInformation($"[BASİT ANALİZ] Toplam {analyzedPhotoCount} fotoğraf analiz edildi, sonuç bulundu. Maliyet optimizasyonu: {photos.Count - analyzedPhotoCount} fotoğraf atlandı.");
                }
            }
            else
            {
                _logger.LogWarning("[BASİT ANALİZ] Gemini AI servisi yapılandırılmamış");
            }

            stopwatch.Stop();
            _logger.LogInformation($"=== BASİT ANALİZ TAMAMLANDI (Süre: {stopwatch.ElapsedMilliseconds}ms) ===");

            // Gemini'den gelen description'ı product name olarak kullan
            var productName = !string.IsNullOrEmpty(geminiDescription) 
                ? geminiDescription 
                : (language == "tr" ? "Ürün analiz edilemedi" : "Product could not be analyzed");

            // Dil ayarına göre reasoning mesajı
            var reasoningMessage = !string.IsNullOrEmpty(geminiDescription)
                ? (language == "tr" ? "Gemini AI analizi ile ürün tanımlandı" : "Product identified by Gemini AI analysis")
                : (language == "tr" ? "Gemini AI analizi yapılamadı" : "Gemini AI analysis could not be performed");

            return new EnhancedAnalysisResult
            {
                DataCollection = new AnalysisDataCollection(),
                FinalIdentification = new ProductIdentificationResult
                {
                    ProductName = productName,
                    Brand = string.Empty,
                    Model = string.Empty,
                    Confidence = !string.IsNullOrEmpty(geminiDescription) ? 0.85 : 0.0,
                    Reasoning = reasoningMessage,
                    Evidence = new List<string> { "Gemini AI Analysis" }
                },
                Confidence = !string.IsNullOrEmpty(geminiDescription) ? 0.85 : 0.0,
                ProcessingTime = stopwatch.Elapsed,
                Hashtags = geminiHashtags,
                DetectedCategory = null,
                CategorySpecificData = null,
                GeminiDescription = geminiDescription,
                GeminiHashtags = geminiHashtags
            };
        }
    }
}

