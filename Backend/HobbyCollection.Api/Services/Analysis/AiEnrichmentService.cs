using System.Text;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Responses;
using HobbyCollection.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;

namespace HobbyCollection.Api.Services.Analysis
{
    public class AiEnrichmentService : IAiEnrichmentService
    {
        private readonly ILogger<AiEnrichmentService> _logger;
        private readonly IProductIdentificationService _productIdentification;
        private readonly string? _vertexAiProjectId;
        private readonly string? _vertexAiLocation;

        public AiEnrichmentService(
            ILogger<AiEnrichmentService> logger,
            IProductIdentificationService productIdentification,
            Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _logger = logger;
            _productIdentification = productIdentification;
            _vertexAiProjectId = configuration["VertexAI:ProjectId"];
            _vertexAiLocation = configuration["VertexAI:Location"];
        }

        public async Task<ProductIdentificationResult> IdentifyProductWithAIAsync(AnalysisDataCollection data, string language = "en")
        {
            if (string.IsNullOrEmpty(_vertexAiProjectId) || string.IsNullOrEmpty(_vertexAiLocation))
            {
                _logger.LogWarning("[AI] Vertex AI yapılandırması eksik, basit strateji kullanılıyor");
                return _productIdentification.IdentifyProductSimple(data);
            }

            try
            {
                var prompt = GenerateAIPrompt(data, language);
                _logger.LogInformation($"[AI] Vertex AI çağrısı yapılıyor (dil: {language})");
                _logger.LogDebug($"[AI] Prompt: {prompt.Substring(0, Math.Min(500, prompt.Length))}...");

                var aiResult = await CallVertexAIAsync(prompt);

                if (!string.IsNullOrEmpty(aiResult))
                {
                    _logger.LogInformation($"[AI] Yanıt alındı, parsing yapılıyor...");
                    var parsed = ParseAIResponse(aiResult);
                    
                    _logger.LogInformation($"[AI] Parse edildi - ProductName: {parsed.ProductName}, Brand: {parsed.Brand}, Model: {parsed.Model}, Confidence: {parsed.Confidence:F3}");
                    
                    if (parsed.Confidence > 0.3) // Minimum confidence
                    {
                        return parsed;
                    }
                    else
                    {
                        _logger.LogWarning($"[AI] Güven seviyesi çok düşük: {parsed.Confidence:F3}");
                    }
                }
                else
                {
                    _logger.LogWarning("[AI] Vertex AI boş yanıt döndürdü");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AI] Vertex AI hatası");
            }

            return _productIdentification.IdentifyProductSimple(data);
        }

