using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using HobbyCollection.Api.Services;
using HobbyCollection.Api.Models;
using System.IO;
using System.Collections.Generic;
using System.Security.Claims;
using HobbyCollection.Domain.Services;
using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PhotoAnalysisController : ControllerBase
{
    private readonly IEnhancedPhotoAnalysisService _enhancedPhotoAnalysisService;
    private readonly ILogger<PhotoAnalysisController> _logger;
    private readonly HobbyCollection.Api.Services.Analysis.AnalysisMetricsService _metricsService;
    private readonly IAnalysisLogService _analysisLogService;
    private readonly IAICreditService _creditService;

    public PhotoAnalysisController(
        IEnhancedPhotoAnalysisService enhancedPhotoAnalysisService,
        ILogger<PhotoAnalysisController> logger,
        HobbyCollection.Api.Services.Analysis.AnalysisMetricsService metricsService,
        IAnalysisLogService analysisLogService,
        IAICreditService creditService)
    {
        _enhancedPhotoAnalysisService = enhancedPhotoAnalysisService;
        _logger = logger;
        _metricsService = metricsService;
        _analysisLogService = analysisLogService;
        _creditService = creditService;
    }


    /// <summary>
    /// Gelişmiş analiz yapar (Google Vertex AI + Vision + Web Search)
    /// </summary>
    /// <param name="photos">1-10 arası fotoğraf dosyası</param>
    /// <param name="language">AI analiz dili (tr, en, vb.)</param>
    /// <returns>Gelişmiş analiz sonucu</returns>
    [HttpPost("enhanced")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50MB limit
    [RequestFormLimits(MultipartBodyLengthLimit = 50 * 1024 * 1024)]
    public async Task<ActionResult<EnhancedAnalysisResponse>> EnhancedAnalysis([FromForm] List<IFormFile> photos, [FromForm] string? language)
    {
        try
        {
            // Validasyonlar
            if (photos == null || !photos.Any())
            {
                return BadRequest(new EnhancedAnalysisResponse
                {
                    Success = false,
                    Message = "En az bir fotoğraf gönderilmelidir."
                });
            }

            if (photos.Count > 10)
            {
                return BadRequest(new EnhancedAnalysisResponse
                {
                    Success = false,
                    Message = "En fazla 10 fotoğraf gönderilebilir."
                });
            }

            // Dosya türü ve boyut kontrolleri
            var allowedMimeTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/webp" };
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var maxFileSize = 10 * 1024 * 1024; // 10MB per file

            foreach (var photo in photos)
            {
                // MIME type kontrolü (esnek)
                var mimeTypeValid = allowedMimeTypes.Contains(photo.ContentType?.ToLower()) ||
                                   photo.ContentType?.ToLower().StartsWith("image/") == true;

                // Dosya uzantısı kontrolü
                var fileExtension = Path.GetExtension(photo.FileName)?.ToLower();
                var extensionValid = !string.IsNullOrEmpty(fileExtension) &&
                                   allowedExtensions.Contains(fileExtension);

                if (!mimeTypeValid && !extensionValid)
                {
                    return BadRequest(new EnhancedAnalysisResponse
                    {
                        Success = false,
                        Message = $"Desteklenmeyen dosya türü: {photo.ContentType} (uzantı: {fileExtension}). Sadece JPEG, PNG ve WebP desteklenmektedir."
                    });
                }

                _logger.LogInformation($"Dosya kabul edildi: {photo.FileName}, MIME: {photo.ContentType}, Uzantı: {fileExtension}");

                if (photo.Length > maxFileSize)
                {
                    return BadRequest(new EnhancedAnalysisResponse
                    {
                        Success = false,
                        Message = $"Dosya boyutu çok büyük: {photo.FileName}. Maksimum 10MB olmalıdır."
                    });
                }

                if (photo.Length == 0)
                {
                    return BadRequest(new EnhancedAnalysisResponse
                    {
                        Success = false,
                        Message = $"Boş dosya: {photo.FileName}"
                    });
                }
            }

            // Dil parametresini normalize et
            var analysisLanguage = string.IsNullOrWhiteSpace(language) ? "en" : language.ToLower();
            _logger.LogInformation($"Gelişmiş fotoğraf analizi başlatılıyor. Dosya sayısı: {photos.Count}, Dil: {analysisLanguage}");

            // Kullanıcı ID'sini al (varsa)
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";

            // AI Kredi kontrolü (authenticated kullanıcılar için)
            if (userId != "anonymous")
            {
                var hasSufficientCredits = await _creditService.HasSufficientCreditsAsync(userId, AIOperationType.ProductRecognition);
                if (!hasSufficientCredits)
                {
                    var balance = await _creditService.GetUserBalanceAsync(userId);
                    var operationCost = await _creditService.GetOperationCostAsync(AIOperationType.ProductRecognition);
                    var requiredCredits = operationCost?.CreditCost ?? 3; // Fallback
                    return BadRequest(new EnhancedAnalysisResponse
                    {
                        Success = false,
                        Message = $"Yetersiz AI kredisi. Bu işlem için {requiredCredits} kredi gereklidir. Mevcut bakiye: {balance}"
                    });
                }
                
                _logger.LogInformation($"Kullanıcı {userId} için AI kredi kontrolü başarılı. İşlem başlatılıyor.");
            }

            // Analiz logunu başlat
            string? analysisLogId = null;
            try
            {
                analysisLogId = await _analysisLogService.StartAnalysisAsync(userId, photos.Count, analysisLanguage);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Analiz log başlatılamadı, analiz devam edecek");
            }

            // Gelişmiş analiz yap (dil parametresi ile)
            EnhancedAnalysisResult? result = null;
            Exception? analysisException = null;
            bool analysisSuccessful = false;
            
            try
            {
                result = await _enhancedPhotoAnalysisService.EnhancedProductAnalysisAsync(photos, analysisLanguage, analysisLogId);
                analysisSuccessful = true;
            }
            catch (Exception ex)
            {
                analysisException = ex;
                _logger.LogError(ex, $"Gelişmiş analiz başarısız oldu. UserId: {userId}");
                // Exception'ı şimdilik fırlatmıyoruz, önce kredi ve log işlemlerini yapalım
            }

            // ÖNCE: Analiz logunu tamamla (kredi harcama işleminden önce)
            // Böylece AnalysisLogs hatası kredi harcamayı etkilemez
            if (!string.IsNullOrEmpty(analysisLogId))
            {
                try
                {
                    await _analysisLogService.CompleteAnalysisAsync(
                        analysisLogId,
                        productId: null,
                        result?.FinalIdentification?.ProductName,
                        result?.FinalIdentification?.Confidence,
                        result?.DetectedCategory,
                        (long)(result?.ProcessingTime.TotalMilliseconds ?? 0),
                        analysisSuccessful,
                        analysisException?.Message
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Analiz log tamamlanamadı (kredi harcama devam edecek)");
                }
            }

            // SONRA: AI Kredi harcama (authenticated kullanıcılar için)
            // Sadece analiz başarılıysa kredi harca
            if (userId != "anonymous" && analysisSuccessful && result != null)
            {
                try
                {
                    var productName = result?.FinalIdentification?.ProductName ?? "Tanımlanamadı";
                    
                    _logger.LogInformation($"Kredi harcama başlatılıyor - UserId: {userId}, ProductName: {productName}");
                    
                    var transaction = await _creditService.SpendCreditsAsync(
                        userId, 
                        AIOperationType.ProductRecognition,
                        $"Ürün tanıma: {productName}",
                        productId: null
                    );
                    
                    var operationCost = await _creditService.GetOperationCostAsync(AIOperationType.ProductRecognition);
                    var creditsSpent = operationCost?.CreditCost ?? 3;
                    
                    _logger.LogInformation($"✅ Kullanıcı {userId} için {creditsSpent} AI kredisi başarıyla harcandı (Ürün tanıma). Transaction ID: {transaction?.Id}");
                }
                catch (Exception ex)
                {
                    // Kredi harcama hatası kritik - logla ama analiz sonucunu döndürmeye devam et
                    _logger.LogError(ex, $"🚨 AI kredi işlemi sırasında KRİTİK HATA (UserId: {userId}). StackTrace: {ex.StackTrace}");
                    // Kredi harcama hatası analiz sonucunu etkilememeli
                }
            }
            else if (userId != "anonymous" && !analysisSuccessful)
            {
                _logger.LogWarning($"❌ Analiz başarısız olduğu için kullanıcı {userId} için AI kredisi harcanmadı. Exception: {analysisException?.Message}");
            }

            // Analiz başarısızsa exception'ı fırlat
            if (!analysisSuccessful && analysisException != null)
            {
                throw analysisException;
            }

            _logger.LogInformation("Gelişmiş fotoğraf analizi tamamlandı.");
            _logger.LogInformation($"Sonuç: {result?.FinalIdentification?.ProductName}, Hashtag sayısı: {result?.Hashtags?.Count ?? 0}");
            if (result?.Hashtags != null && result.Hashtags.Any())
            {
                _logger.LogInformation($"Hashtag'ler: {string.Join(", ", result.Hashtags)}");
            }

            return Ok(new EnhancedAnalysisResponse
            {
                Success = true,
                Message = "Gelişmiş analiz başarıyla tamamlandı.",
                Result = result
            });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Gelişmiş analiz için geçersiz parametre");
            return BadRequest(new EnhancedAnalysisResponse
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gelişmiş fotoğraf analizi sırasında hata oluştu");
            return StatusCode(500, new EnhancedAnalysisResponse
            {
                Success = false,
                Message = "Gelişmiş analiz sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin."
            });
        }
    }

    /// <summary>
    /// API'nin sağlık durumunu kontrol eder
    /// </summary>
    [HttpGet("health")]
    public ActionResult<object> HealthCheck()
    {
        return Ok(new 
        { 
            status = "healthy", 
            service = "EnhancedPhotoAnalysisService",
            timestamp = DateTime.UtcNow,
            version = "1.0.0"
        });
    }


    /// <summary>
    /// Desteklenen dosya türleri ve limitleri hakkında bilgi verir
    /// </summary>
    [HttpGet("info")]
    public ActionResult<object> GetServiceInfo()
    {
        return Ok(new
        {
            supportedFormats = new[] { "image/jpeg", "image/png", "image/webp" },
            maxFiles = 10,
            maxFileSizeBytes = 10 * 1024 * 1024,
            maxTotalSizeBytes = 50 * 1024 * 1024,
            features = new[]
            {
                "Nesne tanıma",
                "Marka/model tespiti",
                "Metin çıkarma (OCR)",
                "Otomatik başlık üretimi",
                "Açıklama oluşturma",
                "Hashtag önerisi",
                "Dönem tahmini",
                "Malzeme analizi"
            }
        });
    }

    /// <summary>
    /// Analiz metriklerini döndürür
    /// </summary>
    [HttpGet("metrics")]
    [Authorize] // Sadece yetkili kullanıcılar görebilir
    public ActionResult<object> GetMetrics()
    {
        try
        {
            var todayMetrics = _metricsService.GetTodayMetrics();
            var allMetrics = _metricsService.GetAllMetrics();
            
            return Ok(new
            {
                today = todayMetrics,
                all = allMetrics,
                summary = new
                {
                    totalAnalyses = todayMetrics.TotalAnalyses,
                    successRate = todayMetrics.TotalAnalyses > 0 
                        ? (todayMetrics.SuccessfulIdentifications * 100.0 / todayMetrics.TotalAnalyses) 
                        : 0.0,
                    averageConfidence = todayMetrics.AverageConfidence,
                    averageProcessingTimeMs = todayMetrics.AverageProcessingTime.TotalMilliseconds
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Metrikler alınırken hata oluştu");
            return StatusCode(500, new { error = "Metrikler alınamadı" });
        }
    }

    /// <summary>
    /// Metrikleri logla (debug için)
    /// </summary>
    [HttpPost("metrics/log")]
    [Authorize] // Sadece yetkili kullanıcılar kullanabilir
    public ActionResult LogMetrics()
    {
        try
        {
            _metricsService.LogMetrics();
            return Ok(new { message = "Metrikler loglandı" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Metrikler loglanırken hata oluştu");
            return StatusCode(500, new { error = "Metrikler loglanamadı" });
        }
    }
}
