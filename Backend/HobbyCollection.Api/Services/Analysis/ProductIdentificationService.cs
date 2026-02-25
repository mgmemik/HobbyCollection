using System.Text.RegularExpressions;
using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;
using HobbyCollection.Domain.Services;
using HobbyCollection.Api.Services.Analysis.Strategies;
using Strategies = HobbyCollection.Api.Services.Analysis.Strategies;

namespace HobbyCollection.Api.Services.Analysis
{
    public class ProductIdentificationService : IProductIdentificationService
    {
        private readonly ILogger<ProductIdentificationService> _logger;
        private readonly IOcrExtractionService _ocrExtraction;
        private readonly IUrlParserService _urlParser;
        private readonly IBrandService _brandService;
        private readonly IEnumerable<Strategies.IIdentificationStrategy> _strategies;

        public ProductIdentificationService(
            ILogger<ProductIdentificationService> logger,
            IOcrExtractionService ocrExtraction,
            IUrlParserService urlParser,
            IBrandService brandService,
            IEnumerable<Strategies.IIdentificationStrategy> strategies)
        {
            _logger = logger;
            _ocrExtraction = ocrExtraction;
            _urlParser = urlParser;
            _brandService = brandService;
            _strategies = strategies.OrderBy(s => s.Priority); // Önceliğe göre sırala
        }

        public async Task<ProductIdentificationResult> IdentifyProductAdvancedAsync(AnalysisDataCollection data, string language = "en")
        {
            try
            {
                // UNIVERSAL MULTI-SOURCE STRATEGY
                
                // ÖNCELİK 0: LOGO DETECTION - En güvenilir marka kaynağı!
                ProductIdentificationResult? logoResult = null;
                try
                {
                    logoResult = ExtractFromLogoDetection(data);
                    if (logoResult.Confidence > 0.0)
                    {
                        _logger.LogInformation($"[ADVANCED] 🏷️ LOGO TESPİTİ: {logoResult.ProductName} (Confidence: {logoResult.Confidence:F3})");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ADVANCED] Logo detection hatası");
                }
                
                // 1. OCR'dan potansiyel brand/model çıkar
                ProductIdentificationResult ocrResult;
                try
                {
                    ocrResult = _ocrExtraction.ExtractProductFromOCR(data);
                    
                    // Logo detection'dan brand bulunduysa, OCR'ı güncelle
                    if (logoResult != null && !string.IsNullOrEmpty(logoResult.Brand) && string.IsNullOrEmpty(ocrResult.Brand))
                    {
                        ocrResult.Brand = logoResult.Brand;
                        ocrResult.Confidence = Math.Max(ocrResult.Confidence, 0.85); // Logo ile confidence artır
                        _logger.LogInformation($"[ADVANCED] OCR'a logo detection'dan brand eklendi: {logoResult.Brand}");
                    }
                    
                    _logger.LogInformation($"[ADVANCED] OCR sonucu: {ocrResult.ProductName} (Confidence: {ocrResult.Confidence:F3})");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ADVANCED] OCR extraction hatası, fallback kullanılıyor");
                    ocrResult = new ProductIdentificationResult { Confidence = 0.0 };
                }

                // 2. Vision Labels'dan kategori/ürün tipi al
                ProductIdentificationResult labelsResult;
                try
                {
                    labelsResult = IdentifyFromVisionLabels(data);
                    _logger.LogInformation($"[ADVANCED] Labels sonucu: {labelsResult.ProductName} (Confidence: {labelsResult.Confidence:F3})");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ADVANCED] Labels extraction hatası, fallback kullanılıyor");
                    labelsResult = new ProductIdentificationResult { Confidence = 0.0 };
                }

                // 3. Web Detection'dan doğrulama
                ProductIdentificationResult webResult;
                try
                {
                    webResult = IdentifyFromWebDetection(data);
                    _logger.LogInformation($"[ADVANCED] Web Detection sonucu: {webResult.ProductName} (Confidence: {webResult.Confidence:F3})");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ADVANCED] Web Detection hatası, fallback kullanılıyor");
                    webResult = new ProductIdentificationResult { Confidence = 0.0 };
                }

