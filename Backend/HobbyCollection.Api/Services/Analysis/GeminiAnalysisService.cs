using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace HobbyCollection.Api.Services.Analysis
{
    public class GeminiAnalysisService : IGeminiAnalysisService
    {
        private readonly ILogger<GeminiAnalysisService> _logger;
        private readonly IConfiguration _configuration;
        private readonly GoogleCredential? _googleCredential;
        private readonly string? _projectId;
        private readonly string? _location;
        private readonly string? _apiKey;

        public GeminiAnalysisService(
            ILogger<GeminiAnalysisService> logger, 
            IConfiguration configuration,
            GoogleCredential? googleCredential = null)
        {
            _logger = logger;
            _configuration = configuration;
            _googleCredential = googleCredential;
            _projectId = configuration["VertexAI:ProjectId"] ?? configuration["GoogleCloud:ProjectId"];
            _location = configuration["VertexAI:Location"] ?? "us-central1";
            _apiKey = configuration["Gemini:ApiKey"] ?? string.Empty;
            
            if (_googleCredential != null && !string.IsNullOrEmpty(_projectId))
            {
                _logger.LogInformation("[GEMINI] Google Cloud Credentials ile Vertex AI üzerinden başlatıldı");
            }
            else if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogInformation("[GEMINI] API Key ile başlatıldı");
            }
            else
            {
                _logger.LogWarning("[GEMINI] Ne Google Cloud Credentials ne de API Key bulunamadı, Gemini servisi devre dışı");
            }
        }

        public async Task<GeminiAnalysisResult> AnalyzeProductAsync(byte[] imageBytes, string language = "en")
        {
            var result = new GeminiAnalysisResult();
            
            // ÖNCELİK 1: Google Cloud Credentials ile Vertex AI REST API
            if (_googleCredential != null && !string.IsNullOrEmpty(_projectId))
            {
                return await AnalyzeWithVertexAIAsync(imageBytes, language);
            }
            
            // ÖNCELİK 2: API Key ile Gemini REST API (fallback)
            if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                return await AnalyzeWithGeminiAPIAsync(imageBytes, language);
            }
            
            result.Error = "Gemini API not configured (no credentials or API key)";
            _logger.LogWarning("[GEMINI] Gemini API yapılandırılmamış, analiz yapılamıyor");
            return result;
        }

        private async Task<GeminiAnalysisResult> AnalyzeWithGeminiAPIAsync(byte[] imageBytes, string language = "en")
        {
            var result = new GeminiAnalysisResult();
            
            try
            {
                _logger.LogInformation("[GEMINI] Gemini REST API ile ürün analizi başlatılıyor...");
                
                // Prompt hazırla
                var prompt = GetPrompt(language);
                
                // Görüntüyü base64'e çevir
                var base64Image = Convert.ToBase64String(imageBytes);
                
                // Gemini REST API endpoint (API Key ile)
                var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";
                
                // Request body
                var requestBody = new
                {
                    contents = new object[]
                    {
                        new
                        {
                            parts = new object[]
                            {
                                new { text = prompt },
                                new
                                {
                                    inlineData = new
                                    {
                                        mimeType = "image/jpeg",
                                        data = base64Image
                                    }
                                }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.4,
                        topK = 32,
                        topP = 1,
                        maxOutputTokens = 8192
                    }
                };

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(60);
                httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                // API Key ile istek gönder
                var requestUrl = $"{url}?key={_apiKey}";
                _logger.LogInformation($"[GEMINI] Gemini REST API çağrısı yapılıyor...");

                var response = await httpClient.PostAsync(requestUrl, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"[GEMINI] Gemini API hatası: {response.StatusCode} - {errorBody}");
                    result.Error = $"Gemini API error: {response.StatusCode}";
                    return result;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                _logger.LogInformation($"[GEMINI] Gemini API yanıtı alındı: {responseJson.Substring(0, Math.Min(200, responseJson.Length))}...");

                // Gemini API response'u parse et
                var geminiResponse = JsonSerializer.Deserialize<GeminiAPIResponse>(responseJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                var responseText = geminiResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text ?? string.Empty;

                if (string.IsNullOrEmpty(responseText))
                {
                    _logger.LogWarning("[GEMINI] Gemini API yanıtı boş");
                    result.Error = "Empty response from Gemini API";
                    return result;
                }

                return ParseGeminiResponse(responseText, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GEMINI] Gemini API analiz hatası");
                result.Error = ex.Message;
                return result;
            }
        }

        private string GetPrompt(string language)
        {
            return language == "tr" 
                ? @"Bu fotoğraftaki ürünü analiz et ve şunları sağla:

1. Ürünü tanımlayan tek satırlık kısa açıklama (maksimum 100 karakter)
2. Bu ürünle ilgili tam olarak 5 hashtag (ne eksik ne fazla, tam 5 tane)

Lütfen yanıtını JSON formatında döndür:
{
  ""description"": ""ürün açıklaması"",
  ""hashtags"": [""hashtag1"", ""hashtag2"", ""hashtag3"", ""hashtag4"", ""hashtag5""]
}

ÖNEMLİ: hashtags dizisinde tam olarak 5 hashtag olmalı. Sadece JSON döndür, başka açıklama ekleme."
                : @"Analyze the product in this photo and provide:

1. A short one-line description of the product (maximum 100 characters)
2. Exactly 5 hashtags related to this product (not less, not more, exactly 5)

Please return your response in JSON format:
{
  ""description"": ""product description"",
  ""hashtags"": [""hashtag1"", ""hashtag2"", ""hashtag3"", ""hashtag4"", ""hashtag5""]
}

IMPORTANT: The hashtags array must contain exactly 5 hashtags. Return only JSON, no additional explanation.";
        }

        private async Task<GeminiAnalysisResult> AnalyzeWithVertexAIAsync(byte[] imageBytes, string language = "en")
        {
            var result = new GeminiAnalysisResult();
            
            try
            {
                _logger.LogInformation("[GEMINI] Vertex AI REST API ile ürün analizi başlatılıyor...");
                
                // Prompt hazırla
                var prompt = GetPrompt(language);

                // Görüntüyü base64'e çevir
                var base64Image = Convert.ToBase64String(imageBytes);
                
                // Vertex AI REST API endpoint
                var url = $"https://{_location}-aiplatform.googleapis.com/v1/projects/{_projectId}/locations/{_location}/publishers/google/models/gemini-2.0-flash-exp:generateContent";
                
                // Request body - Vertex AI API formatı (role alanı gerekli)
                var requestBody = new
                {
                    contents = new object[]
                    {
                        new
                        {
                            role = "user",
                            parts = new object[]
                            {
                                new { text = prompt },
                                new
                                {
                                    inlineData = new
                                    {
                                        mimeType = "image/jpeg",
                                        data = base64Image
                                    }
                                }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.4,
                        topK = 32,
                        topP = 1,
                        maxOutputTokens = 8192
                    }
                };

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(60);

                // Google Cloud credentials kullanarak Bearer token al
                var scopedCredential = _googleCredential!.CreateScoped(
                    "https://www.googleapis.com/auth/cloud-platform"
                );
                
                var tokenResponse = await ((Google.Apis.Auth.OAuth2.ITokenAccess)scopedCredential).GetAccessTokenForRequestAsync(url);
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResponse);
                httpClient.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                _logger.LogInformation($"[GEMINI] Vertex AI çağrısı yapılıyor: {url}");

                var response = await httpClient.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"[GEMINI] Vertex AI hatası: {response.StatusCode} - {errorBody}");
                    result.Error = $"Vertex AI error: {response.StatusCode}";
                    return result;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                _logger.LogInformation($"[GEMINI] Vertex AI yanıtı alındı: {responseJson.Substring(0, Math.Min(200, responseJson.Length))}...");

                // Vertex AI response'u parse et
                var vertexResponse = JsonSerializer.Deserialize<VertexAIResponse>(responseJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                var responseText = vertexResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text ?? string.Empty;

                if (string.IsNullOrEmpty(responseText))
                {
                    _logger.LogWarning("[GEMINI] Vertex AI yanıtı boş");
                    result.Error = "Empty response from Vertex AI";
                    return result;
                }

                return ParseGeminiResponse(responseText, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GEMINI] Vertex AI analiz hatası");
                result.Error = ex.Message;
                return result;
            }
        }

        private GeminiAnalysisResult ParseGeminiResponse(string responseText, GeminiAnalysisResult result)
        {
            try
            {
                // Eğer yanıt markdown code block içindeyse temizle
                if (responseText.StartsWith("```json"))
                {
                    responseText = responseText.Replace("```json", "").Replace("```", "").Trim();
                }
                else if (responseText.StartsWith("```"))
                {
                    responseText = responseText.Replace("```", "").Trim();
                }

                var jsonResult = JsonSerializer.Deserialize<GeminiJsonResponse>(responseText, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (jsonResult != null)
                {
                    result.Description = jsonResult.Description ?? string.Empty;
                    result.Hashtags = jsonResult.Hashtags ?? new List<string>();
                    
                    // Hashtag sayısını kontrol et ve düzelt
                    if (result.Hashtags.Count != 5)
                    {
                        _logger.LogWarning($"[GEMINI] Beklenen 5 hashtag yerine {result.Hashtags.Count} hashtag geldi. Düzeltiliyor...");
                        
                        // Eğer 5'ten fazlaysa ilk 5'ini al
                        if (result.Hashtags.Count > 5)
                        {
                            result.Hashtags = result.Hashtags.Take(5).ToList();
                        }
                        // Eğer 5'ten azsa, boş string ekle veya mevcut olanları tekrarla
                        else if (result.Hashtags.Count < 5 && result.Hashtags.Count > 0)
                        {
                            // Eksik olanları doldurmak için mevcut hashtag'leri tekrarla veya boş bırak
                            while (result.Hashtags.Count < 5)
                            {
                                result.Hashtags.Add(string.Empty);
                            }
                        }
                    }
                    
                    result.Confidence = 0.85; // Gemini API güvenilir bir kaynak
                    
                    _logger.LogInformation($"[GEMINI] Analiz tamamlandı: {result.Description}, Hashtag sayısı: {result.Hashtags.Count}");
                }
                else
                {
                    _logger.LogWarning("[GEMINI] JSON parse edilemedi");
                    result.Error = "Failed to parse JSON response";
                }
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "[GEMINI] JSON parse hatası");
                result.Error = $"JSON parse error: {ex.Message}";
                
                // Fallback: Eğer JSON parse edilemezse, yanıtı direkt kullan
                result.Description = responseText.Length > 100 ? responseText.Substring(0, 100) : responseText;
            }

            return result;
        }

        private class GeminiJsonResponse
        {
            public string? Description { get; set; }
            public List<string>? Hashtags { get; set; }
        }

        private class VertexAIResponse
        {
            public List<VertexAICandidate>? candidates { get; set; }
        }

        private class VertexAICandidate
        {
            public VertexAIContent? content { get; set; }
        }

        private class VertexAIContent
        {
            public List<VertexAIPart>? parts { get; set; }
        }

        private class VertexAIPart
        {
            public string? text { get; set; }
        }

        private class GeminiAPIResponse
        {
            public List<GeminiAPICandidate>? candidates { get; set; }
        }

        private class GeminiAPICandidate
        {
            public GeminiAPIContent? content { get; set; }
        }

        private class GeminiAPIContent
        {
            public List<GeminiAPIPart>? parts { get; set; }
        }

        public async Task<PriceEstimationResult> EstimatePriceAsync(string productDescription, string language = "en")
        {
            var result = new PriceEstimationResult();
            
            if (string.IsNullOrWhiteSpace(productDescription))
            {
                result.Error = language == "tr" ? "Ürün açıklaması bulunamadı" : "Product description not found";
                return result;
            }

            try
            {
                _logger.LogInformation("[GEMINI] Fiyat tahmini başlatılıyor...");
                
                var prompt = GetPriceEstimationPrompt(productDescription, language);
                
                // ÖNCELİK 1: Google Cloud Credentials ile Vertex AI REST API
                if (_googleCredential != null && !string.IsNullOrEmpty(_projectId))
                {
                    return await EstimatePriceWithVertexAIAsync(prompt, language);
                }
                
                // ÖNCELİK 2: API Key ile Gemini REST API (fallback)
                if (!string.IsNullOrWhiteSpace(_apiKey))
                {
                    return await EstimatePriceWithGeminiAPIAsync(prompt, language);
                }
                
                result.Error = language == "tr" ? "Gemini API yapılandırılmamış" : "Gemini API not configured";
                _logger.LogWarning("[GEMINI] Gemini API yapılandırılmamış, fiyat tahmini yapılamıyor");
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GEMINI] Fiyat tahmini hatası");
                result.Error = ex.Message;
                return result;
            }
        }

        public async Task<CategorySuggestionResult> SuggestCategoryAsync(
            string productText,
            IReadOnlyList<CategoryCandidate> candidates,
            string language = "en")
        {
            var result = new CategorySuggestionResult();

            if (string.IsNullOrWhiteSpace(productText))
            {
                result.Error = language == "tr" ? "Ürün bilgisi bulunamadı" : "Product info not found";
                return result;
            }

            if (candidates == null || candidates.Count == 0)
            {
                result.Error = language == "tr" ? "Kategori listesi boş" : "Category list is empty";
                return result;
            }

            try
            {
                var prompt = GetCategorySuggestionPrompt(productText, candidates, language);

                var responseText = await GenerateTextAsync(prompt, maxOutputTokens: 1024, temperature: 0.2);
                if (string.IsNullOrWhiteSpace(responseText))
                {
                    result.Error = language == "tr" ? "AI yanıtı boş" : "Empty AI response";
                    return result;
                }

                // Markdown code block'ları temizle
                var cleaned = responseText.Trim();
                if (cleaned.StartsWith("```"))
                {
                    var lines = cleaned.Split('\n');
                    cleaned = string.Join("\n", lines.Skip(1).TakeWhile(l => !l.Trim().StartsWith("```"))).Trim();
                }

                try
                {
                    var parsed = JsonSerializer.Deserialize<CategorySuggestionResponse>(cleaned, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                    if (parsed != null)
                    {
                        result.CategoryId = parsed.CategoryId;
                        result.Confidence = parsed.Confidence;
                        result.Reasoning = parsed.Reasoning;
                        result.Error = parsed.Error;
                        return result;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[GEMINI] Category suggestion JSON parse failed. Raw: {Raw}", responseText);
                }

                // Fallback: regex ile categoryId yakalamayı dene
                var match = System.Text.RegularExpressions.Regex.Match(cleaned, @"""categoryId""\s*:\s*""(?<id>[^""]+)""");
                if (match.Success)
                {
                    result.CategoryId = match.Groups["id"].Value;
                    result.Confidence = null;
                    result.Reasoning = "Parsed categoryId from response";
                    return result;
                }

                result.Error = language == "tr" ? "Kategori önerisi parse edilemedi" : "Could not parse category suggestion";
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GEMINI] Category suggestion failed");
                result.Error = ex.Message;
                return result;
            }
        }

        private string GetCategorySuggestionPrompt(string productText, IReadOnlyList<CategoryCandidate> candidates, string language)
        {
            var candidatesJson = JsonSerializer.Serialize(candidates);

            return language == "tr"
                ? $@"Aşağıdaki ürün bilgisine göre, verilen kategori listesinden EN UYGUN kategoriyi seç.

ÖNEMLİ KURALLAR:
- Mümkün olan en alt kırılımı (leaf) seç.
- SADECE verilen listeden seçim yap.
- categoryId alanı seçtiğin kategorinin Id değeri olmalı.

Ürün:
{productText}

Kategori adayları (JSON):
{candidatesJson}

Yanıtı SADECE JSON olarak ver:
{{
  ""categoryId"": ""<guid>"",
  ""confidence"": 0.0,
  ""reasoning"": ""kısa açıklama""
}}

Eğer emin olamazsan:
{{
  ""categoryId"": null,
  ""confidence"": 0.0,
  ""reasoning"": ""neden"",
  ""error"": ""yetersiz bilgi""
}}"
                : $@"Based on the product information below, choose the BEST category from the provided list.

IMPORTANT RULES:
- Choose the deepest (leaf) category when possible.
- Choose ONLY from the provided list.
- The categoryId must be the Id of the chosen category.

Product:
{productText}

Category candidates (JSON):
{candidatesJson}

Return ONLY JSON:
{{
  ""categoryId"": ""<guid>"",
  ""confidence"": 0.0,
  ""reasoning"": ""short explanation""
}}

If you are not confident:
{{
  ""categoryId"": null,
  ""confidence"": 0.0,
  ""reasoning"": ""why"",
  ""error"": ""insufficient info""
}}";
        }

        private async Task<string?> GenerateTextAsync(string prompt, int maxOutputTokens, double temperature)
        {
            // ÖNCELİK 1: Google Cloud Credentials ile Vertex AI
            if (_googleCredential != null && !string.IsNullOrEmpty(_projectId))
            {
                return await GenerateTextWithVertexAIAsync(prompt, maxOutputTokens, temperature);
            }

            // ÖNCELİK 2: API Key ile Gemini REST API
            if (!string.IsNullOrWhiteSpace(_apiKey))
            {
                return await GenerateTextWithGeminiAPIAsync(prompt, maxOutputTokens, temperature);
            }

            _logger.LogWarning("[GEMINI] No credentials or API key configured for text generation");
            return null;
        }

        private async Task<string?> GenerateTextWithGeminiAPIAsync(string prompt, int maxOutputTokens, double temperature)
        {
            var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

            var requestBody = new
            {
                contents = new object[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = temperature,
                    topK = 32,
                    topP = 1,
                    maxOutputTokens = maxOutputTokens
                }
            };

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(45);
            httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            var requestUrl = $"{url}?key={_apiKey}";

            var response = await httpClient.PostAsync(requestUrl, content);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[GEMINI] Text generation Gemini API error: {Status} - {Body}", response.StatusCode, errorBody);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var geminiResponse = JsonSerializer.Deserialize<GeminiAPIResponse>(responseJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return geminiResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text;
        }

        private async Task<string?> GenerateTextWithVertexAIAsync(string prompt, int maxOutputTokens, double temperature)
        {
            var url = $"https://{_location}-aiplatform.googleapis.com/v1/projects/{_projectId}/locations/{_location}/publishers/google/models/gemini-2.0-flash-exp:generateContent";

            var requestBody = new
            {
                contents = new object[]
                {
                    new
                    {
                        role = "user",
                        parts = new object[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = temperature,
                    topK = 32,
                    topP = 1,
                    maxOutputTokens = maxOutputTokens
                }
            };

            var scopedCredential = _googleCredential!.CreateScoped("https://www.googleapis.com/auth/cloud-platform");
            var tokenResponse = await ((Google.Apis.Auth.OAuth2.ITokenAccess)scopedCredential).GetAccessTokenForRequestAsync(url);

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(45);
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenResponse);
            httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync(url, content);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[GEMINI] Text generation Vertex AI error: {Status} - {Body}", response.StatusCode, errorBody);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            var vertexResponse = JsonSerializer.Deserialize<VertexAIResponse>(responseJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return vertexResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text;
        }

        private sealed class CategorySuggestionResponse
        {
            public string? CategoryId { get; set; }
            public double? Confidence { get; set; }
            public string? Reasoning { get; set; }
            public string? Error { get; set; }
        }

        private string GetPriceEstimationPrompt(string productDescription, string language)
        {
            // Her zaman USD olarak sor
            return language == "tr"
                ? $@"Aşağıdaki ürün açıklamasına göre bu ürünün ortalama piyasa fiyatını ABD DOLARI (USD) cinsinden tahmin et:

Ürün Açıklaması: {productDescription}

Lütfen yanıtını JSON formatında döndür:
{{
  ""estimatedPrice"": fiyat_sayısı (sadece sayı, nokta veya virgül ile ondalık kısım),
  ""currency"": ""USD"",
  ""reasoning"": ""kısa açıklama""
}}

ÖNEMLİ: Fiyatı MUTLAKA ABD DOLARI (USD) cinsinden ver. Başka para birimi kullanma.

Eğer fiyat tahmin edemiyorsan:
{{
  ""estimatedPrice"": null,
  ""currency"": null,
  ""reasoning"": ""neden tahmin edilemediği""
}}

ÖNEMLİ: Sadece JSON döndür, başka açıklama ekleme. estimatedPrice bir sayı olmalı veya null."
                : $@"Based on the following product description, estimate the average market price for this product in US DOLLARS (USD):

Product Description: {productDescription}

Please return your response in JSON format:
{{
  ""estimatedPrice"": price_number (only number, decimal with dot or comma),
  ""currency"": ""USD"",
  ""reasoning"": ""brief explanation""
}}

IMPORTANT: Always provide the price in US DOLLARS (USD). Do not use any other currency.

If you cannot estimate the price:
{{
  ""estimatedPrice"": null,
  ""currency"": null,
  ""reasoning"": ""why it cannot be estimated""
}}

IMPORTANT: Return only JSON, no additional explanation. estimatedPrice must be a number or null.";
        }

        private async Task<PriceEstimationResult> EstimatePriceWithGeminiAPIAsync(string prompt, string language)
        {
            var result = new PriceEstimationResult();
            
            try
            {
                var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";
                
                var requestBody = new
                {
                    contents = new object[]
                    {
                        new
                        {
                            parts = new object[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.3,
                        topK = 32,
                        topP = 1,
                        maxOutputTokens = 1024
                    }
                };

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var requestUrl = $"{url}?key={_apiKey}";
                var response = await httpClient.PostAsync(requestUrl, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"[GEMINI] Fiyat tahmini API hatası: {response.StatusCode} - {errorBody}");
                    result.Error = language == "tr" ? "Fiyat tahmini yapılamadı" : "Price estimation failed";
                    return result;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var geminiResponse = JsonSerializer.Deserialize<GeminiAPIResponse>(responseJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                var responseText = geminiResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text ?? string.Empty;

                if (string.IsNullOrEmpty(responseText))
                {
                    result.Error = language == "tr" ? "Fiyat tahmin edilemedi" : "Could not estimate price";
                    return result;
                }

                // Markdown code block'ları temizle (```json ... ``` veya ``` ... ```)
                var cleanedText = responseText.Trim();
                if (cleanedText.StartsWith("```"))
                {
                    var lines = cleanedText.Split('\n');
                    cleanedText = string.Join("\n", lines.Skip(1).TakeWhile(l => !l.Trim().StartsWith("```")));
                }

                // JSON parse et
                PriceEstimationResponse? priceResult = null;
                try
                {
                    priceResult = JsonSerializer.Deserialize<PriceEstimationResponse>(cleanedText, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[GEMINI] Fiyat tahmini JSON parse hatası: {ResponseText}", responseText);
                    // Fallback: Manuel parse dene
                    try
                    {
                        // JSON içinde estimatedPrice'ı bul
                        if (cleanedText.Contains("estimatedPrice"))
                        {
                            var priceMatch = System.Text.RegularExpressions.Regex.Match(cleanedText, @"""estimatedPrice""\s*:\s*([0-9.]+)");
                            if (priceMatch.Success && decimal.TryParse(priceMatch.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedPrice))
                            {
                                priceResult = new PriceEstimationResponse
                                {
                                    EstimatedPrice = parsedPrice,
                                    Currency = "USD", // Her zaman USD olarak döndür
                                    Reasoning = "AI estimated price"
                                };
                            }
                        }
                    }
                    catch { }
                }

                if (priceResult != null && priceResult.EstimatedPrice.HasValue)
                {
                    result.EstimatedPrice = priceResult.EstimatedPrice.Value;
                    result.Currency = priceResult.Currency ?? "USD"; // Her zaman USD olarak döndür
                    result.Reasoning = priceResult.Reasoning;
                }
                else
                {
                    result.Error = priceResult?.Reasoning ?? (language == "tr" ? "Fiyat tahmin edilemedi" : "Could not estimate price");
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GEMINI] Fiyat tahmini API hatası");
                result.Error = ex.Message;
                return result;
            }
        }

        private async Task<PriceEstimationResult> EstimatePriceWithVertexAIAsync(string prompt, string language)
        {
            var result = new PriceEstimationResult();
            
            try
            {
                var url = $"https://{_location}-aiplatform.googleapis.com/v1/projects/{_projectId}/locations/{_location}/publishers/google/models/gemini-2.0-flash-exp:generateContent";
                
                var requestBody = new
                {
                    contents = new object[]
                    {
                        new
                        {
                            role = "user",
                            parts = new object[]
                            {
                                new { text = prompt }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        temperature = 0.3,
                        topK = 32,
                        topP = 1,
                        maxOutputTokens = 1024
                    }
                };

                var authUri = $"https://{_location}-aiplatform.googleapis.com";
                // CreateScoped ile doğru scope'ları ekle
                var scopedCredential = _googleCredential!.CreateScoped(
                    "https://www.googleapis.com/auth/cloud-platform"
                );
                var tokenResponse = await ((Google.Apis.Auth.OAuth2.ITokenAccess)scopedCredential).GetAccessTokenForRequestAsync(url);
                
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResponse);
                httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var jsonContent = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var response = await httpClient.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"[GEMINI] Vertex AI fiyat tahmini hatası: {response.StatusCode} - {errorBody}");
                    result.Error = language == "tr" ? "Fiyat tahmini yapılamadı" : "Price estimation failed";
                    return result;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var geminiResponse = JsonSerializer.Deserialize<GeminiAPIResponse>(responseJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                var responseText = geminiResponse?.candidates?.FirstOrDefault()?.content?.parts?.FirstOrDefault()?.text ?? string.Empty;

                if (string.IsNullOrEmpty(responseText))
                {
                    result.Error = language == "tr" ? "Fiyat tahmin edilemedi" : "Could not estimate price";
                    return result;
                }

                // Markdown code block'ları temizle (```json ... ``` veya ``` ... ```)
                var cleanedText = responseText.Trim();
                if (cleanedText.StartsWith("```"))
                {
                    var lines = cleanedText.Split('\n');
                    cleanedText = string.Join("\n", lines.Skip(1).TakeWhile(l => !l.Trim().StartsWith("```")));
                }

                // JSON parse et
                PriceEstimationResponse? priceResult = null;
                try
                {
                    priceResult = JsonSerializer.Deserialize<PriceEstimationResponse>(cleanedText, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[GEMINI] Vertex AI fiyat tahmini JSON parse hatası: {ResponseText}", responseText);
                    // Fallback: Manuel parse dene
                    try
                    {
                        // JSON içinde estimatedPrice'ı bul
                        if (cleanedText.Contains("estimatedPrice"))
                        {
                            var priceMatch = System.Text.RegularExpressions.Regex.Match(cleanedText, @"""estimatedPrice""\s*:\s*([0-9.]+)");
                            if (priceMatch.Success && decimal.TryParse(priceMatch.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedPrice))
                            {
                                priceResult = new PriceEstimationResponse
                                {
                                    EstimatedPrice = parsedPrice,
                                    Currency = "USD", // Her zaman USD olarak döndür
                                    Reasoning = "AI estimated price"
                                };
                            }
                        }
                    }
                    catch { }
                }

                if (priceResult != null && priceResult.EstimatedPrice.HasValue)
                {
                    result.EstimatedPrice = priceResult.EstimatedPrice.Value;
                    result.Currency = priceResult.Currency ?? "USD"; // Her zaman USD olarak döndür
                    result.Reasoning = priceResult.Reasoning;
                }
                else
                {
                    result.Error = priceResult?.Reasoning ?? (language == "tr" ? "Fiyat tahmin edilemedi" : "Could not estimate price");
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GEMINI] Vertex AI fiyat tahmini hatası");
                result.Error = ex.Message;
                return result;
            }
        }

        private class PriceEstimationResponse
        {
            [System.Text.Json.Serialization.JsonConverter(typeof(DecimalOrStringConverter))]
            public decimal? EstimatedPrice { get; set; }
            public string? Currency { get; set; }
            public string? Reasoning { get; set; }
        }

        // JSON'dan gelen fiyat string veya number olabilir, her ikisini de handle et
        private class DecimalOrStringConverter : System.Text.Json.Serialization.JsonConverter<decimal?>
        {
            public override decimal? Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
            {
                if (reader.TokenType == System.Text.Json.JsonTokenType.Number)
                {
                    return reader.GetDecimal();
                }
                if (reader.TokenType == System.Text.Json.JsonTokenType.String)
                {
                    var str = reader.GetString();
                    if (decimal.TryParse(str, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed))
                    {
                        return parsed;
                    }
                }
                return null;
            }

            public override void Write(System.Text.Json.Utf8JsonWriter writer, decimal? value, System.Text.Json.JsonSerializerOptions options)
            {
                if (value.HasValue)
                {
                    writer.WriteNumberValue(value.Value);
                }
                else
                {
                    writer.WriteNullValue();
                }
            }
        }

        private class GeminiAPIPart
        {
            public string? text { get; set; }
        }
    }
}