        private string GenerateAIPrompt(AnalysisDataCollection data, string language = "en")
        {
            // Web Detection verilerini topla
            var bestGuesses = data.VisionResults
                .Where(v => !string.IsNullOrEmpty(v.BestGuessLabel))
                .Select(v => v.BestGuessLabel)
                .Distinct()
                .ToList();

            var webEntities = data.VisionResults
                .SelectMany(v => v.WebEntities ?? new List<WebEntity>())
                .OrderByDescending(e => e.Score)
                .Take(5)
                .Select(e => $"{e.Description}({e.Score:F2})")
                .ToList();

            var webPages = data.VisionResults
                .SelectMany(v => v.WebPages ?? new List<WebPage>())
                .Take(3)
                .Select(p => p.PageTitle)
                .ToList();

            // Dil-spesifik prompt başlıkları
            var languageInstructions = language.ToLower() == "tr" 
                ? "Lütfen açıklama ve hashtag'leri TÜRKÇE oluştur. Marka ve model adları evrensel olmalı (İngilizce)."
                : "Please generate description and hashtags in ENGLISH. Brand and model names should be universal (English).";

            // Vision Labels'ları en üstte göster
            var topLabels = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .GroupBy(l => l.Description)
                .Select(g => new { Description = g.Key, Score = g.Average(l => l.Score) })
                .OrderByDescending(g => g.Score)
                .Take(10)
                .Select(l => $"{l.Description}({l.Score:F2})")
                .ToList();

            var prompt = $@"You are an EXPERT product identification AI specializing in ALL collectibles: gaming, cameras, watches, toys, stamps, coins, books, vinyl records, and vintage electronics.

## 🎯 DATA SOURCES (USE ALL INTELLIGENTLY):

### 1. 📝 OCR TEXT (Brand/Model Extraction):
{data.OcrText}
→ Look for BRAND NAMES (KODAK, NINTENDO, SONY, ROLEX, etc.)
→ Look for MODEL NUMBERS (EK6, AGS-101, DSC-W800, etc.)
→ Look for PRODUCT TYPES (INSTANT CAMERA, GAME BOY, WATCH, etc.)
✅ USE: Brand names and model numbers are usually accurate
⚠️ IGNORE: Random text, scanning artifacts

### 2. ⭐ VISION API LABELS (Product Category):
{string.Join(", ", topLabels)}
→ Best for identifying WHAT TYPE of product (camera, game console, watch, etc.)
→ Labels with 0.9+ score are highly reliable

### 3. 🌐 GOOGLE WEB DETECTION (Validation):
- Best Guess: {string.Join(", ", bestGuesses)}
- Web Entities: {string.Join(", ", webEntities.Take(10))}
- Related web pages: {string.Join(" | ", webPages.Take(5))}

### 4. 🔍 WEB SEARCH (Context):
{string.Join(" | ", data.WebSearchResults.Take(3).Select(r => r.Title))}

## 📋 SMART IDENTIFICATION STRATEGY:

**STEP 1: Extract from OCR**
- Find BRAND: Look for known brands (KODAK, NINTENDO, SONY, CANON, ROLEX, etc.)
- Find MODEL: Look for alphanumeric codes (EK6, AGS-101, F-91W, etc.)
- Find PRODUCT TYPE: Look for product keywords (CAMERA, GAME BOY, WATCH, etc.)

**STEP 2: Validate with Vision Labels**
- Confirm the product TYPE matches labels (e.g., if OCR says CAMERA, labels should show Cameras & optics)

**STEP 3: Enhance with Web Detection**
- Add missing details from Web Entities

**STEP 4: Combine intelligently**
- Format: [BRAND] [PRODUCT TYPE] [MODEL]
- Example: KODAK INSTANT CAMERA EK6
- Example: NINTENDO GAME BOY ADVANCE SP AGS-101

## ⚖️ CONFIDENCE SCORING:
- 0.9+: OCR brand + OCR model + Vision Label match
- 0.8-0.9: OCR brand + Vision Label match
- 0.7-0.8: Clear brand or model from any source
- 0.5-0.7: Generic category only
- <0.5: No clear identification

## 🌍 LANGUAGE:
{languageInstructions}

## OUTPUT FORMAT (JSON):
{{
  ""productName"": ""Complete product name (e.g., Nintendo Game Boy Advance SP AGS-101)"",
  ""brand"": ""Brand name only (e.g., Nintendo)"",
  ""model"": ""Model/variant only (e.g., Game Boy Advance SP AGS-101)"",
  ""confidence"": confidence score 0.0-1.0,
  ""reasoning"": ""Explanation in {(language.ToLower() == "tr" ? "Turkish" : "English")} - Which sources were used and why"",
  ""evidence"": [""Source 1"", ""Source 2"", ""Source 3""]
}}

Think step-by-step and explain your reasoning clearly.";

            return prompt;
        }

        private async Task<string> CallVertexAIAsync(string prompt)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);

                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generation_config = new
                    {
                        temperature = 0.1,
                        max_output_tokens = 1000
                    }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Güncel model formatı: gemini-1.5-flash-latest (latest stable version)
                var url = $"https://{_vertexAiLocation}-aiplatform.googleapis.com/v1/projects/{_vertexAiProjectId}/locations/{_vertexAiLocation}/publishers/google/models/gemini-1.5-flash-latest:generateContent";