                // 4. Google Custom Search sonuçlarını analiz et (EN ÖNEMLİ!)
                ProductIdentificationResult webSearchResult;
                try
                {
                    webSearchResult = await IdentifyFromWebSearchResultsAsync(data);
                    _logger.LogInformation($"[ADVANCED] Web Search sonucu: {webSearchResult.ProductName} (Confidence: {webSearchResult.Confidence:F3})");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ADVANCED] Web Search hatası, fallback kullanılıyor");
                    webSearchResult = new ProductIdentificationResult { Confidence = 0.0 };
                }

            // STRATEGY PATTERN: Stratejileri öncelik sırasına göre dene
            ProductIdentificationResult? bestResult = null;
            
            // EARLY EXIT: Yüksek confidence bulunursa diğer analizleri atla
            // ANCAK: Logo ve Web Detection sonuçlarını da kontrol et
            if (webSearchResult.Confidence > 0.85 && !string.IsNullOrEmpty(webSearchResult.Brand) && !string.IsNullOrEmpty(webSearchResult.Model))
            {
                // ÖNCELİK 1: Logo tespit edildiyse ve Web Search sonucu logo ile uyumsuzsa, logo'yu öncelikli kullan
                if (logoResult != null && logoResult.Confidence > 0.5 && !string.IsNullOrEmpty(logoResult.Brand))
                {
                    var logoBrandUpper = logoResult.Brand.ToUpper();
                    var webSearchBrandUpper = webSearchResult.Brand.ToUpper();
                    
                    // Logo markası ile Web Search markası uyumsuzsa, logo'yu öncelikli kullan
                    if (!logoBrandUpper.Contains(webSearchBrandUpper) && !webSearchBrandUpper.Contains(logoBrandUpper))
                    {
                        // Logo markası ile OCR model kombinasyonu oluştur
                        var ocrModels = _ocrExtraction.ExtractPotentialModels(data.OcrText.ToUpper());
                        if (ocrModels.Any())
                        {
                            var bestModel = ocrModels.First();
                            var logoWithModel = $"{logoResult.Brand} {bestModel}";
                            
                            bestResult = new ProductIdentificationResult
                            {
                                Brand = logoResult.Brand,
                                Model = bestModel,
                                ProductName = logoWithModel,
                                Confidence = Math.Max(logoResult.Confidence, 0.85),
                                Reasoning = $"Logo tespit edildi ({logoResult.Brand}) ve Web Search sonucu ({webSearchResult.Brand}) ile uyumsuz, logo öncelikli kullanıldı",
                                Evidence = logoResult.Evidence
                            };
                            _logger.LogInformation($"[ADVANCED] Logo öncelikli seçildi (EARLY EXIT override): {bestResult.ProductName} (Logo: {logoResult.Brand} vs Web Search: {webSearchResult.Brand})");
                            return bestResult;
                        }
                        else
                        {
                            // Model yoksa sadece logo'yu kullan
                            bestResult = logoResult;
                            bestResult.Confidence = Math.Max(logoResult.Confidence, 0.85);
                            _logger.LogInformation($"[ADVANCED] Logo öncelikli seçildi (EARLY EXIT override): {bestResult.ProductName} (Logo: {logoResult.Brand} vs Web Search: {webSearchResult.Brand})");
                            return bestResult;
                        }
                    }
                }
                
                // ÖNCELİK 2: Web Detection sonucunu kontrol et - eğer daha spesifik ve yüksek confidence ise öncelik ver
                if (webResult.Confidence > 0.75 && !string.IsNullOrEmpty(webResult.ProductName))
                {
                    // Web Detection sonucu daha spesifik görünüyorsa (örn: "BMW 2002tii" vs "TONKA STEEL")
                    // Web Detection'ın confidence'ı Web Search'ten çok düşük değilse öncelik ver
                    if (webResult.Confidence >= webSearchResult.Confidence - 0.15)
                    {
                        // Web Detection sonucu daha spesifik mi kontrol et
                        var webDetectionIsMoreSpecific = IsMoreSpecificProduct(webResult.ProductName, webSearchResult.ProductName);
                        
                        if (webDetectionIsMoreSpecific)
                        {
                            bestResult = webResult;
                            _logger.LogInformation($"[ADVANCED] Web Detection öncelikli seçildi (EARLY EXIT override): {bestResult.ProductName} (Confidence: {bestResult.Confidence:F3} vs Web Search: {webSearchResult.Confidence:F3})");
                            return bestResult;
                        }
                    }
                }
                
                bestResult = webSearchResult;
                _logger.LogInformation($"[ADVANCED] Web Search yüksek güvenle seçildi (EARLY EXIT): {bestResult.ProductName}");
                return bestResult; // Early exit - diğer analizleri atla
            }
            
            // Stratejileri öncelik sırasına göre dene
            foreach (var strategy in _strategies)
            {
                if (strategy.CanHandle(data, ocrResult, labelsResult, webResult, webSearchResult))
                {
                    bestResult = strategy.Identify(data, ocrResult, labelsResult, webResult, webSearchResult);
                    _logger.LogInformation($"[ADVANCED] Strateji seçildi: {strategy.StrategyName} - {bestResult.ProductName}");
                    break; // İlk uygun stratejiyi kullan
                }
            }
            
            // Fallback: Eğer hiçbir strateji uygun değilse, OCR kullan
            if (bestResult == null)
            {
                bestResult = ocrResult;
                _logger.LogInformation($"[ADVANCED] Fallback: OCR kullanıldı - {bestResult.ProductName}");
            }

            // Eğer confidence çok düşükse (0.3'ten az), fallback mekanizması kullan
            if (bestResult.Confidence < 0.3)
            {
                _logger.LogWarning($"[ADVANCED] Confidence çok düşük ({bestResult.Confidence:F3}), fallback mekanizması devreye giriyor");
                bestResult = FallbackToLabels(data, labelsResult);
            }

            return bestResult;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ADVANCED] Product identification genel hatası, fallback kullanılıyor");
                return FallbackToLabels(data, new ProductIdentificationResult());
            }
        }

        /// <summary>
        /// Fallback mekanizması: En basit label'ları kullan
        /// </summary>
        private ProductIdentificationResult FallbackToLabels(AnalysisDataCollection data, ProductIdentificationResult labelsResult)
        {
            var result = new ProductIdentificationResult
            {
                ProductName = "",
                Brand = "",
                Model = "",
                Confidence = ConfidenceCalculator.CalculateFallbackConfidence(0.3),
                Reasoning = "Fallback: Labels kullanıldı",
                Evidence = new List<string> { "Fallback mechanism" }
            };

            // Labels'dan en iyi sonucu al
            if (labelsResult.Confidence > 0.0 && !string.IsNullOrEmpty(labelsResult.ProductName))
            {
                result.ProductName = labelsResult.ProductName;
                result.Confidence = labelsResult.Confidence;
                result.Reasoning = $"Fallback: {labelsResult.Reasoning}";
                _logger.LogInformation($"[FALLBACK] Labels'dan sonuç: {result.ProductName}");
                return result;
            }

            // Vision Labels'dan en iyi label'ı al
            var bestLabel = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .OrderByDescending(l => l.Score)
                .FirstOrDefault();

            if (bestLabel != null)
            {
                result.ProductName = bestLabel.Description;
                result.Confidence = ConfidenceCalculator.CalculateFallbackConfidence(bestLabel.Score * 0.5);
                result.Reasoning = $"Fallback: Vision Label '{bestLabel.Description}'";
                _logger.LogInformation($"[FALLBACK] Vision Label'dan sonuç: {result.ProductName}");
                return result;
            }

            // Son çare: Bilinmeyen ürün
            result.ProductName = "Bilinmeyen Ürün";
            result.Confidence = 0.0;
            result.Reasoning = "Fallback: Hiçbir bilgi bulunamadı";
            _logger.LogWarning("[FALLBACK] Hiçbir bilgi bulunamadı, 'Bilinmeyen Ürün' döndürülüyor");
            return result;
        }

        public async Task<ProductIdentificationResult> IdentifyFromWebSearchResultsAsync(AnalysisDataCollection data)
        {
            var result = new ProductIdentificationResult();
            
            if (data.WebSearchResults == null || !data.WebSearchResults.Any())
            {
                return result;
            }

            // Web search sonuçlarında en çok geçen brand+model kombinasyonunu bul
            var ocrText = data.OcrText.ToUpper();
            var potentialBrands = _ocrExtraction.ExtractPotentialBrands(ocrText);
            var potentialModels = _ocrExtraction.ExtractPotentialModels(ocrText);
            
            // ÖNCELİK -2: LOGO DETECTION - En güvenilir marka kaynağı!
            var logoDetectedBrands = data.VisionResults
                .SelectMany(v => v.Logos ?? new List<LogoInfo>())
                .OrderByDescending(l => l.Score)
                .Select(l => l.Description.ToUpper())
                .ToList();
            
            if (logoDetectedBrands.Any())
            {
                // Logo'dan gelen markaları en başa ekle (EN YÜKSEK ÖNCELİK!)
                foreach (var logoBrand in logoDetectedBrands)
                {
                    if (!potentialBrands.Contains(logoBrand))
                    {
                        potentialBrands.Insert(0, logoBrand); // Başa ekle
                    }
                }
                _logger.LogInformation($"[WEB SEARCH] 🏷️ Logo'dan {logoDetectedBrands.Count} marka tespit edildi: {string.Join(", ", logoDetectedBrands)}");
            }
            
            // ÖNCELİK -1: Database'deki bilinen markaları kontrol et
            var allSearchTextForBrandCheck = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}"));
            var databaseBrands = await _brandService.FindBrandsInTextAsync(allSearchTextForBrandCheck);
            
            if (databaseBrands.Any())
            {
                _logger.LogInformation($"[WEB SEARCH] Database'de {databaseBrands.Count} bilinen marka bulundu: {string.Join(", ", databaseBrands)}");
                
                // Database markalarını potentialBrands'e ekle (logo'dan sonra)
                foreach (var dbBrand in databaseBrands)
                {
                    if (!potentialBrands.Contains(dbBrand.ToUpper()))
                    {
                        potentialBrands.Insert(logoDetectedBrands.Count, dbBrand.ToUpper()); // Logo'dan sonra, diğer kaynaklardan önce
                    }
                }
            }
            
            // ÖNCELİK 0: Web Entities'den brand ve model çıkar (EN GÜVENİLİR! - "Wowwee - Robot Robosapien" → "Wowwee")
            // NOT: Database'den marka bulunsa bile Web Entity'den model bilgisi çıkarılabilir
            if (data.VisionResults.Any())
            {
                var webEntities = data.VisionResults
                    .SelectMany(v => v.WebEntities ?? new List<WebEntity>())
                    .OrderByDescending(e => e.Score)
                    .ToList();
                
                foreach (var entity in webEntities.Take(5))
                {
                    var entityText = entity.Description.ToUpper();
                    var entityDescription = entity.Description;
                    
                    // Bilinen markaları Web Entity'de ara
                    var knownBrands = new[] { "NINTENDO", "SONY", "MICROSOFT", "SEGA", "ATARI", "COMMODORE", 
                        "OLYMPUS", "CANON", "NIKON", "PANASONIC", "KODAK", "POLAROID",
                        "LOGITECH", "RAZER", "CORSAIR", "STEELSERIES", "APPLE", "SAMSUNG",
                        "WOWWEE", "HASBRO", "MATTEL", "LEGO", "BANDAI", "TAKARA", "TOMY", "SATURN" };
                    
                    foreach (var brand in knownBrands)
                    {
                        if (entityText.Contains(brand))
                        {
                            potentialBrands.Add(brand);
                            _logger.LogInformation($"[WEB SEARCH] Brand Web Entity'den çıkarıldı: {brand} (entity: {entity.Description}, score: {entity.Score:F2})");
                            
                            // Web Entity'den model de çıkar (örn: "Wowwee - Robot Robosapien" → "Robosapien")
                            var parts = entity.Description.Split(new[] { " - ", "-", " – ", "–" }, StringSplitOptions.RemoveEmptyEntries);
                            if (parts.Length > 1)
                            {
                                var modelPart = parts[1].Trim();
                                var modelUpper = modelPart.ToUpper();
                                
                                // Genel kelimeleri filtrele (örn: "Deals", "Toy", "Robot")
                                if (modelPart.Length > 2 && 
                                    !IsInvalidModelWord(modelUpper) && 
                                    !potentialModels.Contains(modelUpper))
                                {
                                    potentialModels.Add(modelUpper);
                                    _logger.LogInformation($"[WEB SEARCH] Model Web Entity'den çıkarıldı: {modelPart} (entity: {entity.Description})");
                                }
                                else if (IsInvalidModelWord(modelUpper))
                                {
                                    _logger.LogInformation($"[WEB SEARCH] Model filtrelendi (genel kelime): {modelPart} (entity: {entity.Description})");
                                }
                            }
                        }
                    }
                    
                    // DİNAMİK MARKA ÇIKARMA: Web Entity'de "Brand Product" formatı varsa (örn: "Saturn Robot")
                    // İlk kelimeyi marka olarak çıkar (eğer bilinen markalar listesinde yoksa)
                    // ANCAK: Logo tespit edildiyse ve logo markası ile uyumsuzsa, dinamik marka çıkarmayı atla
                    if (!potentialBrands.Any(b => entityText.Contains(b)))
                    {
                        var entityWords = entityDescription.Split(new[] { ' ', '-', '–', '—' }, StringSplitOptions.RemoveEmptyEntries);
                        if (entityWords.Length >= 2)
                        {
                            var firstWord = entityWords[0].Trim().ToUpper();
                            
                            // Logo tespit edildiyse ve logo markası ile uyumsuzsa, dinamik marka çıkarmayı atla
                            if (logoDetectedBrands.Any())
                            {
                                var logoBrandMatches = logoDetectedBrands.Any(logoBrand => 
                                    logoBrand.Contains(firstWord) || firstWord.Contains(logoBrand));
                                
                                if (!logoBrandMatches)
                                {
                                    _logger.LogInformation($"[WEB SEARCH] Logo tespit edildi ({string.Join(", ", logoDetectedBrands)}) ve Web Entity markası ({firstWord}) ile uyumsuz, dinamik marka çıkarma atlandı");
                                    continue; // Bu entity'yi atla, bir sonrakine geç
                                }
                            }
                            
                            // İlk kelime genel bir kelime değilse ve uzunluğu uygunsa marka olarak kabul et
                            var genericWords = new[] { "BABY", "TOY", "TOYS", "ROBOT", "ROBOTS", "GAME", "GAMES", 
                                "MODEL", "MODELS", "VINTAGE", "CLASSIC", "NEW", "OLD", "USED", "JEAN", "SPORT", "AVIATION", "CENTER", "FLOOR" };
                            
                            if (firstWord.Length >= 3 && firstWord.Length <= 15 && 
                                !genericWords.Contains(firstWord) &&
                                !IsInvalidModelWord(firstWord) &&
                                !potentialBrands.Contains(firstWord))
                            {
                                potentialBrands.Add(firstWord);
                                _logger.LogInformation($"[WEB SEARCH] Brand Web Entity'den dinamik olarak çıkarıldı: {firstWord} (entity: {entity.Description}, score: {entity.Score:F2})");
                                
                                // İkinci kelimeyi model olarak çıkar (eğer genel bir kelime değilse)
                                if (entityWords.Length >= 2)
                                {
                                    var secondWord = entityWords[1].Trim().ToUpper();
                                    if (secondWord.Length >= 2 && 
                                        !IsInvalidModelWord(secondWord) && 
                                        !potentialModels.Contains(secondWord))
                                    {
                                        potentialModels.Add(secondWord);
                                        _logger.LogInformation($"[WEB SEARCH] Model Web Entity'den dinamik olarak çıkarıldı: {secondWord} (entity: {entity.Description})");
                                    }
                                }
                            }
                        }
                    }
                    
                    // Eğer Web Entity'de "Brand - Product" formatı varsa parse et
                    if (entityText.Contains(" - ") || entityText.Contains("-"))
                    {
                        var parts = entity.Description.Split(new[] { " - ", "-", " – ", "–" }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length >= 2)
                        {
                            var possibleBrand = parts[0].Trim().ToUpper();
                            var possibleModel = parts[1].Trim().ToUpper();
                            
                            // Brand uzunluğu kontrolü (2-20 karakter arası)
                            if (possibleBrand.Length >= 2 && possibleBrand.Length <= 20 && !potentialBrands.Contains(possibleBrand))
                            {
                                potentialBrands.Add(possibleBrand);
                                _logger.LogInformation($"[WEB SEARCH] Brand Web Entity formatından çıkarıldı: {possibleBrand} (entity: {entity.Description})");
                            }
                            
                            // Model uzunluğu kontrolü ve genel kelime filtresi
                            if (possibleModel.Length >= 2 && 
                                possibleModel.Length <= 30 && 
                                !IsInvalidModelWord(possibleModel) &&
                                !potentialModels.Contains(possibleModel))
                            {
                                potentialModels.Add(possibleModel);
                                _logger.LogInformation($"[WEB SEARCH] Model Web Entity formatından çıkarıldı: {possibleModel} (entity: {entity.Description})");
                            }
                            else if (IsInvalidModelWord(possibleModel))
                            {
                                _logger.LogInformation($"[WEB SEARCH] Model filtrelendi (genel kelime): {possibleModel} (entity: {entity.Description})");
                            }
                        }
                    }
                }
            }
            
            // ÖNCELİK 1: Google Custom Search sonuçlarından dinamik olarak marka çıkar (Database ve Web Entity'de yoksa)
            if (!potentialBrands.Any())
            {
                _logger.LogInformation("[WEB SEARCH] Database ve Web Entity'de marka bulunamadı, dinamik marka çıkarma başlatılıyor...");
                
                // Title'larda ve snippet'lerde en çok geçen, marka pattern'ine uyan kelimeleri bul
                var searchTitles = data.WebSearchResults
                    .Where(r => !string.IsNullOrEmpty(r.Title))
                    .Select(r => r.Title)
                    .ToList();
                
                var searchSnippets = data.WebSearchResults
                    .Where(r => !string.IsNullOrEmpty(r.Snippet))
                    .Select(r => r.Snippet)
                    .ToList();
                
                // Marka pattern'leri: Büyük harfle başlayan, 2-20 karakter, tekrarlanan kelimeler
                var brandCandidates = new Dictionary<string, int>();
                
                // Title'lardan marka adaylarını çıkar (daha güvenilir!)
                foreach (var title in searchTitles)
                {
                    // Title'daki kelimeleri al
                    var words = title.Split(new[] { ' ', '-', '_', '|', ':', '–', '—' }, StringSplitOptions.RemoveEmptyEntries)
                        .Where(w => w.Length >= 2 && w.Length <= 20)
                        .Where(w => char.IsUpper(w[0]) || w.All(char.IsUpper)) // Büyük harfle başlamalı veya tamamı büyük harf
                        .Where(w => w.Any(char.IsLetter)) // En az bir harf içermeli
                        .Where(w => !Regex.IsMatch(w, @"^\d+$")) // Sadece sayı değil
                        .Where(w => !Regex.IsMatch(w, @"^[A-Z]{1,2}\d+$")) // "F1O", "TK4E" gibi kodlar değil
                        .Select(w => w.Trim('(', ')', '[', ']', '.', ',', ';', ':', '!', '?'))
                        .Where(w => w.Length >= 2)
                        .ToList();
                    
                    foreach (var word in words)
                    {
                        var normalized = word.ToUpper();
                        if (!brandCandidates.ContainsKey(normalized))
                        {
                            brandCandidates[normalized] = 0;
                        }
                        brandCandidates[normalized]++;
                    }
                }
                
                // Snippet'lerden de marka adaylarını çıkar (daha az güvenilir ama ek bilgi)
                foreach (var snippet in searchSnippets.Take(20)) // İlk 20 snippet yeterli
                {
                    var words = snippet.Split(new[] { ' ', '-', '_', '|', ':', '–', '—' }, StringSplitOptions.RemoveEmptyEntries)
                        .Where(w => w.Length >= 2 && w.Length <= 20)
                        .Where(w => char.IsUpper(w[0]) || w.All(char.IsUpper))
                        .Where(w => w.Any(char.IsLetter))
                        .Where(w => !Regex.IsMatch(w, @"^\d+$"))
                        .Select(w => w.Trim('(', ')', '[', ']', '.', ',', ';', ':', '!', '?'))
                        .Where(w => w.Length >= 2)
                        .ToList();
                    
                    foreach (var word in words)
                    {
                        var normalized = word.ToUpper();
                        if (!brandCandidates.ContainsKey(normalized))
                        {
                            brandCandidates[normalized] = 0;
                        }
                        brandCandidates[normalized] += 1; // Snippet'lerden gelenler daha az ağırlıklı
                    }
                }
                
                // Genel kelimeleri filtrele (marka olamaz)
                // NOT: Bu liste marka olarak algılanmaması gereken yaygın kelimeleri içerir
                var commonWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    // Temel bağlaçlar ve edatlar
                    "THE", "AND", "OR", "FOR", "WITH", "FROM", "THIS", "THAT", "THESE", "THOSE",
                    
                    // E-ticaret ve platform terimleri
                    "BUY", "SELL", "SHOP", "STORE", "ONLINE", "SHOPPING", "MARKET", "MARKETPLACE",
                    "AMAZON", "EBAY", "WIKIPEDIA", "YOUTUBE", "FACEBOOK", "INSTAGRAM", "TWITTER",
                    "SHIPPING", "DELIVERY", "RETURN", "REFUND", "WARRANTY", "GUARANTEE",
                    "CART", "CHECKOUT", "PAYMENT", "ORDER", "ORDERS", "CUSTOMER", "CUSTOMERS",
                    "REVIEW", "REVIEWS", "RATING", "RATINGS", "FEEDBACK", "COMMENT", "COMMENTS",
                    "PRICE", "PRICES", "COST", "COSTS", "DISCOUNT", "DISCOUNTS", "SALE", "SALES",
                    "DEAL", "DEALS", "OFFER", "OFFERS", "PROMO", "PROMOTION", "PROMOTIONS",
                    "FREE", "SHIPPING", "DELIVERY", "PICKUP", "AVAILABLE", "AVAILABILITY",
                    "STOCK", "INVENTORY", "QUANTITY", "QUANTITIES", "UNIT", "UNITS",
                    
                    // Ürün bilgisi terimleri
                    "INFORMATION", "INFO", "DETAILS", "SPECIFICATIONS", "SPECS", "FEATURES",
                    "DESCRIPTION", "DESCRIPTIONS", "OVERVIEW", "SUMMARY", "ABOUT",
                    "BRAND", "BRANDS", "MANUFACTURER", "MANUFACTURERS", "MAKER", "MAKERS",
                    "MODEL", "MODELS", "VERSION", "VERSIONS", "EDITION", "EDITIONS",
                    "SIZE", "SIZES", "COLOR", "COLORS", "COLOUR", "COLOURS",
                    "MATERIAL", "MATERIALS", "FABRIC", "FABRICS", "FINISH", "FINISHES",
                    
                    // Durum ve durum sıfatları
                    "NEW", "OLD", "USED", "VINTAGE", "ANTIQUE", "CLASSIC", "MODERN", "CONTEMPORARY",
                    "GREAT", "GOOD", "BETTER", "BEST", "BAD", "WORSE", "WORST",
                    "LITTLE", "BIG", "SMALL", "LARGE", "HUGE", "TINY", "GIANT",
                    "LONG", "SHORT", "TALL", "HIGH", "LOW", "DEEP", "SHALLOW",
                    "WIDE", "NARROW", "THICK", "THIN", "HEAVY", "LIGHT", "WEIGHT",
                    "FIRST", "LAST", "NEXT", "PREVIOUS", "CURRENT", "LATEST", "RECENT",
                    "OTHER", "ANOTHER", "SAME", "DIFFERENT", "SIMILAR", "IDENTICAL",
                    "REAL", "FAKE", "ORIGINAL", "AUTHENTIC", "GENUINE", "REPLICA",
                    "PERFECT", "EXCELLENT", "AMAZING", "WONDERFUL", "FANTASTIC", "TERRIFIC",
                    
                    // Fiiller (to be, to have, modal verbs)
                    "ARE", "WAS", "WERE", "IS", "BE", "BEEN", "BEING", "AM",
                    "HAVE", "HAS", "HAD", "HAVING",
                    "DO", "DOES", "DID", "DONE", "DOING",
                    "WILL", "WOULD", "CAN", "COULD", "SHOULD", "MAY", "MIGHT", "MUST", "SHALL",
                    
                    // Yaygın eylem fiilleri
                    "GET", "GOT", "GOTTEN", "GETTING", "GIVE", "GAVE", "GIVEN", "GIVING",
                    "TAKE", "TOOK", "TAKEN", "TAKING", "MAKE", "MADE", "MAKING",
                    "SEE", "SAW", "SEEN", "SEEING", "LOOK", "LOOKED", "LOOKING", "LOOKS",
                    "GO", "WENT", "GONE", "GOING", "COME", "CAME", "COMING",
                    "KNOW", "KNEW", "KNOWN", "KNOWING", "THINK", "THOUGHT", "THINKING",
                    "SAY", "SAID", "SAYING", "TELL", "TOLD", "TELLING",
                    "FIND", "FOUND", "FINDING", "SEARCH", "SEARCHED", "SEARCHING",
                    "USE", "USED", "USING", "WORK", "WORKED", "WORKING", "WORKS",
                    "CALL", "CALLED", "CALLING", "CALLS", "ASK", "ASKED", "ASKING",
                    "TRY", "TRIED", "TRYING", "TRIES", "NEED", "NEEDED", "NEEDING",
                    "WANT", "WANTED", "WANTING", "WANTS", "SHOW", "SHOWED", "SHOWN", "SHOWING",
                    "HELP", "HELPED", "HELPING", "HELPS", "SEEK", "SOUGHT", "SEEKING",
                    "MEET", "MET", "MEETING", "MEETS", "MEETUP", "MEETUPS",
                    "BUY", "BOUGHT", "BUYING", "BUYS", "SELL", "SOLD", "SELLING", "SELLS",
                    "PAY", "PAID", "PAYING", "PAYS", "COST", "COSTS", "COSTING",
                    "SHIP", "SHIPPED", "SHIPPING", "SHIPS", "SEND", "SENT", "SENDING",
                    "RECEIVE", "RECEIVED", "RECEIVING", "DELIVER", "DELIVERED", "DELIVERING",
                    "ORDER", "ORDERED", "ORDERING", "ORDERS", "PURCHASE", "PURCHASED", "PURCHASING",
                    "RETURN", "RETURNED", "RETURNING", "RETURNS", "REFUND", "REFUNDED", "REFUNDING",
                    
                    // Yer adları ve coğrafi terimler
                    "SOUTH", "NORTH", "EAST", "WEST", "CENTRAL", "MIDDLE",
                    "LOUISVILLE", "KENTUCKY", "TEXAS", "CALIFORNIA", "FLORIDA", "NEW YORK",
                    "LONDON", "PARIS", "BERLIN", "TOKYO", "BEIJING", "MOSCOW",
                    "AMERICA", "AMERICAN", "USA", "US", "UK", "UNITED", "STATES",
                    "EUROPE", "EUROPEAN", "ASIA", "ASIAN", "AFRICA", "AFRICAN",
                    "CITY", "CITIES", "TOWN", "TOWNS", "VILLAGE", "VILLAGES",
                    "COUNTRY", "COUNTRIES", "STATE", "STATES", "PROVINCE", "PROVINCES",
                    "REGION", "REGIONS", "AREA", "AREAS", "ZONE", "ZONES",
                    
                    // Zaman ve tarih terimleri
                    "YEAR", "YEARS", "MONTH", "MONTHS", "DAY", "DAYS", "WEEK", "WEEKS",
                    "TIME", "TIMES", "HOUR", "HOURS", "MINUTE", "MINUTES", "SECOND", "SECONDS",
                    "TODAY", "YESTERDAY", "TOMORROW", "NOW", "THEN", "LATER", "EARLIER",
                    "BEFORE", "AFTER", "DURING", "WHILE", "UNTIL", "SINCE", "UNTIL",
                    "MORNING", "AFTERNOON", "EVENING", "NIGHT", "NIGHTS",
                    "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
                    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
                    "SPRING", "SUMMER", "AUTUMN", "FALL", "WINTER",
                    "PAST", "PRESENT", "FUTURE", "RECENT", "ANCIENT", "MODERN",
                    
                    // Sayılar ve miktar terimleri
                    "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
                    "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN", "TWENTY",
                    "HUNDRED", "HUNDREDS", "THOUSAND", "THOUSANDS", "MILLION", "MILLIONS",
                    "MANY", "MORE", "MOST", "LESS", "LEAST", "FEW", "FEWER", "FEWEST",
                    "SOME", "ANY", "ALL", "EACH", "EVERY", "BOTH", "EITHER", "NEITHER",
                    "NONE", "NOTHING", "NOBODY", "NOONE", "SOMETHING", "ANYTHING", "EVERYTHING",
                    "ENOUGH", "TOO", "VERY", "QUITE", "RATHER", "PRETTY", "REALLY",
                    
                    // Bağlaçlar ve edatlar
                    "BUT", "SO", "BECAUSE", "SINCE", "ALTHOUGH", "THOUGH", "HOWEVER", "THEREFORE",
                    "IF", "UNLESS", "WHETHER", "WHILE", "WHEN", "WHERE", "WHY", "HOW",
                    "WHAT", "WHICH", "WHO", "WHOM", "WHOSE", "WHATEVER", "WHICHEVER", "WHOEVER",
                    "ABOUT", "ABOVE", "ACROSS", "AFTER", "AGAINST", "ALONG", "AMONG", "AROUND", "AT",
                    "BEFORE", "BEHIND", "BELOW", "BENEATH", "BESIDE", "BESIDES", "BETWEEN", "BEYOND", "BY",
                    "DOWN", "DURING", "EXCEPT", "FOR", "FROM", "IN", "INTO", "LIKE", "NEAR", "OF",
                    "OFF", "ON", "ONTO", "OUT", "OUTSIDE", "OVER", "PAST", "SINCE", "THROUGH", "THROUGHOUT",
                    "TO", "TOWARD", "TOWARDS", "UNDER", "UNDERNEATH", "UNTIL", "UP", "UPON",
                    "WITH", "WITHIN", "WITHOUT", "VIA", "PER", "AMONGST", "AMIDST",
                    
                    // Meslek ve unvan terimleri
                    "DOCTOR", "DOCTORS", "PROFESSOR", "PROFESSORS", "TEACHER", "TEACHERS",
                    "ENGINEER", "ENGINEERS", "DESIGNER", "DESIGNERS", "ARTIST", "ARTISTS",
                    "MANAGER", "MANAGERS", "DIRECTOR", "DIRECTORS", "PRESIDENT", "PRESIDENTS",
                    "OWNER", "OWNERS", "FOUNDER", "FOUNDERS", "CREATOR", "CREATORS",
                    
                    // Renk terimleri
                    "RED", "GREEN", "BLUE", "YELLOW", "ORANGE", "PURPLE", "PINK", "BROWN",
                    "BLACK", "WHITE", "GRAY", "GREY", "SILVER", "GOLD", "BRONZE",
                    "COLOR", "COLORS", "COLOUR", "COLOURS", "SHADE", "SHADES", "TONE", "TONES",
                    
                    // Boyut ve ölçü terimleri
                    "SIZE", "SIZES", "MEASURE", "MEASURES", "MEASUREMENT", "MEASUREMENTS",
                    "WIDTH", "HEIGHT", "DEPTH", "LENGTH", "DIAMETER", "RADIUS",
                    "INCH", "INCHES", "FOOT", "FEET", "YARD", "YARDS",
                    "CENTIMETER", "CENTIMETERS", "METER", "METERS", "KILOMETER", "KILOMETERS",
                    "MILLIMETER", "MILLIMETERS", "GRAM", "GRAMS", "KILOGRAM", "KILOGRAMS",
                    "POUND", "POUNDS", "OUNCE", "OUNCES",
                    
                    // Teknik terimler
                    "SYSTEM", "SYSTEMS", "TECHNOLOGY", "TECHNOLOGIES", "TECH", "TECHNICAL",
                    "FEATURE", "FEATURES", "FUNCTION", "FUNCTIONS", "FUNCTIONALITY",
                    "SPECIFICATION", "SPECIFICATIONS", "SPECS", "DETAILS", "DETAIL",
                    "PERFORMANCE", "CAPACITY", "CAPABILITIES", "CAPABILITY",
                    "POWER", "ENERGY", "BATTERY", "BATTERIES", "CHARGE", "CHARGING",
                    "SPEED", "SPEEDS", "RATE", "RATES", "LEVEL", "LEVELS",
                    "QUALITY", "QUALITIES", "STANDARD", "STANDARDS", "GRADE", "GRADES",
                    
                    // API ve teknik terimler
                    "API", "APIS", "VISION", "VISIONS", "CLOUD", "CLOUDS", "SERVER", "SERVERS",
                    "REQUEST", "REQUESTS", "RESPONSE", "RESPONSES", "ENDPOINT", "ENDPOINTS",
                    "JSON", "XML", "HTML", "HTTP", "HTTPS", "URL", "URLS", "URI", "URIS",
                    "DOMAIN", "DOMAINS", "SUBDOMAIN", "SUBDOMAINS", "IP", "IPS",
                    
                    // Robot ve AI terimleri (genel kategoriler)
                    "ROBOT", "ROBOTS", "ROBOTICS", "AI", "AIS", "ARTIFICIAL", "INTELLIGENCE",
                    "MACHINE", "MACHINES", "AUTOMATION", "AUTOMATED", "AUTOMATIC",
                    "MECHANICAL", "MECHANISM", "MECHANISMS", "COMPONENT", "COMPONENTS",
                    
                    // Sosyal medya ve platform terimleri
                    "SHARE", "SHARED", "SHARING", "SHARES", "POST", "POSTED", "POSTING", "POSTS",
                    "LIKE", "LIKED", "LIKING", "LIKES", "FOLLOW", "FOLLOWED", "FOLLOWING", "FOLLOWS",
                    "SUBSCRIBE", "SUBSCRIBED", "SUBSCRIBING", "SUBSCRIBES", "SUBSCRIBER", "SUBSCRIBERS",
                    "VIEW", "VIEWED", "VIEWING", "VIEWS", "WATCH", "WATCHED", "WATCHING", "WATCHES",
                    "COMMENT", "COMMENTED", "COMMENTING", "COMMENTS", "REPLY", "REPLIED", "REPLYING", "REPLIES",
                    
                    // Genel ürün kategorileri (zaten categoryWords'de var ama burada da olmalı)
                    "PRODUCT", "PRODUCTS", "ITEM", "ITEMS", "GOOD", "GOODS", "THING", "THINGS",
                    "TOY", "TOYS", "GAME", "GAMES", "PLAY", "PLAYS", "PLAYING",
                    "ENGINE", "ENGINES", "MACHINE", "MACHINES", "TOOL", "TOOLS",
                    "DEVICE", "DEVICES", "GADGET", "GADGETS", "EQUIPMENT", "EQUIPMENTS",
                    "COLLECTIBLE", "COLLECTIBLES", "COLLECTION", "COLLECTIONS",
                    "MODEL", "MODELS", "VERSION", "VERSIONS", "EDITION", "EDITIONS",
                    
                    // Diğer yaygın kelimeler
                    "HERE", "THERE", "WHERE", "EVERYWHERE", "NOWHERE", "SOMEWHERE", "ANYWHERE",
                    "YES", "NO", "NOT", "NEVER", "ALWAYS", "OFTEN", "SOMETIMES", "RARELY",
                    "ALSO", "TOO", "ASWELL", "EITHER", "NEITHER", "BOTH",
                    "JUST", "ONLY", "EVEN", "STILL", "YET", "ALREADY", "AGAIN",
                    "VERY", "QUITE", "RATHER", "PRETTY", "REALLY", "TRULY", "ACTUALLY",
                    "SURE", "CERTAIN", "CERTAINLY", "DEFINITELY", "ABSOLUTELY", "PROBABLY", "PERHAPS", "MAYBE",
                    "PLEASE", "THANK", "THANKS", "THANKYOU", "WELCOME", "SORRY", "EXCUSE",
                    "HELLO", "HI", "HEY", "GOODBYE", "BYE", "SEE", "LATER",
                    "OK", "OKAY", "YES", "YEAH", "YEP", "NAH", "NOPE",
                    "WELL", "OH", "AH", "UH", "UM", "HMM", "HMMM",
                    "OKAY", "SURE", "FINE", "GREAT", "COOL", "NICE", "AWESOME"
                };
                
                // Domain isimleri ve uzantıları filtrele
                var domainWords = new[] { "AMAZON", "EBAY", "WIKIPEDIA", "YOUTUBE", "GOOGLE", "COM", "NET", "ORG", "CO", "UK" };
                
                // Genel kelimeler ve e-ticaret terimleri filtrele (marka olarak kabul edilmemeli)
                var genericBrandWords = new[] {
                    "MEDIA", "EXPLORE", "TODDLER", "BABY", "NEWBORN", "INFANT", "TARGET", "WALMART",
                    "GAP", "POTTERY", "BARN", "KIDS", "LITTLE", "TIKES", "SASSY", "MOONKIE",
                    "WEILIM", "MONTESSORI", "STACKING", "BUILDING", "BLOCKS", "SOFT",
                    "SEARCH", "RESULT", "RESULTS", "PAGE", "PAGES", "SITE", "SITES",
                    "ONLINE", "STORE", "SHOP", "BUY", "SELL", "SALE", "DEAL", "DEALS",
                    "OFFER", "OFFERS", "PROMO", "PROMOTION", "DISCOUNT", "PRICE", "PRICES"
                };
                
                // Kategori kelimeleri filtrele (çoğul formlar dahil)
                var categoryWords = new[] { 
                    // Genel kategoriler
                    "SEWING", "ENGINES", "MACHINE", "MACHINES", "TOOL", "TOOLS", "DEVICE", "DEVICES",
                    "PRODUCT", "PRODUCTS", "ITEM", "ITEMS", "COLLECTIBLE", "COLLECTIBLES",
                    "TOY", "TOYS", "ENGINE", "STEAM", "MODEL", "MODELS",
                    // Steam engine kategorisi
                    "STEAM", "ENGINE", "ENGINES", "CYLINDER", "CYLINDERS", "PISTON", "PISTONS",
                    // Diğer kategoriler
                    "CAMERA", "CAMERAS", "WATCH", "WATCHES", "CONSOLE", "CONSOLES", "GAME", "GAMES",
                    "PHONE", "PHONES", "COMPUTER", "COMPUTERS", "LAPTOP", "LAPTOPS"
                };
                
                // Vision Labels'dan kategori bilgisi al (ürün kategorisine göre filtreleme)
                var detectedCategories = data.VisionResults
                    .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                    .Select(l => l.Description.ToUpper())
                    .Distinct()
                    .ToList();
                
                // Eğer "steam engine" kategorisi varsa, steam/engine kelimelerini filtrele
                var isSteamEngine = detectedCategories.Any(c => c.Contains("STEAM") || c.Contains("ENGINE") || c.Contains("MACHINE"));
                var isToy = detectedCategories.Any(c => c.Contains("TOY"));
                var isCamera = detectedCategories.Any(c => c.Contains("CAMERA"));
                var isWatch = detectedCategories.Any(c => c.Contains("WATCH"));
                var isConsole = detectedCategories.Any(c => c.Contains("CONSOLE") || c.Contains("GAME"));
                
                // Kategori-spesifik filtreleme
                var categorySpecificFilters = new List<string>();
                if (isSteamEngine)
                {
                    categorySpecificFilters.AddRange(new[] { "STEAM", "ENGINE", "ENGINES", "CYLINDER", "MACHINE", "TOOL", "TOY" });
                }
                if (isToy)
                {
                    categorySpecificFilters.AddRange(new[] { "TOY", "TOYS", "GAME", "GAMES" });
                }
                if (isCamera)
                {
                    categorySpecificFilters.AddRange(new[] { "CAMERA", "CAMERAS", "LENS", "LENSES" });
                }
                if (isWatch)
                {
                    categorySpecificFilters.AddRange(new[] { "WATCH", "WATCHES", "CLOCK", "CLOCKS" });
                }
                if (isConsole)
                {
                    categorySpecificFilters.AddRange(new[] { "CONSOLE", "CONSOLES", "GAME", "GAMES" });
                }
                
                // Title pozisyon analizi: Title'ın başında geçen kelimeler daha muhtemelen markadır
                var titleStartWords = new Dictionary<string, int>();
                foreach (var title in searchTitles)
                {
                    var titleWords = title.Split(new[] { ' ', '-', '_', '|', ':', '–', '—' }, StringSplitOptions.RemoveEmptyEntries)
                        .Where(w => w.Length >= 3 && w.Length <= 20)
                        .Where(w => char.IsUpper(w[0]) || w.All(char.IsUpper))
                        .Where(w => w.Any(char.IsLetter))
                        .Select(w => w.Trim('(', ')', '[', ']', '.', ',', ';', ':', '!', '?').ToUpper())
                        .Where(w => w.Length >= 3)
                        .Take(3) // İlk 3 kelimeyi al (marka genelde başta)
                        .ToList();
                    
                    for (int i = 0; i < titleWords.Count; i++)
                    {
                        var word = titleWords[i];
                        if (!titleStartWords.ContainsKey(word))
                        {
                            titleStartWords[word] = 0;
                        }
                        // İlk kelimeye daha fazla ağırlık ver
                        titleStartWords[word] += (3 - i); // İlk kelime: 3 puan, ikinci: 2 puan, üçüncü: 1 puan
                    }
                }
                
                // Brand candidates'a title start pozisyon ağırlığını ekle
                foreach (var kvp in titleStartWords)
                {
                    if (brandCandidates.ContainsKey(kvp.Key))
                    {
                        brandCandidates[kvp.Key] += kvp.Value; // Title başında geçen kelimelere ekstra puan
                    }
                }
                
                // En çok geçen marka adaylarını seç (filtreleme ile)
                var topBrandCandidates = brandCandidates
                    .Where(kvp => !commonWords.Contains(kvp.Key))
                    .Where(kvp => !domainWords.Contains(kvp.Key))
                    .Where(kvp => !genericBrandWords.Contains(kvp.Key)) // Genel kelimeleri filtrele (MEDIA, EXPLORE, TODDLER vb.)
                    .Where(kvp => !categoryWords.Contains(kvp.Key))
                    .Where(kvp => !categorySpecificFilters.Contains(kvp.Key))
                    .Where(kvp => !kvp.Key.Contains(".")) // Domain uzantıları içermemeli
                    .Where(kvp => !kvp.Key.EndsWith("S") || kvp.Key.Length <= 4) // Çoğul formları filtrele (ama kısa markalar hariç: "LEGO" gibi)
                    .Where(kvp => kvp.Key.Length >= 3 && kvp.Key.Length <= 15) // Marka uzunluğu 3-15 karakter
                    .Where(kvp => kvp.Value >= 2) // En az 2 kez geçmeli
                    .OrderByDescending(kvp => kvp.Value)
                    .ThenByDescending(kvp => titleStartWords.ContainsKey(kvp.Key) ? titleStartWords[kvp.Key] : 0) // Title başında geçenlere öncelik
                    .Take(5)
                    .ToList();
                
                foreach (var candidate in topBrandCandidates)
                {
                    potentialBrands.Add(candidate.Key);
                    _logger.LogInformation($"[WEB SEARCH] Dinamik marka bulundu: {candidate.Key} ({candidate.Value} kez)");
                    
                    // Marka bulunduysa, model numarasını da ara
                    var allSearchText = string.Join(" ", data.WebSearchResults.Select(r => $"{r.Title} {r.Snippet}")).ToUpper();
                    var modelPatterns = new[]
                    {
                        // Saat özel pattern'leri (öncelikli)
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]{{2,3}}-\d{{3,4}})",       // "Casio AT-552", "Casio AQ-230A"
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]{{2,3}}\s+\d{{3,4}})",     // "Casio AT 552"
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]{{1,2}}\d{{3,4}}[A-Z]?)",  // "Casio AQ230A"
                        
                        // Genel pattern'ler
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]\d{{2,4}})",           // "Wilesco D16"
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]-\d{{2,4}})",           // "Wilesco D-16"
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]\s+\d{{2,4}})",         // "Wilesco D 16"
                        $@"{Regex.Escape(candidate.Key)}\s+(\d{{2,4}}[A-Z]?)",            // "Wilesco 16", "Wilesco 16A"
                        $@"{Regex.Escape(candidate.Key)}\s+([A-Z]{{1,3}}\d{{1,4}}[A-Z]?)" // "Wilesco M760", "Wilesco D16S"
                    };
                    
                    foreach (var pattern in modelPatterns)
                    {
                        var modelMatches = Regex.Matches(allSearchText, pattern, RegexOptions.IgnoreCase);
                        foreach (Match match in modelMatches)
                        {
                            var model = match.Groups[1].Value.ToUpper().Replace(" ", "").Replace("-", "");
                            if (model.Length >= 2 && model.Length <= 6 && !potentialModels.Contains(model))
                            {
                                potentialModels.Add(model);
                                _logger.LogInformation($"[WEB SEARCH] Model dinamik olarak bulundu: {candidate.Key} {model}");
                            }
                        }
                    }
                }
            }
            
            // ÖNCELİK 2: OCR yoksa Labels'dan da brand çıkar (örn: "Nintendo Game Boy" → "Nintendo")
            if (!potentialBrands.Any() && data.VisionResults.Any())
            {
                var allLabels = data.VisionResults
                    .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                    .Select(l => l.Description)
                    .ToList();
                
                // Bilinen markaları Labels'da ara
                var knownBrands = new[] { "NINTENDO", "SONY", "MICROSOFT", "SEGA", "ATARI", "COMMODORE", 
                    "OLYMPUS", "CANON", "NIKON", "SONY", "PANASONIC", "KODAK", "POLAROID",
                    "LOGITECH", "RAZER", "CORSAIR", "STEELSERIES", "APPLE", "SAMSUNG",
                    "WOWWEE", "HASBRO", "MATTEL", "LEGO", "BANDAI", "TAKARA", "TOMY" };
                
                foreach (var label in allLabels)
                {
                    foreach (var brand in knownBrands)
                    {
                        if (label.ToUpper().Contains(brand))
                        {
                            potentialBrands.Add(brand);
                            _logger.LogInformation($"[WEB SEARCH] Brand Labels'dan çıkarıldı: {brand} (label: {label})");
                        }
                    }
                }
            }
            
            // Tüm web search sonuçlarını birleştir
            var allTitles = string.Join(" ", data.WebSearchResults.Select(r => r.Title ?? ""));
            var allSnippets = string.Join(" ", data.WebSearchResults.Select(r => r.Snippet ?? ""));
            var allText = (allTitles + " " + allSnippets).ToUpper();
            
            // Görsel bazlı sonuçları öncelikle (Vision API, Reverse Image Search)
            var visualBasedResults = data.WebSearchResults
                .Where(r => r.Source != null && (r.Source.Contains("Vision") || r.Source.Contains("Reverse Image") || r.Source.Contains("Visually Similar")))
                .ToList();
            
            _logger.LogInformation($"[WEB SEARCH] {data.WebSearchResults.Count} web search sonucu analiz ediliyor...");
            _logger.LogInformation($"[WEB SEARCH] {visualBasedResults.Count} görsel bazlı sonuç bulundu");
            
            // ÖNCELİK 0: Eğer brand bulunduysa, direkt tüm sonuçlarda brand+model kombinasyonunu ara
            if (potentialBrands.Any())
            {
                _logger.LogInformation($"[WEB SEARCH] {potentialBrands.Count} potansiyel marka bulundu, brand+model kombinasyonu aranıyor...");
                
                // Her brand için model pattern'lerini dene
                foreach (var brand in potentialBrands.OrderByDescending(b => 
                {
                    // Title başında geçen markalara öncelik ver
                    var searchTitlesForPriority = data.WebSearchResults
                        .Where(r => !string.IsNullOrEmpty(r.Title))
                        .Select(r => r.Title)
                        .ToList();
                    return searchTitlesForPriority.Count(t => 
                        t.Split(new[] { ' ', '-', '_', '|', ':' }, StringSplitOptions.RemoveEmptyEntries)
                         .FirstOrDefault()?.Equals(b, StringComparison.OrdinalIgnoreCase) == true);
                }))
                {
                    // Model pattern'leri: "Wilesco D16", "Casio AT-552", "Casio Janus", vb.
                    var modelPatterns = new[]
                    {
                        // Saat özel pattern'leri (öncelikli)
                        $@"{Regex.Escape(brand)}\s+([A-Z]{{2,3}}-\d{{3,4}})",       // "Casio AT-552", "Casio AQ-230A"
                        $@"{Regex.Escape(brand)}\s+([A-Z]{{2,3}}\s+\d{{3,4}})",     // "Casio AT 552"
                        $@"{Regex.Escape(brand)}\s+([A-Z]{{1,2}}\d{{3,4}}[A-Z]?)",  // "Casio AQ230A"
                        
                        // Ürün adları (Janus, Master, Pro gibi)
                        $@"{Regex.Escape(brand)}\s+([A-Z][a-z]{{3,15}})",          // "Casio Janus", "Logitech Master"
                        
                        // Genel pattern'ler
                        $@"{Regex.Escape(brand)}\s+([A-Z]\d{{2,4}})",           // "Wilesco D16"
                        $@"{Regex.Escape(brand)}\s+([A-Z]-\d{{2,4}})",           // "Wilesco D-16"
                        $@"{Regex.Escape(brand)}\s+([A-Z]\s+\d{{2,4}})",         // "Wilesco D 16"
                        $@"{Regex.Escape(brand)}\s+(\d{{2,4}}[A-Z]?)",            // "Wilesco 16", "Wilesco 16A"
                        $@"{Regex.Escape(brand)}\s+([A-Z]{{1,3}}\d{{1,4}}[A-Z]?)" // "Wilesco M760", "Wilesco D16S"
                    };
                    
                    foreach (var pattern in modelPatterns)
                    {
                        var matches = Regex.Matches(allText, pattern, RegexOptions.IgnoreCase);
                        if (matches.Count > 0)
                        {
                            // En çok geçen model numarasını bul
                            var modelGroups = matches.Cast<Match>()
                                .Select(m => m.Groups[1].Value.ToUpper().Replace(" ", "").Replace("-", ""))
                                .Where(m => m.Length >= 2 && m.Length <= 6)
                                .Where(m => !IsInvalidModelWord(m)) // Genel kelimeleri filtrele
                                .GroupBy(m => m)
                                .OrderByDescending(g => g.Count())
                                .ToList();
                            
                            if (modelGroups.Any())
                            {
                                var bestModel = modelGroups.First().Key;
                                
                                // Model'in geçerli olup olmadığını kontrol et
                                if (IsInvalidModelWord(bestModel))
                                {
                                    _logger.LogInformation($"[WEB SEARCH] Model filtrelendi (genel kelime): '{bestModel}'");
                                    continue; // Bu model'i atla, bir sonrakine geç
                                }
                                
                                var combination = $"{brand} {bestModel}";
                                
                                // Kombinasyonun anlamsız olup olmadığını kontrol et (örn: "GATEWAY INTO")
                                if (IsMeaninglessCombination(combination))
                                {
                                    _logger.LogInformation($"[WEB SEARCH] Anlamsız kombinasyon filtrelendi: '{combination}'");
                                    continue; // Bu kombinasyonu atla
                                }
                                
                                var combinationCount = Regex.Matches(allText, Regex.Escape(combination), RegexOptions.IgnoreCase).Count;
                                
                                // Product name: Brand + Model (basit ve genel yaklaşım)
                                result.Brand = brand;
                                result.Model = bestModel;
                                result.ProductName = combination;
                                result.Confidence = combinationCount >= 3 ? 0.90 : (combinationCount >= 2 ? 0.85 : 0.80);
                                result.Reasoning = $"Web search sonuçlarında '{combination}' {combinationCount} kez geçti";
                                result.Evidence.Add($"Web Search: {combinationCount} matches");
                                
                                _logger.LogInformation($"[WEB SEARCH] Brand+Model kombinasyonu bulundu: '{result.ProductName}' ({combinationCount} kez)");
                                return result;
                            }
                        }
                    }
                }
            }
            
            // Brand+Model kombinasyonlarını say
            var brandModelCounts = new Dictionary<string, int>();
            
            // Önce görsel bazlı sonuçlarda ara (daha güvenilir!)
            var visualText = string.Join(" ", visualBasedResults.Select(r => (r.Title ?? "") + " " + (r.Snippet ?? ""))).ToUpper();
            
            foreach (var brand in potentialBrands)
            {
                foreach (var model in potentialModels)
                {
                    // Genel kelimeleri filtrele (örn: "Deals", "Toy", "Robot")
                    if (IsInvalidModelWord(model))
                    {
                        continue; // Bu model'i atla
                    }
                    
                    var combination = $"{brand} {model}";
                    
                    // Kombinasyonun anlamsız olup olmadığını kontrol et (örn: "GATEWAY INTO")
                    if (IsMeaninglessCombination(combination))
                    {
                        continue; // Bu kombinasyonu atla
                    }
                    
                    // Görsel bazlı sonuçlarda ara (2x ağırlık)
                    var visualCount = Regex.Matches(visualText, Regex.Escape(combination), RegexOptions.IgnoreCase).Count;
                    
                    // Tüm sonuçlarda ara
                    var totalCount = Regex.Matches(allText, Regex.Escape(combination), RegexOptions.IgnoreCase).Count;
                    
                    // Görsel bazlı sonuçlarda bulunduysa ekstra puan ver
                    var weightedCount = visualCount * 2 + (totalCount - visualCount);
                    
                    if (weightedCount > 0)
                    {
                        brandModelCounts[combination] = weightedCount;
                        _logger.LogInformation($"[WEB SEARCH] '{combination}' {totalCount} kez bulundu ({visualCount} görsel bazlı, weighted: {weightedCount})");
                    }
                }
            }
            
            // ÖNEMLİ: Text-based sonuçlarda çok sık geçen markaları önce kontrol et
            // Eğer text-based sonuçlarda bir marka çok sık geçiyorsa (>=10 kez), görsel bazlı sonuçlardan önce onu kullan
            if (potentialBrands.Any() && !brandModelCounts.Any())
            {
                var textBasedBrandCounts = potentialBrands
                    .Select(b => new
                    {
                        Brand = b,
                        TextCount = Regex.Matches(allText, $@"\b{Regex.Escape(b)}\b", RegexOptions.IgnoreCase).Count,
                        VisualCount = Regex.Matches(visualText, $@"\b{Regex.Escape(b)}\b", RegexOptions.IgnoreCase).Count
                    })
                    .Where(b => b.TextCount >= 10) // Text-based sonuçlarda en az 10 kez geçmeli
                    .OrderByDescending(b => b.TextCount)
                    .ToList();
                
                if (textBasedBrandCounts.Any())
                {
                    var topBrand = textBasedBrandCounts.First();
                    
                    // DİNAMİK YAKLAŞIM: Text'te bulunan marka ile birlikte geçen diğer kelimeleri kontrol et
                    // Eğer "Brand Product" formatında geçiyorsa ve Brand database'de varsa, Brand'i kullan
                    string actualBrand = topBrand.Brand;
                    string productName = topBrand.Brand;
                    
                    // DİNAMİK YAKLAŞIM: Database'deki markaları text'te ara ve "Brand Product" kombinasyonlarını bul
                    // Örnek: "Nintendo Game Boy", "Sony PlayStation", "Microsoft Xbox"
                    var allDatabaseBrands = await _brandService.GetAllBrandsAsync();
                    var databaseBrandNames = allDatabaseBrands.Select(b => b.NormalizedName ?? b.Name.ToUpper()).ToList();
                    
                    // Text'te "Brand Product" formatında geçen kombinasyonları bul
                    var brandProductPatterns = new List<(string Brand, string Product, int Count)>();
                    
                    foreach (var dbBrand in databaseBrandNames)
                    {
                        if (dbBrand == topBrand.Brand) continue; // Zaten bulunan markayı atla
                        
                        // "Brand Product" formatını ara (örn: "Nintendo Game Boy")
                        var pattern = $@"\b{Regex.Escape(dbBrand)}\s+{Regex.Escape(topBrand.Brand)}\b";
                        var matches = Regex.Matches(allText, pattern, RegexOptions.IgnoreCase);
                        
                        if (matches.Count > 0)
                        {
                            brandProductPatterns.Add((Brand: dbBrand, Product: topBrand.Brand, Count: matches.Count));
                            _logger.LogInformation($"[WEB SEARCH] Dinamik ilişki bulundu: '{dbBrand} {topBrand.Brand}' {matches.Count} kez geçti");
                        }
                        
                        // Ters formatı da kontrol et: "Product Brand" (daha nadir ama mümkün)
                        var reversePattern = $@"\b{Regex.Escape(topBrand.Brand)}\s+{Regex.Escape(dbBrand)}\b";
                        var reverseMatches = Regex.Matches(allText, reversePattern, RegexOptions.IgnoreCase);
                        
                        if (reverseMatches.Count > 0)
                        {
                            brandProductPatterns.Add((Brand: dbBrand, Product: topBrand.Brand, Count: reverseMatches.Count));
                            _logger.LogInformation($"[WEB SEARCH] Dinamik ilişki bulundu (ters format): '{topBrand.Brand} {dbBrand}' {reverseMatches.Count} kez geçti");
                        }
                    }
                    
                    // En çok geçen kombinasyonu bul
                    if (brandProductPatterns.Any())
                    {
                        var bestMatch = brandProductPatterns.OrderByDescending(x => x.Count).First();
                        
                        // Eğer kombinasyon yeterince sık geçiyorsa (>=3 kez), gerçek marka olarak kullan
                        if (bestMatch.Count >= 3)
                        {
                            actualBrand = bestMatch.Brand;
                            productName = $"{bestMatch.Brand} {bestMatch.Product}";
                            _logger.LogInformation($"[WEB SEARCH] Dinamik doğrulama: '{topBrand.Brand}' bir ürün adı olarak algılandı, gerçek marka '{bestMatch.Brand}' bulundu ('{bestMatch.Brand} {bestMatch.Product}' {bestMatch.Count} kez geçti)");
                        }
                        else
                        {
                            _logger.LogInformation($"[WEB SEARCH] Dinamik ilişki bulundu ama yeterince sık değil: '{bestMatch.Brand} {bestMatch.Product}' {bestMatch.Count} kez (minimum 3 gerekli)");
                        }
                    }
                    else
                    {
                        // Kombinasyon bulunamadıysa, sadece database'deki markaları kontrol et
                        // Eğer topBrand database'de yoksa ve başka bir marka text'te geçiyorsa, onu kullan
                        if (!databaseBrandNames.Contains(topBrand.Brand))
                        {
                            // Text'te geçen database markalarını bul
                            var textBrands = databaseBrandNames
                                .Select(b => new
                                {
                                    Brand = b,
                                    Count = Regex.Matches(allText, $@"\b{Regex.Escape(b)}\b", RegexOptions.IgnoreCase).Count
                                })
                                .Where(x => x.Count >= 3) // En az 3 kez geçmeli
                                .OrderByDescending(x => x.Count)
                                .ToList();
                            
                            if (textBrands.Any())
                            {
                                var bestTextBrand = textBrands.First();
                                actualBrand = bestTextBrand.Brand;
                                productName = $"{bestTextBrand.Brand} {topBrand.Brand}";
                                _logger.LogInformation($"[WEB SEARCH] Dinamik doğrulama: '{topBrand.Brand}' database'de yok, text'te geçen database markası '{bestTextBrand.Brand}' kullanıldı ({bestTextBrand.Count} kez geçti)");
                            }
                        }
                    }
                    
                    _logger.LogInformation($"[WEB SEARCH] Text-based sonuçlarda '{topBrand.Brand}' {topBrand.TextCount} kez geçti (görsel: {topBrand.VisualCount}), öncelikli olarak işleniyor...");
                    
                    // Bu marka için model ara - PatternPriorityService kullanarak optimize edilmiş pattern'ler
                    var allFoundModels = new List<(string Model, int Count, PatternPriorityService.PatternPriority Priority)>();
                    
                    // ÖNCE: Uzun kelimeler (Advance, Color, Pocket gibi) - en spesifik
                    var highPriorityPatterns = new[]
                    {
                        $@"{Regex.Escape(actualBrand)}\s+{Regex.Escape(topBrand.Brand)}\s+([A-Z]{{4,15}})", // "Nintendo Game Boy Advance", "Nintendo Game Boy Color"
                        $@"{Regex.Escape(actualBrand)}\s+{Regex.Escape(topBrand.Brand)}\s+(\w{{4,15}})", // "Nintendo Game Boy Pocket" (karışık harf)
                    };
                    
                    foreach (var pattern in highPriorityPatterns)
                    {
                        var matches = Regex.Matches(allText, pattern, RegexOptions.IgnoreCase);
                        foreach (Match match in matches)
                        {
                            var model = match.Groups[1].Value.ToUpper().Replace(" ", "").Replace("-", "");
                            if (model.Length >= 2 && model.Length <= 20)
                            {
                                allFoundModels.Add((model, 1, PatternPriorityService.PatternPriority.High));
                            }
                        }
                    }
                    
                    // SONRA: Kısa pattern'ler (orta öncelik)
                    var mediumPriorityPatterns = new[]
                    {
                        // Saat özel pattern'leri (öncelikli)
                        $@"{Regex.Escape(actualBrand)}\s+([A-Z]{{2,3}}-\d{{3,4}})",       // "Casio AT-552", "Casio AQ-230A"
                        $@"{Regex.Escape(actualBrand)}\s+([A-Z]{{2,3}}\s+\d{{3,4}})",     // "Casio AT 552"
                        $@"{Regex.Escape(actualBrand)}\s+([A-Z]{{1,2}}\d{{3,4}}[A-Z]?)",  // "Casio AQ230A"
                        
                        // Genel pattern'ler
                        $@"{Regex.Escape(topBrand.Brand)}\s+([A-Z]\d{{2,4}})",           // "Wilesco D16"
                        $@"{Regex.Escape(topBrand.Brand)}\s+([A-Z]-\d{{2,4}})",           // "Wilesco D-16"
                        $@"{Regex.Escape(topBrand.Brand)}\s+([A-Z]\s+\d{{2,4}})",         // "Wilesco D 16"
                        $@"{Regex.Escape(topBrand.Brand)}\s+(\d{{2,4}}[A-Z]?)",            // "Wilesco 16", "Wilesco 16A"
                        $@"{Regex.Escape(topBrand.Brand)}\s+([A-Z]{{1,3}}\d{{1,4}}[A-Z]?)", // "Wilesco M760", "Wilesco D16S"
                        $@"{Regex.Escape(actualBrand)}\s+{Regex.Escape(topBrand.Brand)}\s+([A-Z]{{1,3}}\d{{0,4}}[A-Z]?)", // "Nintendo Game Boy SP" (kısa modeller)
                    };
                    
                    foreach (var pattern in mediumPriorityPatterns)
                    {
                        var matches = Regex.Matches(allText, pattern, RegexOptions.IgnoreCase);
                        foreach (Match match in matches)
                        {
                            var model = match.Groups[1].Value.ToUpper().Replace(" ", "").Replace("-", "");
                            if (model.Length >= 2 && model.Length <= 20)
                            {
                                allFoundModels.Add((model, 1, PatternPriorityService.PatternPriority.Medium));
                            }
                        }
                    }
                    
                    // SON OLARAK: Fallback pattern'ler (düşük öncelik)
                    var lowPriorityPatterns = new[]
                    {
                        // Ürün adları (Janus, Master, Pro gibi)
                        $@"{Regex.Escape(actualBrand)}\s+([A-Z][a-z]{{3,15}})",  // "Casio Janus", "Logitech Master"
                        $@"{Regex.Escape(actualBrand)}\s+{Regex.Escape(topBrand.Brand)}\s+([A-Z]+)", // Fallback: Herhangi bir büyük harf kelimesi
                        $@"{Regex.Escape(actualBrand)}\s+{Regex.Escape(topBrand.Brand)}\s+(\w+)", // Fallback: Herhangi bir kelime
                    };
                    
                    foreach (var pattern in lowPriorityPatterns)
                    {
                        var matches = Regex.Matches(allText, pattern, RegexOptions.IgnoreCase);
                        foreach (Match match in matches)
                        {
                            var model = match.Groups[1].Value.ToUpper().Replace(" ", "").Replace("-", "");
                            if (model.Length >= 2 && model.Length <= 20)
                            {
                                allFoundModels.Add((model, 1, PatternPriorityService.PatternPriority.Low));
                            }
                        }
                    }
                    
                    if (allFoundModels.Any())
                    {
                        // Önceliğe göre sırala (High -> Medium -> Low), sonra uzunluk ve sayı
                        var modelGroups = allFoundModels
                            .GroupBy(m => m.Model)
                            .Select(g => new
                            {
                                Model = g.Key,
                                Count = g.Count(),
                                MinPriority = g.Min(m => m.Priority), // En yüksek öncelik (High = 1, Low = 3)
                                Length = g.Key.Length
                            })
                            .OrderBy(g => g.MinPriority) // ÖNCE: Öncelik (High = 1 önce gelir)
                            .ThenByDescending(g => g.Length) // SONRA: En uzun model (Advance > ADV)
                            .ThenByDescending(g => g.Count) // SONRA: En çok geçen
                            .ToList();
                        
                        var bestModel = modelGroups.First().Model;
                        var combination = actualBrand != topBrand.Brand 
                            ? $"{actualBrand} {topBrand.Brand} {bestModel}" 
                            : $"{topBrand.Brand} {bestModel}";
                        var combinationCount = Regex.Matches(allText, Regex.Escape(combination), RegexOptions.IgnoreCase).Count;
                        
                        result.Brand = actualBrand;
                        result.Model = bestModel;
                        result.ProductName = combination;
                        result.Confidence = ConfidenceCalculator.CalculateWebSearchConfidence(
                            matchCount: combinationCount,
                            hasBrand: !string.IsNullOrEmpty(actualBrand),
                            hasModel: !string.IsNullOrEmpty(bestModel),
                            hasBrandModelCombination: true,
                            totalResults: data.WebSearchResults.Count
                        );
                        result.Reasoning = $"Text-based web search sonuçlarında '{combination}' {combinationCount} kez geçti (toplam '{topBrand.Brand}' {topBrand.TextCount} kez)";
                        result.Evidence.Add($"Web Search: {combinationCount} matches, {topBrand.TextCount} total brand mentions");
                        
                        _logger.LogInformation($"[WEB SEARCH] Text-based sonuçlardan brand+model bulundu: '{combination}' ({combinationCount} kez, model uzunluğu: {bestModel.Length})");
                        return result;
                    }
                    
                    // Model bulunamadıysa, marka ve ürün adını kullan
                    result.Brand = actualBrand;
                    result.ProductName = productName;
                    result.Confidence = ConfidenceCalculator.CalculateWebSearchConfidence(
                        matchCount: topBrand.TextCount,
                        hasBrand: !string.IsNullOrEmpty(actualBrand),
                        hasModel: false,
                        hasBrandModelCombination: false,
                        totalResults: data.WebSearchResults.Count
                    );
                    result.Reasoning = $"Text-based web search sonuçlarında '{topBrand.Brand}' {topBrand.TextCount} kez geçti" + 
                        (actualBrand != topBrand.Brand ? $" (gerçek marka: {actualBrand})" : "");
                    result.Evidence.Add($"Web Search: {topBrand.TextCount} brand mentions");
                    
                    _logger.LogInformation($"[WEB SEARCH] Text-based sonuçlardan brand bulundu: '{actualBrand}' (ürün: '{topBrand.Brand}', {topBrand.TextCount} kez)");
                    return result;
                }
            }
            
            // Eğer görsel bazlı sonuçlarda brand+model bulunamadıysa, sadece görsel bazlı sonuçlardan ürün adı çıkar
            if (!brandModelCounts.Any() && visualBasedResults.Any())
            {
                _logger.LogInformation("[WEB SEARCH] Görsel bazlı sonuçlardan ürün adı çıkarılıyor...");
                
                // Görsel bazlı sonuçların title'larından en çok geçen kelimeleri bul
                var visualTitles = string.Join(" ", visualBasedResults.Select(r => r.Title ?? "")).ToUpper();
                
                // ÖNCELİK 1: Eğer brand varsa, görsel sonuçlarda ara
                if (potentialBrands.Any())
                {
                    foreach (var brand in potentialBrands)
                    {
                        var brandInVisual = Regex.Matches(visualTitles, $@"\b{Regex.Escape(brand)}\b", RegexOptions.IgnoreCase).Count;
                        if (brandInVisual >= 1) // En az 1 kez geçmeli
                        {
                            // Platform isimlerini filtrele
                            var platformNamesForTitle = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                            {
                                "YOUTUBE", "FACEBOOK", "INSTAGRAM", "TWITTER", "TIKTOK", "REDDIT",
                                "EBAY", "AMAZON", "WIKIPEDIA", "GOOGLE", "BING", "YAHOO"
                            };
                            
                            // Title'lardan model numarası veya ürün adı çıkar
                            var titleWords = visualBasedResults
                                .SelectMany(r => (r.Title ?? "").Split(new[] { ' ', '-', '_', ':' }, StringSplitOptions.RemoveEmptyEntries))
                                .Where(w => {
                                    var wUpper = w.ToUpper();
                                    return w.Length > 2 && 
                                           !w.Equals(brand, StringComparison.OrdinalIgnoreCase) &&
                                           !platformNamesForTitle.Contains(wUpper);
                                })
                                .GroupBy(w => w.ToUpper())
                                .OrderByDescending(g => g.Count())
                                .Take(5)
                                .Select(g => g.Key)
                                .ToList();
                            
                            if (titleWords.Any())
                            {
                                var productName = $"{brand} {string.Join(" ", titleWords.Take(2))}";
                                result.Brand = brand;
                                result.Model = string.Join(" ", titleWords.Take(2));
                                result.ProductName = productName;
                                result.Confidence = 0.85; // Görsel bazlı sonuçlar yüksek güvenilirlik
                                result.Reasoning = $"Görsel bazlı arama sonuçlarından çıkarıldı: '{productName}'";
                                result.Evidence.Add($"Visual Search: {visualBasedResults.Count} results");
                                
                                _logger.LogInformation($"[WEB SEARCH] Görsel bazlı sonuçlardan ürün bulundu: '{productName}'");
                                return result;
                            }
                        }
                    }
                }
                
                // ÖNCELİK 2: Brand yoksa, görsel sonuçlardan brand+model çıkar
                // Önce bilinen markaları kontrol et
                var knownBrands = new[] { "WILESCO", "MAMOD", "JENSEN", "POLAROID", "KODAK", "NINTENDO", 
                    "SONY", "MICROSOFT", "SEGA", "ATARI", "COMMODORE", "OLYMPUS", "CANON", "NIKON", 
                    "LOGITECH", "RAZER", "CORSAIR", "WOWWEE", "HASBRO", "MATTEL", "LEGO", "BANDAI" };
                
                var visualTitlesUpper = visualTitles.ToUpper();
                
                // Türkçe filtreleme kelimeleri
                var turkishFilterWords = new[] { "GÖRSEL", "EŞLEŞMESI", "KISMI", "GÖRSEL", "EŞLEŞMESI", "BEST", "ELECTRONICDEVICE" };
                
                foreach (var brand in knownBrands)
                {
                    if (visualTitlesUpper.Contains(brand))
                    {
                        // Platform isimlerini filtrele
                        var platformNamesForTitle2 = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                        {
                            "YOUTUBE", "FACEBOOK", "INSTAGRAM", "TWITTER", "TIKTOK", "REDDIT",
                            "EBAY", "AMAZON", "WIKIPEDIA", "GOOGLE", "BING", "YAHOO"
                        };
                        
                        // Brand bulundu, title'lardan model çıkar
                        var titleWords = visualBasedResults
                            .SelectMany(r => (r.Title ?? "").Split(new[] { ' ', '-', '_', ':', '|' }, StringSplitOptions.RemoveEmptyEntries))
                            .Where(w => {
                                var wUpper = w.ToUpper();
                                return w.Length >= 2 && w.Length <= 20 &&
                                       !w.Equals(brand, StringComparison.OrdinalIgnoreCase) &&
                                       !wUpper.Equals("ROBOT") &&
                                       !wUpper.Equals("TOY") &&
                                       !wUpper.Equals("THE") &&
                                       !wUpper.Equals("AND") &&
                                       !platformNamesForTitle2.Contains(wUpper) &&
                                       !turkishFilterWords.Contains(wUpper) &&
                                       !w.Contains(".") &&
                                       !Regex.IsMatch(w, @"^https?://", RegexOptions.IgnoreCase) &&
                                       !Regex.IsMatch(w, @"^[a-z]{1,2}$", RegexOptions.IgnoreCase); // Çok kısa kelimeleri filtrele
                            })
                            .GroupBy(w => w.ToUpper())
                            .OrderByDescending(g => g.Count())
                            .Take(5)
                            .Select(g => g.Key)
                            .ToList();
                        
                        if (titleWords.Any())
                        {
                            var model = string.Join(" ", titleWords.Take(3));
                            var productName = $"{brand} {model}";
                            
                            result.Brand = brand;
                            result.Model = model;
                            result.ProductName = productName;
                            result.Confidence = 0.85;
                            result.Reasoning = $"Görsel bazlı sonuçlardan bilinen marka bulundu: '{productName}'";
                            result.Evidence.Add($"Visual Search: {visualBasedResults.Count} results");
                            
                            _logger.LogInformation($"[WEB SEARCH] Bilinen marka görsel sonuçlarda bulundu: '{productName}'");
                            return result;
                        }
                    }
                }
                
                // Bilinen marka bulunamadıysa, title'lardan en çok geçen kelimeleri bul
                // ÖNEMLİ: Sadece anlamlı title'ları kullan (hash'ler, UUID'ler, random kodlar değil)
                var platformNamesForFilter = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "YOUTUBE", "FACEBOOK", "INSTAGRAM", "TWITTER", "TIKTOK", "REDDIT",
                    "EBAY", "AMAZON", "WIKIPEDIA", "GOOGLE", "BING", "YAHOO"
                };
                
                var meaningfulTitles = visualBasedResults
                    .Where(r => !string.IsNullOrEmpty(r.Title))
                    .Where(r => {
                        var title = r.Title.ToUpper();
                        // Platform isimlerini içeren title'ları filtrele (sadece platform adı olanlar)
                        if (title.Split(' ', '-', '_', ':', '|').All(w => platformNamesForFilter.Contains(w)))
                        {
                            return false;
                        }
                        // Anlamsız title'ları filtrele (hash'ler, UUID'ler, random kodlar)
                        return !title.Contains("API") && 
                               !title.Contains("IMG") && 
                               !title.Contains("UUID") &&
                               !title.Contains("V1") &&
                               !title.Contains("PROD") &&
                               !Regex.IsMatch(title, @"^[A-Z]{1,2}\d+[A-Z]{1,2}\d+") && // "F1OTK4E" gibi
                               !Regex.IsMatch(title, @"^[A-Z0-9]{8,}$") && // Hash'ler
                               title.Split(' ').Any(w => w.Length >= 4); // En az bir 4+ karakterli kelime olmalı
                    })
                    .ToList();
                
                if (!meaningfulTitles.Any())
                {
                    _logger.LogWarning("[WEB SEARCH] Görsel bazlı sonuçlarda anlamlı title bulunamadı, atlanıyor");
                    return result;
                }
                
                // Platform isimlerini filtrele
                var platformNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "YOUTUBE", "FACEBOOK", "INSTAGRAM", "TWITTER", "TIKTOK", "REDDIT",
                    "EBAY", "AMAZON", "WIKIPEDIA", "GOOGLE", "BING", "YAHOO",
                    "LINKEDIN", "PINTEREST", "SNAPCHAT", "DISCORD", "TELEGRAM",
                    "VIMEO", "DAILYMOTION", "TWITCH", "SPOTIFY", "SOUNDCLOUD"
                };
                
                var allTitleWords = meaningfulTitles
                    .SelectMany(r => (r.Title ?? "").Split(new[] { ' ', '-', '_', ':', '|' }, StringSplitOptions.RemoveEmptyEntries))
                    .Where(w => w.Length >= 4 && w.Length <= 20) // 4-20 karakter arası (daha uzun kelimeler daha anlamlı)
                    .Select(w => w.Trim()) // Boşlukları temizle
                    .Where(w => !string.IsNullOrEmpty(w))
                    .Where(w => {
                        var wUpper = w.ToUpper();
                        // Platform isimlerini filtrele (case-insensitive)
                        if (platformNames.Contains(wUpper))
                        {
                            return false;
                        }
                        // Genel filtreler
                        return !wUpper.Equals("ROBOT") && 
                               !wUpper.Equals("TOY") &&
                               !wUpper.Equals("THE") &&
                               !wUpper.Equals("AND") &&
                               !turkishFilterWords.Contains(wUpper) &&
                               !w.StartsWith("HTTP", StringComparison.OrdinalIgnoreCase) &&
                               !w.Contains(".") && // URL'leri filtrele
                               !Regex.IsMatch(w, @"^https?://", RegexOptions.IgnoreCase) &&
                               !Regex.IsMatch(w, @"^[A-Z]{1,2}\d+$", RegexOptions.IgnoreCase) && // "F1O", "TK4E" gibi kodları filtrele
                               !Regex.IsMatch(w, @"^[A-Z0-9]{6,}$", RegexOptions.IgnoreCase) && // Hash'leri filtrele
                               w.Any(char.IsLower); // En az bir küçük harf içermeli (büyük harfler genelde kod)
                    })
                    .GroupBy(w => w.ToUpper())
                    .OrderByDescending(g => g.Count())
                    .Take(10)
                    .Select(g => g.Key)
                    .ToList();
                
                if (allTitleWords.Count >= 2)
                {
                    // İlk kelimeyi brand, geri kalanını model olarak kabul et
                    var extractedBrand = allTitleWords[0];
                    var extractedModel = string.Join(" ", allTitleWords.Skip(1).Take(3));
                    var productName = $"{extractedBrand} {extractedModel}";
                    
                    result.Brand = extractedBrand;
                    result.Model = extractedModel;
                    result.ProductName = productName;
                    result.Confidence = 0.75; // Biraz daha düşük confidence (bilinen marka değilse)
                    result.Reasoning = $"Görsel bazlı sonuçlardan brand+model çıkarıldı: '{productName}'";
                    result.Evidence.Add($"Visual Search: {visualBasedResults.Count} results");
                    
                    _logger.LogInformation($"[WEB SEARCH] Görsel bazlı sonuçlardan brand+model çıkarıldı: '{productName}'");
                    return result;
                }
            }
            
            // En çok geçen kombinasyonu bul
            if (brandModelCounts.Any())
            {
                var bestCombination = brandModelCounts.OrderByDescending(kvp => kvp.Value).First();
                
                // Telefon context'i kontrolü: "GADGET" kelimesi telefon için yanlış eşleşme olabilir
                var isPhoneContext = allText.Contains("phone", StringComparison.OrdinalIgnoreCase) || 
                                    allText.Contains("telephone", StringComparison.OrdinalIgnoreCase) ||
                                    allText.Contains("corded", StringComparison.OrdinalIgnoreCase) ||
                                    allText.Contains("rotary", StringComparison.OrdinalIgnoreCase) ||
                                    data.VisionResults.Any(v => v.Labels?.Any(l => 
                                        l.Description.Contains("Phone", StringComparison.OrdinalIgnoreCase) ||
                                        l.Description.Contains("Telephone", StringComparison.OrdinalIgnoreCase)) == true);
                
                // Eğer telefon context'i varsa ve "GADGET" kelimesi geçiyorsa ama telefon kelimesi yoksa, filtrele
                if (isPhoneContext && bestCombination.Key.Contains("GADGET", StringComparison.OrdinalIgnoreCase) && 
                    !bestCombination.Key.Contains("phone", StringComparison.OrdinalIgnoreCase) &&
                    !bestCombination.Key.Contains("telephone", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation($"[WEB SEARCH] 'GADGET' telefon context'inde yanlış eşleşme olarak filtrelendi: '{bestCombination.Key}'");
                    // Bir sonraki kombinasyonu dene
                    bestCombination = brandModelCounts.OrderByDescending(kvp => kvp.Value).Skip(1).FirstOrDefault();
                    if (bestCombination.Key == null)
                    {
                        _logger.LogInformation($"[WEB SEARCH] Alternatif kombinasyon bulunamadı, telefon için genel sonuç kullanılacak");
                        // Telefon için genel sonuç döndür
                        result.ProductName = "Vintage Telephone";
                        result.Confidence = 0.60;
                        result.Reasoning = "Telefon tespit edildi ancak spesifik marka/model bulunamadı";
                        return result;
                    }
                }
                
                var parts = bestCombination.Key.Split(' ');
                
                // Product name: Brand + Model (basit ve genel yaklaşım)
                result.Brand = parts[0];
                result.Model = parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : "";
                result.ProductName = bestCombination.Key;
                
                // Confidence: En az 3 kez geçtiyse yüksek, 1-2 kez geçtiyse orta
                result.Confidence = bestCombination.Value >= 3 ? 0.90 : (bestCombination.Value >= 2 ? 0.80 : 0.70);
                result.Reasoning = $"Web search sonuçlarında '{bestCombination.Key}' {bestCombination.Value} kez geçti";
                result.Evidence.Add($"Web Search: {bestCombination.Value} matches");
                
                _logger.LogInformation($"[WEB SEARCH] En iyi kombinasyon: '{result.ProductName}' ({bestCombination.Value} kez)");
                return result;
            }
            
            // Brand+Model kombinasyonu bulunamadıysa, direkt title'larda "Brand Model" formatını ara
            if (potentialBrands.Any() && potentialModels.Any())
            {
                var searchTitlesForBrand = data.WebSearchResults
                    .Where(r => !string.IsNullOrEmpty(r.Title))
                    .Select(r => r.Title)
                    .ToList();
                
                foreach (var brand in potentialBrands.OrderByDescending(b => 
                {
                    // Title başında geçen markalara öncelik ver
                    var titleStartCount = searchTitlesForBrand.Count(t => 
                        t.Split(new[] { ' ', '-', '_', '|', ':' }, StringSplitOptions.RemoveEmptyEntries)
                         .FirstOrDefault()?.Equals(b, StringComparison.OrdinalIgnoreCase) == true);
                    return titleStartCount;
                }))
                {
                    foreach (var model in potentialModels.OrderByDescending(m => m.Length)) // Uzun modellere öncelik
                    {
                        // Genel kelimeleri filtrele (örn: "Deals", "Toy", "Robot")
                        if (IsInvalidModelWord(model))
                        {
                            continue; // Bu model'i atla
                        }
                        
                        var combination = $"{brand} {model}";
                        
                        // Kombinasyonun anlamsız olup olmadığını kontrol et (örn: "GATEWAY INTO")
                        if (IsMeaninglessCombination(combination))
                        {
                            _logger.LogInformation($"[WEB SEARCH] Anlamsız kombinasyon filtrelendi: '{combination}'");
                            continue; // Bu kombinasyonu atla
                        }
                        
                        var combinationCount = Regex.Matches(allText, Regex.Escape(combination), RegexOptions.IgnoreCase).Count;
                        
                        if (combinationCount >= 2) // En az 2 kez geçmeli
                        {
                            result.Brand = brand;
                            result.Model = model;
                            result.ProductName = combination;
                            result.Confidence = combinationCount >= 3 ? 0.85 : 0.75;
                            result.Reasoning = $"Web search sonuçlarında '{combination}' {combinationCount} kez geçti";
                            result.Evidence.Add($"Web Search: {combinationCount} matches");
                            
                            _logger.LogInformation($"[WEB SEARCH] Brand+Model kombinasyonu bulundu: '{combination}' ({combinationCount} kez)");
                            return result;
                        }
                    }
                }
            }
            
            // Sadece brand geçiyorsa (ama title başında geçenlere öncelik)
            var searchTitlesForBrandOnly = data.WebSearchResults
                .Where(r => !string.IsNullOrEmpty(r.Title))
                .Select(r => r.Title)
                .ToList();
            
            var brandWithTitleStart = potentialBrands
                .Select(b => new
                {
                    Brand = b,
                    TitleStartCount = searchTitlesForBrandOnly.Count(t => 
                        t.Split(new[] { ' ', '-', '_', '|', ':' }, StringSplitOptions.RemoveEmptyEntries)
                         .FirstOrDefault()?.Equals(b, StringComparison.OrdinalIgnoreCase) == true),
                    TotalCount = Regex.Matches(allText, $@"\b{Regex.Escape(b)}\b", RegexOptions.IgnoreCase).Count
                })
                .Where(b => b.TotalCount >= 3) // En az 3 kez geçmeli
                .OrderByDescending(b => b.TitleStartCount) // Title başında geçenlere öncelik
                .ThenByDescending(b => b.TotalCount)
                .FirstOrDefault();
            
            if (brandWithTitleStart != null)
            {
                result.Brand = brandWithTitleStart.Brand;
                result.ProductName = brandWithTitleStart.Brand;
                result.Confidence = brandWithTitleStart.TitleStartCount > 0 ? 0.70 : 0.65;
                result.Reasoning = $"Web search sonuçlarında '{brandWithTitleStart.Brand}' {brandWithTitleStart.TotalCount} kez geçti (title başında {brandWithTitleStart.TitleStartCount} kez)";
                result.Evidence.Add($"Web Search: {brandWithTitleStart.TotalCount} brand matches");
                
                _logger.LogInformation($"[WEB SEARCH] Brand bulundu: '{brandWithTitleStart.Brand}' ({brandWithTitleStart.TotalCount} kez, title başında {brandWithTitleStart.TitleStartCount} kez)");
                return result;
            }
            
            return result;
        }

        public ProductIdentificationResult IdentifyFromWebDetection(AnalysisDataCollection data)
        {
            var result = new ProductIdentificationResult
            {
                ProductName = "",
                Brand = "",
                Model = "",
                Confidence = 0.0,
                Reasoning = "",
                Evidence = new List<string>()
            };

            // Web Detection verilerini topla
            var bestGuesses = data.VisionResults
                .Where(v => v.BestGuessLabel != null)
                .Select(v => v.BestGuessLabel!)
                .ToList();

            var allWebEntities = new List<WebEntity>();
            foreach (var vr in data.VisionResults)
            {
                if (vr.WebEntities != null)
                {
                    allWebEntities.AddRange(vr.WebEntities);
                }
            }
            
            var webEntities = allWebEntities
                .GroupBy(e => e.Description)
                .Select(g => new { Description = g.Key, Score = g.Average(e => e.Score) })
                .OrderByDescending(e => e.Score)
                .Take(10)
                .ToList();

            var visionLabels = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .GroupBy(l => l.Description)
                .Select(g => new { Description = g.Key, Score = g.Average(l => l.Score) })
                .OrderByDescending(g => g.Score)
                .Take(10)
                .ToList();

            _logger.LogInformation($"[WEB DETECT] BestGuesses: {string.Join(", ", bestGuesses)}, TopWebEntities: {string.Join(", ", webEntities.Take(3).Select(e => $"{e.Description}({e.Score:F2})"))}");

            // STRATEGY 1: Best Guess + Top Web Entity + Vision Labels
            var bestGuess = bestGuesses.FirstOrDefault();
            if (!string.IsNullOrEmpty(bestGuess) && webEntities.Any() && visionLabels.Any())
            {
                var topEntity = webEntities.First();
                var topLabels = visionLabels.Take(3).Select(l => l.Description).ToList();
                
                // "game boy" + "Game Boy Advance" gibi entity varsa birleştir
                if (topEntity.Description.ToLower().Contains(bestGuess.ToLower()) || 
                    bestGuess.ToLower().Contains(topEntity.Description.ToLower()))
                {
                    // Nintendo gibi bir brand entity var mı?
                    var brandEntity = webEntities.FirstOrDefault(e => 
                        e.Description.ToLower().Contains("nintendo") || 
                        e.Description.ToLower().Contains("sony") ||
                        e.Description.ToLower().Contains("microsoft") ||
                        e.Description.ToLower().Contains("sega") && e.Score > 0.4);

                    if (brandEntity != null && !brandEntity.Description.Equals(topEntity.Description, StringComparison.OrdinalIgnoreCase))
                    {
                        result.Brand = brandEntity.Description;
                        result.Model = topEntity.Description;
                        result.ProductName = $"{brandEntity.Description} {topEntity.Description}";
                    }
                    else
                    {
                        // Brand bulunamadıysa, label'lardan çıkar
                        var consoleLabel = topLabels.FirstOrDefault(l => l.ToLower().Contains("console"));
                        result.ProductName = topEntity.Description;
                        result.Model = topEntity.Description;
                    }
                    
                    result.Confidence = ConfidenceCalculator.CalculateWebDetectionConfidence(
                        webEntityScore: topEntity.Score,
                        hasBestGuess: !string.IsNullOrEmpty(bestGuess),
                        hasMultipleEntities: webEntities.Count > 1
                    );
                    result.Reasoning = $"Web Detection: '{topEntity.Description}' + Labels: '{string.Join(", ", topLabels.Take(2))}'";
                    result.Evidence.Add($"WebEntity: {topEntity.Description} ({topEntity.Score:F2})");
                    result.Evidence.Add($"BestGuess: {bestGuess}");
                    result.Evidence.Add($"Labels: {string.Join(", ", topLabels)}");
                    
                    _logger.LogInformation($"[WEB DETECT] Strategy 1 - Product: {result.ProductName}, Confidence: {result.Confidence:F3}");
                    return result;
                }
            }

            // STRATEGY 2: Top Web Entity Only (yüksek score)
            if (webEntities.Any() && webEntities.First().Score > 0.6)
            {
                var topEntity = webEntities.First();
                result.ProductName = topEntity.Description;
                result.Model = topEntity.Description;
                result.Confidence = ConfidenceCalculator.CalculateWebDetectionConfidence(
                    webEntityScore: topEntity.Score,
                    hasBestGuess: !string.IsNullOrEmpty(bestGuess),
                    hasMultipleEntities: webEntities.Count > 1
                );
                result.Reasoning = $"High-confidence Web Entity: '{topEntity.Description}'";
                result.Evidence.Add($"WebEntity: {topEntity.Description} ({topEntity.Score:F2})");
                
                _logger.LogInformation($"[WEB DETECT] Strategy 2 - Product: {result.ProductName}, Confidence: {result.Confidence:F3}");
                return result;
            }

            // STRATEGY 3: Best Guess + Labels
            if (!string.IsNullOrEmpty(bestGuess) && visionLabels.Any())
            {
                var topLabel = visionLabels.First();
                result.ProductName = $"{topLabel.Description}";
                result.Confidence = Math.Min(0.65, topLabel.Score);
                result.Reasoning = $"Label + BestGuess: '{topLabel.Description}' + '{bestGuess}'";
                result.Evidence.Add($"Label: {topLabel.Description}");
                result.Evidence.Add($"BestGuess: {bestGuess}");
                
                _logger.LogInformation($"[WEB DETECT] Strategy 3 - Product: {result.ProductName}, Confidence: {result.Confidence:F3}");
                return result;
            }

            _logger.LogInformation($"[WEB DETECT] No strong match found");
            return result;
        }

        public ProductIdentificationResult IdentifyFromVisionLabels(AnalysisDataCollection data)
        {
            var result = new ProductIdentificationResult
            {
                ProductName = "",
                Brand = "",
                Model = "",
                Confidence = 0.0,
                Reasoning = "",
                Evidence = new List<string>()
            };

            // Vision Labels'ları topla ve skorla
            var labelGroups = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .GroupBy(l => l.Description)
                .Select(g => new { Description = g.Key, Score = g.Average(l => l.Score), Count = g.Count() })
                .OrderByDescending(g => g.Score * g.Count) // Hem score hem frequency
                .Take(10)
                .ToList();

            if (!labelGroups.Any())
            {
                _logger.LogWarning("[LABELS] No labels found");
                return result;
            }

            var topLabels = labelGroups.Take(5).Select(l => $"{l.Description}({l.Score:F2})").ToList();
            _logger.LogInformation($"[LABELS] Top labels: {string.Join(", ", topLabels)}");

            // STRATEGY 1: Spesifik product labels (Game Boy, PlayStation, etc.)
            var specificLabels = new[] { "Game Boy", "PlayStation", "Xbox", "Nintendo", "Sega", "Atari", "Game Boy Advance", "PSP", "Nintendo DS" };
            var specificMatch = labelGroups.FirstOrDefault(l => specificLabels.Any(s => l.Description.Contains(s, StringComparison.OrdinalIgnoreCase)));
            
            if (specificMatch != null)
            {
                result.ProductName = specificMatch.Description;
                result.Model = specificMatch.Description;
                result.Confidence = ConfidenceCalculator.CalculateLabelsConfidence(
                    topLabelScore: specificMatch.Score,
                    labelCount: labelGroups.Count,
                    isSpecificProduct: true
                );
                result.Reasoning = $"High-confidence specific label: '{specificMatch.Description}'";
                result.Evidence.Add($"Label: {specificMatch.Description} ({specificMatch.Score:F2})");
                
                _logger.LogInformation($"[LABELS] Strategy 1 - Specific product: {result.ProductName}, Confidence: {result.Confidence:F3}");
                return result;
            }

            // STRATEGY 2: Generic + Modifier (Handheld game console → Game Console)
            var genericLabels = new[] { "console", "game", "handheld", "video game", "electronic", "device", "gadget" };
            var productLabels = labelGroups.Where(l => 
                l.Description.ToLower().Contains("game") || 
                l.Description.ToLower().Contains("console") ||
                l.Description.ToLower().Contains("handheld")
            ).ToList();

            if (productLabels.Any())
            {
                // En specific olanı seç
                var bestLabel = productLabels.OrderByDescending(l => l.Description.Split(' ').Length).First();
                result.ProductName = bestLabel.Description;
                result.Confidence = Math.Min(0.85, bestLabel.Score);
                result.Reasoning = $"Generic product label: '{bestLabel.Description}'";
                result.Evidence.Add($"Label: {bestLabel.Description} ({bestLabel.Score:F2})");
                
                _logger.LogInformation($"[LABELS] Strategy 2 - Generic product: {result.ProductName}, Confidence: {result.Confidence:F3}");
                return result;
            }

            // STRATEGY 3: Top label (fallback)
            var topLabel = labelGroups.First();
            result.ProductName = topLabel.Description;
            result.Confidence = Math.Min(0.70, topLabel.Score);
            result.Reasoning = $"Top label: '{topLabel.Description}'";
            result.Evidence.Add($"Label: {topLabel.Description} ({topLabel.Score:F2})");
            
            _logger.LogInformation($"[LABELS] Strategy 3 - Top label: {result.ProductName}, Confidence: {result.Confidence:F3}");
            return result;
        }

        public ProductIdentificationResult IdentifyProductSimple(AnalysisDataCollection data)
        {
            var result = new ProductIdentificationResult();

            // Tüm veri kaynaklarını topla
            var ocrText = data.OcrText.ToUpper();
            var brands = _ocrExtraction.ExtractPotentialBrands(ocrText);
            var models = _ocrExtraction.ExtractPotentialModels(ocrText);
            
            var bestGuess = data.VisionResults
                .Where(v => !string.IsNullOrEmpty(v.BestGuessLabel))
                .Select(v => v.BestGuessLabel)
                .FirstOrDefault();
            
            var webEntities = data.VisionResults
                .SelectMany(v => v.WebEntities ?? new List<WebEntity>())
                .OrderByDescending(e => e.Score)
                .ToList();

            _logger.LogInformation($"[IDENTIFY] Veri kaynakları - Brands: {brands.Count}, Models: {models.Count}, BestGuess: '{bestGuess}', WebEntities: {webEntities.Count}");

            // STRATEJI 1: OCR'den hem brand hem model bulundu (EN GÜÇLÜ!)
            if (brands.Any() && models.Any())
            {
                result.Brand = brands.First();
                
                // Tüm model bilgilerini birleştir (akıllı sıralama)
                var modelParts = new List<string>();
                
                // Önce uzun model isimleri (COLORBURST, INSTANT CAMERA)
                var longModels = models.Where(m => m.Length > 5 || m.Contains(" ")).OrderByDescending(m => m.Length).ToList();
                modelParts.AddRange(longModels.Take(2));
                
                // Sonra sayılar - EN UZUN SAYIYI ÖNCELİKLE (760 > 23, 19, 76)
                var numericModels = models.Where(m => Regex.IsMatch(m, @"^\d+$")).OrderByDescending(m => m.Length).ThenByDescending(m => int.Parse(m)).ToList();
                // En uzun ve en büyük sayıyı al (760 gibi)
                if (numericModels.Any())
                {
                    var bestNumericModel = numericModels.First();
                    modelParts.Add(bestNumericModel);
                    _logger.LogInformation($"[IDENTIFY] En iyi numeric model seçildi: {bestNumericModel} (tüm numeric modeller: {string.Join(", ", numericModels)})");
                }
                
                result.Model = string.Join(" ", modelParts.Distinct());
                
                // Model numarası varsa daha spesifik isim oluştur
                if (result.Model.Any(char.IsDigit))
                {
                    result.ProductName = $"{result.Brand} {result.Model}";
                }
                else
                {
                    // Model numarası yoksa BestGuess ile birleştir
                    result.ProductName = $"{result.Brand} {result.Model} {bestGuess}";
                }
                
                result.Confidence = 0.95;
                result.Reasoning = result.ProductName; // Sadece ürün adı
                result.Evidence.Add($"{result.Brand}");
                result.Evidence.Add($"{result.Model}");
                
                _logger.LogInformation($"[IDENTIFY] STRATEJI 1 seçildi: {result.ProductName}");
                return result;
            }

            // STRATEJI 2: Sadece brand bulundu, BestGuess ile birleştir
            if (brands.Any())
            {
                result.Brand = brands.First();
                
                // BestGuess'te model bilgisi olabilir mi?
                if (!string.IsNullOrEmpty(bestGuess))
                {
                    result.ProductName = $"{result.Brand} {bestGuess}";
                    result.Confidence = 0.85;
                    result.Reasoning = result.ProductName; // Sadece ürün adı
                    result.Evidence.Add($"{result.Brand}");
                    result.Evidence.Add($"{bestGuess}");
                }
                else
                {
                    result.ProductName = result.Brand;
                    result.Confidence = 0.70;
                    result.Reasoning = result.Brand; // Sadece marka adı
                    result.Evidence.Add($"{result.Brand}");
                }
                
                _logger.LogInformation($"[IDENTIFY] STRATEJI 2 seçildi: {result.ProductName}");
                return result;
            }

            // STRATEJI 3: OCR Brand + BestGuess + WebEntities kombinasyonu
            if (!string.IsNullOrEmpty(bestGuess) && webEntities.Any())
            {
                var topEntity = webEntities.First();
                
                // OCR'dan brand varsa onu kullan, yoksa WebEntities'den al
                if (brands.Any())
                {
                    result.Brand = brands.First(); // OCR'dan bulunan brand'i öncelikle kullan
                    result.Model = topEntity.Description; // WebEntities'den model
                    result.ProductName = $"{result.Brand} {topEntity.Description} {bestGuess}";
                }
                else
                {
                    // Brand ve Model'i ayır (örn: "Mercedes-Benz 450SEL 6.9")
                    var parts = topEntity.Description.Split(new[] { ' ', '-' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 1)
                    {
                        result.Brand = parts[0]; // "Mercedes" veya "Mercedes-Benz"
                        result.Model = string.Join(" ", parts.Skip(1)); // "450SEL 6.9"
                    }
                    
                    result.ProductName = $"{topEntity.Description} {bestGuess}";
                }
                
                result.Confidence = 0.75;
                result.Reasoning = result.ProductName; // Sadece ürün adı
                result.Evidence.Add($"{topEntity.Description}");
                result.Evidence.Add($"{bestGuess}");
                
                _logger.LogInformation($"[IDENTIFY] STRATEJI 3 seçildi: {result.ProductName}, Brand: {result.Brand}, Model: {result.Model}");
                return result;
            }

            // STRATEJI 4: Sadece BestGuess
            if (!string.IsNullOrEmpty(bestGuess))
            {
                result.ProductName = bestGuess;
                result.Confidence = 0.65;
                result.Reasoning = bestGuess; // Sadece ürün adı
                result.Evidence.Add($"{bestGuess}");
                
                _logger.LogInformation($"[IDENTIFY] STRATEJI 4 seçildi: {result.ProductName}");
                return result;
            }

            // STRATEJI 5: En iyi WebEntity
            if (webEntities.Any() && webEntities.First().Score > 0.5)
            {
                var topEntity = webEntities.First();
                result.ProductName = topEntity.Description;
                result.Confidence = Math.Min(0.70, topEntity.Score);
                result.Reasoning = topEntity.Description; // Sadece ürün adı
                result.Evidence.Add($"{topEntity.Description}");
                
                _logger.LogInformation($"[IDENTIFY] STRATEJI 5 seçildi: {result.ProductName}");
                return result;
            }

            // FALLBACK: Vision Labels
            var bestLabel = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .GroupBy(l => l.Description)
                .Select(g => new { Description = g.Key, Score = g.Sum(l => l.Score) })
                .OrderByDescending(g => g.Score)
                .FirstOrDefault();

            if (bestLabel != null)
            {
                result.ProductName = bestLabel.Description;
                result.Confidence = Math.Min(0.50, bestLabel.Score / 2.0);
                result.Reasoning = bestLabel.Description; // Sadece ürün adı
                result.Evidence.Add($"{result.ProductName}");
            }
            else
            {
                result.ProductName = "Bilinmeyen Ürün";
                result.Confidence = 0.0;
                result.Reasoning = "Bilinmeyen Ürün"; // Sadece durum
            }

            _logger.LogInformation($"[IDENTIFY] FALLBACK kullanıldı: {result.ProductName}");
            return result;
        }

        public ProductIdentificationResult CombineResults(ProductIdentificationResult ocrResult, ProductIdentificationResult labelsResult)
        {
            var combined = new ProductIdentificationResult
            {
                Brand = ocrResult.Brand,
                Model = ocrResult.Model,
                Confidence = (ocrResult.Confidence + labelsResult.Confidence) / 2.0,
                Evidence = ocrResult.Evidence.Concat(labelsResult.Evidence).ToList()
            };

            // ProductName: Brand + Labels kategori
            if (!string.IsNullOrEmpty(ocrResult.Brand) && !string.IsNullOrEmpty(labelsResult.ProductName))
            {
                combined.ProductName = $"{ocrResult.Brand} {labelsResult.ProductName}";
                if (!string.IsNullOrEmpty(ocrResult.Model))
                {
                    combined.ProductName += $" {ocrResult.Model}";
                }
            }
            else
            {
                combined.ProductName = ocrResult.ProductName;
            }

            combined.Reasoning = $"Combined OCR brand/model with Labels category";
            return combined;
        }

        private bool SimilarProducts(string name1, string name2)
        {
            if (string.IsNullOrEmpty(name1) || string.IsNullOrEmpty(name2)) return false;
            
            var words1 = name1.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var words2 = name2.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            
            // En az %50 kelime örtüşmesi
            var commonWords = words1.Intersect(words2).Count();
            return commonWords >= Math.Min(words1.Length, words2.Length) / 2;
        }

        // KALDIRILDI: Statik kategori bazlı çözümler (ExtractGameTitle, ExtractProductType) genel sorunlara yol açıyor
        // Bunun yerine web search sonuçlarından dinamik olarak brand+model çıkarılıyor
        // Product name sadece Brand + Model kombinasyonundan oluşuyor, ek kategori bilgisi eklenmiyor

        /// <summary>
        /// Brand+Model kombinasyonunun anlamsız olup olmadığını kontrol eder
        /// </summary>
        private bool IsMeaninglessCombination(string combination)
        {
            if (string.IsNullOrWhiteSpace(combination)) return true;
            
            var combinationUpper = combination.ToUpper().Trim();
            var words = combinationUpper.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
            
            if (words.Length < 2) return false; // Tek kelime kombinasyonu değil
            
            // TEKRARLAYAN KELİMELER: Aynı kelimeyi iki kez kullanmak anlamsızdır (örn: "MEDIA MEDIA", "BABY BABY")
            if (words.Length == 2 && words[0] == words[1])
            {
                return true;
            }
            
            // Bağlaçlar ve edatlar içeren kombinasyonlar anlamsızdır (örn: "GATEWAY INTO")
            var prepositions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "INTO", "INTO", "ONTO", "UPON", "WITHIN", "WITHOUT", "BETWEEN", "AMONG",
                "THROUGH", "DURING", "BEFORE", "AFTER", "SINCE", "UNTIL", "WHILE",
                "BECAUSE", "ALTHOUGH", "DESPITE", "REGARDING", "CONCERNING"
            };
            
            // Eğer kombinasyonda bağlaç/edat varsa anlamsızdır
            if (words.Any(w => prepositions.Contains(w)))
            {
                return true;
            }
            
            // Eğer ikinci kelime genel bir kategori ise (örn: "GATEWAY INTO" → "INTO" genel bir kelime)
            if (words.Length >= 2)
            {
                var secondWord = words[1];
                if (IsInvalidModelWord(secondWord))
                {
                    return true;
                }
            }
            
            return false;
        }

        /// <summary>
        /// Bir ürün adının diğerinden daha spesifik olup olmadığını kontrol eder
        /// </summary>
        private bool IsMoreSpecificProduct(string product1, string product2)
        {
            if (string.IsNullOrWhiteSpace(product1) || string.IsNullOrWhiteSpace(product2))
                return false;

            var product1Upper = product1.ToUpper();
            var product2Upper = product2.ToUpper();
            
            // Web Detection sonuçları genellikle daha spesifik (örn: "BMW 2002tii" vs "TONKA STEEL")
            // Brand + Model kombinasyonları genellikle daha spesifik
            
            // Eğer product1'de sayı varsa ve product2'de yoksa, product1 daha spesifik
            var product1HasNumber = System.Text.RegularExpressions.Regex.IsMatch(product1Upper, @"\d");
            var product2HasNumber = System.Text.RegularExpressions.Regex.IsMatch(product2Upper, @"\d");
            
            if (product1HasNumber && !product2HasNumber)
                return true;
            
            if (!product1HasNumber && product2HasNumber)
                return false;
            
            // Eğer product1'de marka+model kombinasyonu varsa (örn: "BMW 2002tii") ve product2'de yoksa
            // product1 daha spesifik
            var product1HasBrandModel = System.Text.RegularExpressions.Regex.IsMatch(product1Upper, @"^[A-Z]{2,}\s+[A-Z0-9]+");
            var product2HasBrandModel = System.Text.RegularExpressions.Regex.IsMatch(product2Upper, @"^[A-Z]{2,}\s+[A-Z0-9]+");
            
            if (product1HasBrandModel && !product2HasBrandModel)
                return true;
            
            if (!product1HasBrandModel && product2HasBrandModel)
                return false;
            
            // Eğer product1 daha uzunsa ve sayı içeriyorsa, daha spesifik olabilir
            if (product1Upper.Length > product2Upper.Length && product1HasNumber)
                return true;
            
            return false;
        }

        /// <summary>
        /// Model olarak kabul edilmemesi gereken genel kelimeleri kontrol eder
        /// </summary>
        private bool IsInvalidModelWord(string word)
        {
            if (string.IsNullOrWhiteSpace(word)) return true;
            
            var wordUpper = word.ToUpper().Trim();
            
            // E-ticaret ve genel kelimeler
            var invalidWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                // E-ticaret terimleri
                "DEAL", "DEALS", "SALE", "SALES", "BUY", "SELL", "SHOP", "STORE", "ONLINE",
                "OFFER", "OFFERS", "PROMO", "PROMOTION", "PROMOTIONS", "DISCOUNT", "DISCOUNTS",
                
                // Genel ürün kategorileri (model olarak kabul edilmemeli)
                "TOY", "TOYS", "ROBOT", "ROBOTS", "ACTION", "FIGURE", "FIGURES",
                "DOLL", "DOLLS", "GAME", "GAMES", "PUZZLE", "PUZZLES",
                "MACHINE", "MACHINES", "DEVICE", "DEVICES", "PRODUCT", "PRODUCTS",
                "ITEM", "ITEMS", "THING", "THINGS", "OBJECT", "OBJECTS",
                "CAMERA", "CAMERAS", "PHONE", "PHONES", "COMPUTER", "COMPUTERS",
                "WATCH", "WATCHES", "CLOCK", "CLOCKS", "TABLET", "TABLETS",
                
                // Seri adları ve ürün serileri (model olarak kabul edilmemeli)
                "STEEL", "CLASSICS", "PREMIUM", "DELUXE", "PRO", "PLUS", "ULTRA",
                "EDITION", "SERIES", "COLLECTION", "LINE", "RANGE", "SET",
                "PACK", "KIT", "BUNDLE", "COMBO", "SUITE", "SUITE",
                
                // Genel sıfatlar ve durumlar
                "NEW", "OLD", "USED", "VINTAGE", "CLASSIC", "MODERN",
                "BIG", "SMALL", "LARGE", "TINY", "HUGE", "GIANT",
                "RED", "BLUE", "GREEN", "YELLOW", "BLACK", "WHITE", "COLOR", "COLORS",
                
                // Bağlaçlar ve edatlar
                "THE", "AND", "OR", "FOR", "WITH", "FROM", "THIS", "THAT",
                "ARE", "WAS", "WERE", "IS", "BE", "BEEN", "BEING", "AM",
                "HAVE", "HAS", "HAD", "DO", "DOES", "DID", "WILL", "WOULD",
                
                // Platform ve site isimleri
                "YOUTUBE", "FACEBOOK", "INSTAGRAM", "TWITTER", "AMAZON", "EBAY",
                "WIKIPEDIA", "GOOGLE", "BING", "SEARCH", "RESULT", "RESULTS"
            };
            
            return invalidWords.Contains(wordUpper);
        }

        /// <summary>
        /// Logo Detection'dan marka bilgisini çıkar (EN GÜVENİLİR KAYNAK!)
        /// Google Vision API'nin logo detection özelliği markaları %95+ doğrulukla tespit eder
        /// </summary>
        private ProductIdentificationResult ExtractFromLogoDetection(AnalysisDataCollection data)
        {
            var result = new ProductIdentificationResult();
            
            var logos = data.VisionResults
                .SelectMany(v => v.Logos ?? new List<LogoInfo>())
                .OrderByDescending(l => l.Score)
                .ToList();

            if (!logos.Any())
            {
                return result; // Confidence 0
            }

            // En yüksek skorlu logo'yu al
            var topLogo = logos.First();
            result.Brand = topLogo.Description;
            result.ProductName = topLogo.Description;
            result.Confidence = ConfidenceCalculator.CalculateLabelsConfidence(
                topLabelScore: topLogo.Score,
                labelCount: logos.Count,
                isSpecificProduct: true // Logo her zaman spesifik marka
            );
            result.Reasoning = $"Logo Detection: {topLogo.Description} (Score: {topLogo.Score:F3})";
            result.Evidence.Add($"Logo: {topLogo.Description} ({topLogo.Score:F3})");

            _logger.LogInformation($"[LOGO] Marka logo'dan tespit edildi: {topLogo.Description} (Confidence: {result.Confidence:F3})");
            return result;
        }
    }
}

