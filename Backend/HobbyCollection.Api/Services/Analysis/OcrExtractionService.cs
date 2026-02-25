using System.Text.RegularExpressions;
using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis
{
    public class OcrExtractionService : IOcrExtractionService
    {
        private readonly ILogger<OcrExtractionService> _logger;

        public OcrExtractionService(ILogger<OcrExtractionService> logger)
        {
            _logger = logger;
        }

        public List<string> ExtractPotentialBrands(string ocrText)
        {
            // OCR düzeltme - yaygın yanlış okumaları düzelt
            var correctedText = ocrText;
            
            // Logitech yanlış okumaları
            if (ocrText.Contains("LOGITED") || ocrText.Contains("LOGITEC") || ocrText.Contains("LOGITECH"))
            {
                correctedText = correctedText.Replace("LOGITED", "LOGITECH").Replace("LOGITEC", "LOGITECH");
                _logger.LogInformation($"[OCR CORRECTION] Logitech düzeltildi: {ocrText} → {correctedText}");
            }
            
            var brands = new List<string> 
            { 
                // Modern markalar
                "INTEL", "AMD", "NVIDIA", "APPLE", "SAMSUNG", "SONY", "CANON", "NIKON", "PANASONIC", "LG", "BOSE", "JBL", "SONOS",
                // Bilgisayar çevre birimleri
                "LOGITECH", "MICROSOFT", "RAZER", "CORSAIR", "STEELSERIES", "HP", "DELL", "ASUS", "ACER", "LENOVO",
                // Vintage bilgisayar markaları
                "COMMODORE", "AMIGA", "ATARI", "SINCLAIR", "AMSTRAD", "MSX", "IBM", "COMPAQ", "TANDY", "RADIO SHACK",
                // Vintage oyun konsolları
                "NINTENDO", "SEGA", "PLAYSTATION", "XBOX", "GAMEBOY", "NES", "SNES", "MEGADRIVE", "GENESIS",
                // Vintage elektronik
                "PHILIPS", "GRUNDIG", "TELEFUNKEN", "SANYO", "AIWA", "TECHNICS", "PIONEER", "KENWOOD", "YAMAHA",
                "SHARP", "CASIO", "SEIKO", "CITIZEN", "TIMEX",
                // Kamera markaları
                "LEICA", "PENTAX", "OLYMPUS", "FUJIFILM", "MINOLTA", "KODAK", "POLAROID",
                // Diğer
                "ROLEX", "OMEGA", "TAG HEUER", "BREITLING", "TISSOT"
            };
            
            var foundBrands = new List<string>();
            
            // Düzeltilmiş metin ile tam eşleşme (boşluklu)
            foreach (var brand in brands)
            {
                if (correctedText.Contains(brand))
                {
                    foundBrands.Add(brand);
                    _logger.LogInformation($"[OCR BRAND] Tam eşleşme bulundu: {brand}");
                }
            }
            
            // Boşluksuz eşleşme için fuzzy matching (örn: "AMIGACD" → "AMIGA")
            if (!foundBrands.Any())
            {
                foreach (var brand in brands)
                {
                    // Markanın kelimeler arasında veya başka kelimeyle birleşik olması
                    var pattern = $@"\b{brand}[A-Z0-9]*\b";
                    if (Regex.IsMatch(ocrText, pattern, RegexOptions.IgnoreCase))
                    {
                        foundBrands.Add(brand);
                        _logger.LogInformation($"[OCR BRAND] Fuzzy eşleşme bulundu: {brand} (pattern: {pattern})");
                    }
                }
            }
            
            // Hala bulunamadıysa, substring içinde ara (örn: "COMMODORE" içinde "AMIGA" varsa)
            if (!foundBrands.Any())
            {
                var words = ocrText.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var word in words)
                {
                    foreach (var brand in brands)
                    {
                        if (word.Contains(brand) && word.Length <= brand.Length + 5) // Max 5 karakter fazla
                        {
                            foundBrands.Add(brand);
                            _logger.LogInformation($"[OCR BRAND] Substring eşleşme bulundu: {brand} (kelime: {word})");
                        }
                    }
                }
            }
            
            return foundBrands.Distinct().ToList();
        }

        public List<string> ExtractPotentialModels(string ocrText)
        {
            var models = new List<string>();

            // ÖNCELİK 1: Marka özel pattern'leri (en spesifik)
            var brandSpecificPatterns = new[] 
            { 
                // Logitech özel pattern'leri
                @"M\d{3}",                         // Logitech M570, M705, M510 (ÖNCE - en spesifik)
                @"M\d{2,4}",                       // Logitech M90, M100, M1000
                @"MX\d+",                          // Logitech MX Master, MX518
                @"G\d{3}",                         // Logitech G502, G403, G305
                @"G\d{2,4}",                       // Logitech G90, G100, G1000
                
                // Polaroid özel pattern'leri
                @"SUPERCOLOR\s+\d{3,4}",           // Polaroid Supercolor 635
                @"SUPERCOLOR\s*\d{3,4}",           // Polaroid Supercolor635
                @"LM\s+PROGRAM",                   // Polaroid LM PROGRAM
                @"\d{3,4}\s+CL",                   // Polaroid 635 CL
            };
            
            foreach (var pattern in brandSpecificPatterns)
            {
                var matches = Regex.Matches(ocrText, pattern, RegexOptions.IgnoreCase);
                foreach (Match match in matches)
                {
                    var modelValue = match.Value.ToUpper().Trim();
                    if (modelValue.Length >= 2 && !IsCommonWord(modelValue))
                    {
                        models.Add(modelValue);
                        _logger.LogInformation($"[OCR MODEL] Marka özel pattern eşleşmesi: {modelValue} (pattern: {pattern})");
                    }
                }
            }

            // ÖNCELİK 2: Genel model pattern'ları (numaralar, harfler, kodlar)
            var generalPatterns = new[] 
            { 
                // Saat özel pattern'leri (en spesifik)
                @"[A-Z]{2,3}-\d{3,4}",             // Casio AT-552, AQ-230A, Seiko SKX-007
                @"[A-Z]{2,3}\s+\d{3,4}",            // Casio AT 552 (boşluklu) - ANCAK "LM PROGRAM" gibi kelimeleri filtrele
                @"[A-Z]{1,2}\d{3,4}[A-Z]?",        // Casio AQ230A, Seiko SKX007
                
                // Ürün adı + model numarası (Supercolor 635, Colorburst 300)
                @"[A-Z][a-z]{4,15}\s+\d{3,4}",     // Supercolor 635, Colorburst 300
                
                // Genel pattern'ler
                @"[A-Z]{1,2}\d{3,4}",             // Alphanumerik 3-4 haneli (örn: M570, G502, C1084)
                @"[A-Z]{1,2}\d{2}[A-Z]?",          // Alphanumerik 2 haneli + opsiyonel harf (örn: M90, G90)
                @"COLORBURST\s*\d+",               // Kodak Colorburst 300
                @"INSTANT\s+CAMERA",               // Instant Camera
                @"CD\d+",                          // CD formatı (örn: CD32, CD3)
                @"BP\d+",                          // Intel BP serisi
                @"CORE\s*I\d+",                    // Intel Core i3/i5/i7
                @"FIELD\s*CAMERA",                 // Field Camera
                @"PENTIUM", @"CELERON",            // Intel işlemciler
                @"\d{4}[A-Z]?",                    // 4 haneli model (örn: 1084, 1702A)
                @"[A-Z]{2,}\-\d+",                 // XX-1234 formatı
                @"MODEL\s*[A-Z0-9\-]+",            // MODEL xxx formatı
                @"TYPE\s*[A-Z0-9\-]+",             // TYPE xxx formatı
            };
            
            foreach (var pattern in generalPatterns)
            {
                var matches = Regex.Matches(ocrText, pattern, RegexOptions.IgnoreCase);
                foreach (Match match in matches)
                {
                    var modelValue = match.Value.ToUpper().Trim();
                    
                    // "LM PROGRAM" gibi kelimeleri filtrele (sadece harf+sayı kombinasyonları değil)
                    if (pattern.Contains(@"\s+\d") && modelValue.Contains("PROGRAM"))
                    {
                        _logger.LogInformation($"[OCR MODEL] 'PROGRAM' içeren değer filtrelendi: {modelValue}");
                        continue;
                    }
                    
                    // Çok kısa veya çok yaygın değerleri filtrele
                    if (modelValue.Length >= 2 && !IsCommonWord(modelValue) && !models.Contains(modelValue))
                    {
                        models.Add(modelValue);
                        _logger.LogInformation($"[OCR MODEL] Genel pattern eşleşmesi: {modelValue} (pattern: {pattern})");
                    }
                }
            }

            // ÖNCELİK 3: 2-3 haneli sayılar (sadece brand varsa ve başka model yoksa)
            // ANCAK: Lens specs'i filtrele (örn: "23.4-5.7", "5-19.5mm", "76.5-1" gibi)
            // ANCAK: Telefon tuşu numaralarını filtrele (0-9, 10-99)
            if (!models.Any())
            {
                var numberPattern = @"\b\d{2,3}\b";
                var numberMatches = Regex.Matches(ocrText, numberPattern);
                foreach (Match match in numberMatches)
                {
                    var modelValue = match.Value.Trim();
                    var matchIndex = match.Index;
                    var matchLength = match.Length;
                    
                    // Lens specs pattern'lerini kontrol et (örn: "23.4", "19.5mm", "76.5")
                    var contextBefore = matchIndex > 0 ? ocrText.Substring(Math.Max(0, matchIndex - 5), Math.Min(5, matchIndex)) : "";
                    var contextAfter = matchIndex + matchLength < ocrText.Length ? ocrText.Substring(matchIndex + matchLength, Math.Min(5, ocrText.Length - matchIndex - matchLength)) : "";
                    
                    // Lens specs pattern'leri: "23.4", "19.5mm", "76.5-1", "5-19.5mm" gibi
                    var isLensSpec = Regex.IsMatch(contextBefore + modelValue + contextAfter, @"[\d\.]+\-[\d\.]+|[\d\.]+mm|[\d\.]+x|zoom|focal|aperture", RegexOptions.IgnoreCase);
                    
                    // Telefon tuşu numaralarını filtrele (0-99 arası sayılar telefon tuşu olabilir)
                    // Eğer OCR metninde "phone", "telephone", "dial", "keypad" gibi kelimeler varsa ve sayı 0-99 arasındaysa, telefon tuşu olabilir
                    var isPhoneContext = Regex.IsMatch(ocrText, @"phone|telephone|dial|keypad|button|digit", RegexOptions.IgnoreCase);
                    var isPhoneKeypadNumber = isPhoneContext && int.TryParse(modelValue, out int numValue) && numValue >= 0 && numValue <= 99;
                    
                    // Çok yaygın sayıları filtrele (10, 20, 30, 50, 100 gibi)
                    // Lens specs'i filtrele
                    // Yılları filtrele (1900-2025 arası)
                    // Telefon tuşu numaralarını filtrele
                    var isYear = IsYear(modelValue);
                    if (!IsCommonNumber(modelValue) && !isLensSpec && !isYear && !isPhoneKeypadNumber && !models.Contains(modelValue))
                    {
                        models.Add(modelValue);
                        _logger.LogInformation($"[OCR MODEL] Sayı pattern eşleşmesi: {modelValue}");
                    }
                    else if (isLensSpec)
                    {
                        _logger.LogInformation($"[OCR MODEL] Lens spec filtrelendi: {modelValue} (context: {contextBefore}...{contextAfter})");
                    }
                    else if (isPhoneKeypadNumber)
                    {
                        _logger.LogInformation($"[OCR MODEL] Telefon tuşu numarası filtrelendi: {modelValue} (telefon context'i tespit edildi)");
                    }
                }
            }

            var distinctModels = models.Distinct().ToList();
            
            if (distinctModels.Any())
            {
                _logger.LogInformation($"[OCR MODEL] Toplam {distinctModels.Count} model bulundu: {string.Join(", ", distinctModels)}");
            }
            else
            {
                _logger.LogInformation($"[OCR MODEL] Hiç model bulunamadı. OCR metni: '{ocrText.Substring(0, Math.Min(100, ocrText.Length))}'");
            }

            return distinctModels;
        }

        public List<string> ExtractProductTypes(string ocrText)
        {
            var types = new List<string>();
            var productKeywords = new Dictionary<string, string[]>
            {
                { "INSTANT CAMERA", new[] { "INSTANT CAMERA", "INSTANT CAM" } },
                { "CAMERA", new[] { "CAMERA", "CAM" } },
                { "GAME BOY", new[] { "GAME BOY", "GAMEBOY" } },
                { "GAME CONSOLE", new[] { "GAME CONSOLE", "CONSOLE" } },
                { "WATCH", new[] { "WATCH", "WRISTWATCH", "TIMEPIECE" } },
                { "BOOK", new[] { "BOOK", "NOVEL" } },
                { "TOY CAR", new[] { "TOY CAR", "MODEL CAR" } },
                { "DOLL", new[] { "DOLL", "ACTION FIGURE" } },
                { "STAMP", new[] { "STAMP", "POSTAGE" } },
                { "COIN", new[] { "COIN", "MEDAL" } },
                { "VINYL", new[] { "VINYL", "RECORD", "LP" } },
                { "CASSETTE", new[] { "CASSETTE", "TAPE" } }
            };

            foreach (var kvp in productKeywords)
            {
                if (kvp.Value.Any(keyword => ocrText.Contains(keyword)))
                {
                    types.Add(kvp.Key);
                }
            }

            return types.Distinct().ToList();
        }

        public ProductIdentificationResult ExtractProductFromOCR(AnalysisDataCollection data)
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

            if (string.IsNullOrWhiteSpace(data.OcrText))
            {
                _logger.LogWarning("[OCR EXTRACT] OCR metni boş");
                return result;
            }

            var ocrText = data.OcrText.ToUpper();
            _logger.LogInformation($"[OCR EXTRACT] OCR metni: {data.OcrText.Substring(0, Math.Min(100, data.OcrText.Length))}");

            // Brand detection (common brands)
            var brands = ExtractPotentialBrands(ocrText);
            _logger.LogInformation($"[OCR EXTRACT] Bulunan brand'ler: {string.Join(", ", brands)}");

            // Model detection (alphanumeric codes, model names)
            var models = ExtractPotentialModels(ocrText);
            _logger.LogInformation($"[OCR EXTRACT] Bulunan modeller: {string.Join(", ", models)}");

            // Product type detection (CAMERA, GAME BOY, WATCH, etc.)
            var productTypes = ExtractProductTypes(ocrText);
            _logger.LogInformation($"[OCR EXTRACT] Ürün tipleri: {string.Join(", ", productTypes)}");

            // STRATEGY 1: Brand + Product Type + Model (BEST)
            if (brands.Any() && productTypes.Any())
            {
                result.Brand = brands.First();
                var productType = productTypes.First();
                
                if (models.Any())
                {
                    result.Model = string.Join(" ", models.Take(2));
                    result.ProductName = $"{result.Brand} {productType} {result.Model}";
                    result.Confidence = ConfidenceCalculator.CalculateOcrConfidence(
                        hasBrand: true, 
                        hasModel: true, 
                        ocrLength: data.OcrText.Length,
                        brandCount: brands.Count,
                        modelCount: models.Count
                    );
                }
                else
                {
                    result.ProductName = $"{result.Brand} {productType}";
                    result.Confidence = ConfidenceCalculator.CalculateOcrConfidence(
                        hasBrand: true, 
                        hasModel: false, 
                        ocrLength: data.OcrText.Length,
                        brandCount: brands.Count
                    );
                }
                
                result.Reasoning = "OCR: Brand + Product Type + Model";
                result.Evidence.Add($"Brand: {result.Brand}");
                result.Evidence.Add($"Type: {productType}");
                if (models.Any()) result.Evidence.Add($"Model: {result.Model}");
                
                _logger.LogInformation($"[OCR EXTRACT] Strategy 1: {result.ProductName} (Confidence: {result.Confidence:F3})");
                return result;
            }

            // STRATEGY 2: Brand + Model (NO PRODUCT TYPE)
            if (brands.Any() && models.Any())
            {
                result.Brand = brands.First();
                result.Model = string.Join(" ", models.Take(2));
                result.ProductName = $"{result.Brand} {result.Model}";
                result.Confidence = ConfidenceCalculator.CalculateOcrConfidence(
                    hasBrand: true, 
                    hasModel: true, 
                    ocrLength: data.OcrText.Length,
                    brandCount: brands.Count,
                    modelCount: models.Count
                );
                result.Reasoning = "OCR: Brand + Model";
                result.Evidence.Add($"Brand: {result.Brand}");
                result.Evidence.Add($"Model: {result.Model}");
                
                _logger.LogInformation($"[OCR EXTRACT] Strategy 2: {result.ProductName} (Confidence: {result.Confidence:F3})");
                return result;
            }

            // STRATEGY 3: Only Brand
            if (brands.Any())
            {
                result.Brand = brands.First();
                result.ProductName = result.Brand;
                result.Confidence = ConfidenceCalculator.CalculateOcrConfidence(
                    hasBrand: true, 
                    hasModel: false, 
                    ocrLength: data.OcrText.Length,
                    brandCount: brands.Count
                );
                result.Reasoning = "OCR: Brand only";
                result.Evidence.Add($"Brand: {result.Brand}");
                
                _logger.LogInformation($"[OCR EXTRACT] Strategy 3: {result.ProductName} (Confidence: {result.Confidence:F3})");
                return result;
            }

            // STRATEGY 4: Only Product Type
            if (productTypes.Any())
            {
                result.ProductName = productTypes.First();
                result.Confidence = ConfidenceCalculator.CalculateOcrConfidence(
                    hasBrand: false, 
                    hasModel: false, 
                    ocrLength: data.OcrText.Length
                );
                result.Reasoning = "OCR: Product type only";
                result.Evidence.Add($"Type: {result.ProductName}");
                
                _logger.LogInformation($"[OCR EXTRACT] Strategy 4: {result.ProductName} (Confidence: {result.Confidence:F3})");
                return result;
            }

            _logger.LogWarning("[OCR EXTRACT] OCR'dan ürün çıkarılamadı");
            return result;
        }

        private bool IsCommonWord(string word)
        {
            // Yaygın kelimeler (model olarak yorumlanmamalı)
            var commonWords = new[] { "BIT", "THE", "AND", "FOR", "WITH", "FROM", "THIS", "THAT" };
            return commonWords.Contains(word);
        }

        private bool IsCommonNumber(string number)
        {
            // Yaygın sayılar (model olarak yorumlanmamalı)
            var commonNumbers = new[] { "10", "20", "30", "40", "50", "60", "70", "80", "90", "100", "200", "300", "500", "1000" };
            
            // Saat göstergesi sayıları (1-12) - model olamaz
            if (int.TryParse(number, out int numValue) && numValue >= 1 && numValue <= 12)
            {
                return true;
            }
            
            return commonNumbers.Contains(number);
        }

        private bool IsYear(string text)
        {
            // 4 haneli sayıları kontrol et (1900-2025 arası yıllar)
            if (text.Length == 4 && int.TryParse(text, out int year))
            {
                return year >= 1900 && year <= DateTime.Now.Year + 1; // +1 gelecek yıl için tolerans
            }
            return false;
        }
    }
}