                // Google Cloud credentials kullanarak Bearer token al - SCOPES ile
                var credentials = GoogleCredential.GetApplicationDefault()
                    .CreateScoped("https://www.googleapis.com/auth/cloud-platform");
                
                var tokenResponse = await ((ITokenAccess)credentials).GetAccessTokenForRequestAsync(url);

                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenResponse);

                _logger.LogInformation($"[AI] Vertex AI çağrısı yapılıyor (token length: {tokenResponse?.Length ?? 0})");

                var response = await httpClient.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"[AI] Vertex AI hatası: {response.StatusCode} - {errorBody}");
                    return string.Empty;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                _logger.LogInformation($"[AI VALIDATION] Vertex AI yanıtı: {responseJson.Substring(0, Math.Min(200, responseJson.Length))}");

                var vertexResponse = JsonSerializer.Deserialize<VertexAIResponse>(responseJson);

                return vertexResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AI VALIDATION] Vertex AI çağrısı hatası");
                return string.Empty;
            }
        }

        private ProductIdentificationResult ParseAIResponse(string aiResponse)
        {
            try
            {
                // Basit JSON parsing
                var result = new ProductIdentificationResult();

                // AI yanıtından JSON çıkar
                var jsonStart = aiResponse.IndexOf('{');
                var jsonEnd = aiResponse.LastIndexOf('}');

                if (jsonStart >= 0 && jsonEnd > jsonStart)
                {
                    var json = aiResponse.Substring(jsonStart, jsonEnd - jsonStart + 1);

                    try
                    {
                        var parsed = JsonSerializer.Deserialize<JsonElement>(json);

                        result.ProductName = parsed.GetProperty("productName").GetString() ?? "Bilinmeyen Ürün";
                        result.Brand = parsed.GetProperty("brand").GetString() ?? "";
                        result.Model = parsed.GetProperty("model").GetString() ?? "";
                        result.Confidence = parsed.GetProperty("confidence").GetDouble();
                        result.Reasoning = parsed.GetProperty("reasoning").GetString() ?? "";

                        if (parsed.TryGetProperty("evidence", out var evidence))
                        {
                            result.Evidence = evidence.EnumerateArray()
                                .Select(e => e.GetString() ?? "")
                                .Where(e => !string.IsNullOrEmpty(e))
                                .ToList();
                        }
                    }
                    catch
                    {
                        // JSON parse edilemezse basit text parsing
                        result.ProductName = ExtractProductNameFromText(aiResponse);
                        result.Confidence = 0.5;
                        result.Reasoning = "AI yanıtından çıkarıldı";
                    }
                }
                else
                {
                    result.ProductName = ExtractProductNameFromText(aiResponse);
                    result.Confidence = 0.5;
                    result.Reasoning = "AI yanıtından çıkarıldı";
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AI VALIDATION] AI yanıtı parse edilemedi");
                return new ProductIdentificationResult
                {
                    ProductName = "Bilinmeyen Ürün",
                    Confidence = 0.0,
                    Reasoning = "AI yanıtı parse edilemedi"
                };
            }
        }

        private string ExtractProductNameFromText(string text)
        {
            // Basit text extraction
            var lines = text.Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
            return lines.FirstOrDefault() ?? "Bilinmeyen Ürün";
        }
    }

    // Helper class for Vertex AI response
    public class VertexAIResponse
    {
        public List<VertexAICandidate>? candidates { get; set; }
    }

    public class VertexAICandidate
    {
        public VertexAIContent? content { get; set; }
    }

    public class VertexAIContent
    {
        public List<VertexAIPart>? parts { get; set; }
    }

    public class VertexAIPart
    {
        public string? text { get; set; }
    }
}

