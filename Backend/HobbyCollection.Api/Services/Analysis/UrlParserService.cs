using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis
{
    public class UrlParserService : IUrlParserService
    {
        private readonly ILogger<UrlParserService> _logger;

        public UrlParserService(ILogger<UrlParserService> logger)
        {
            _logger = logger;
        }

        public bool IsMeaninglessTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title))
                return true;
            
            var titleUpper = title.ToUpper();
            var words = title.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
            
            // Çok kısa title'lar anlamsızdır
            if (title.Length < 4)
                return true;
            
            // Domain isimleri anlamsızdır (ürün adı değil!)
            var domainNames = new[] { "TIKTOK", "EBAYIMG", "EBAY", "NONIQ", "INSTRUCTABLES", "KLEINANZEIGEN", 
                "UNI-BIELEFELD", "SEILNACHT", "ELS-CDN", "ARS", "CONTENT", "IMG", "API", "CDN" };
            if (words.Any(w => domainNames.Contains(w.ToUpper())))
                return true;
            
            // Tek kelime domain isimleri anlamsızdır
            if (words.Length == 1 && domainNames.Contains(titleUpper))
                return true;
            
            // Hash/UUID pattern'leri içeriyorsa anlamsızdır
            if (Regex.IsMatch(titleUpper, @"[A-Z0-9]{8,}")) // Hash'ler
                return true;
            
            if (Regex.IsMatch(titleUpper, @"[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}")) // UUID'ler
                return true;
            
            // Random kodlar içeriyorsa anlamsızdır ("F1O", "TK4E", "ND0AAESWEHPOSJ~S" gibi)
            if (words.Any(w => Regex.IsMatch(w, @"^[A-Z]{1,2}\d+[A-Z]{0,2}$") || Regex.IsMatch(w, @"^[A-Z0-9]{6,}$")))
                return true;
            
            // Anlamsız kelimeler içeriyorsa
            var meaninglessWords = new[] { "API", "IMG", "UUID", "V1", "V2", "PROD", "ADS", "ID", "ITEMID", "LOCATION", "AID", "INDEX", "FRAME", "RULE", "AUTO", "WEBP", "CONTENT", "IMAGE", "S2", "GR3", "NANO", "NANORAS2", "0027", "L1200", "L300", "TK4E", "F1O", "F1R", "MN1W", "ND0AAESWEHPOSJ~S", "OQCA AESWBEXP E12K", "ELS-CDN", "68E91B35", "85BF143C", "B232", "406E", "3B9D425D32E3", "DC9202D6", "464C", "D9B19C661EC7" };
            if (words.Any(w => meaninglessWords.Contains(w.ToUpper())))
                return true;
            
            // Tüm kelimeler çok kısaysa anlamsızdır
            if (words.All(w => w.Length <= 3))
                return true;
            
            // Tüm kelimeler sadece büyük harf ve sayı içeriyorsa anlamsızdır
            if (words.All(w => Regex.IsMatch(w, @"^[A-Z0-9]+$") && !w.Any(char.IsLower)))
                return true;
            
            return false;
        }

        public string? ExtractProductNameFromUrl(string url, string domain, string path)
        {
            try
            {
                // URL path'inden ürün adı çıkarmaya çalış
                // Örnekler:
                // "/wilesco-d16-toy-steam-engine" → "Wilesco D16 Toy Steam Engine"
                // "/polaroid-lightmixer-630" → "Polaroid Lightmixer 630"
                // "/images/product/wilesco_d16.jpg" → "Wilesco D16"
                
                // Filtrelenecek kelimeler (hash'ler, UUID'ler, random kodlar)
                var filterWords = new[] { "images", "product", "api", "v1", "v2", "img", "uuid", "id", 
                    "jpg", "png", "webp", "jpeg", "gif", "svg", "auto", "webp", "frame", "rule",
                    "content", "api", "prod-ads", "prod", "ads", "itemid", "location", "aid", "index",
                    "images", "0027", "content", "image", "s2", "s2772369021000128", "gr3", "nano", "nanoras2",
                    "tk4e", "f1o", "f1r", "mn1w", "nd0aaeswehposj", "oqc", "aeswbexpe12k", "els", "cdn",
                    "68e91b35", "85bf143c", "b232", "406e", "3b9d425d32e3", "dc9202d6", "464c", "d9b19c661ec7",
                    "l1200", "l300", "vakuumpumpe" };
                
                // Hash/UUID pattern'leri (örn: "F1OTK4EMEBUV63Z", "85bf143c-b232-406e-9649-3b9d425d32e3")
                var hashPattern = @"^[A-Z0-9]{6,}$"; // 6+ karakter, sadece büyük harf ve sayı
                var uuidPattern = @"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
                var randomCodePattern = @"^[A-Z]{1,2}\d+[A-Z]{0,2}\d*$"; // "F1O", "TK4E", "F1OTK4E" gibi
                
                var pathParts = path.Split(new[] { '/', '-', '_', '.', '?', '&', '=', '~' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(p => p.Length >= 4 && p.Length <= 30) // 4-30 karakter arası (daha uzun kelimeler daha anlamlı)
                    .Where(p => !filterWords.Contains(p.ToLower()) &&
                               !Regex.IsMatch(p, hashPattern, RegexOptions.IgnoreCase) && // Hash'leri filtrele
                               !Regex.IsMatch(p, uuidPattern, RegexOptions.IgnoreCase) && // UUID'leri filtrele
                               !Regex.IsMatch(p, randomCodePattern, RegexOptions.IgnoreCase) && // Random kodları filtrele
                               !Regex.IsMatch(p, @"^\d+$") && // Sadece sayı olanları filtrele
                               !Regex.IsMatch(p, @"^[A-Z]{1,2}\d+$", RegexOptions.IgnoreCase) && // "F1O", "TK4E" gibi kodları filtrele
                               !p.Contains("$") && // "$_59.AUTO" gibi parametreleri filtrele
                               !p.All(char.IsDigit) && // Sadece sayı olanları filtrele
                               p.Any(char.IsLetter) && // En az bir harf içermeli
                               p.Any(char.IsLower)) // En az bir küçük harf içermeli (büyük harfler genelde kod)
                    .Take(5) // İlk 5 anlamlı kelimeyi al
                    .ToList();
                
                if (pathParts.Any())
                {
                    // Her kelimeyi capitalize et ve birleştir
                    var title = string.Join(" ", pathParts.Select(p => 
                    {
                        // İlk harfi büyük yap, geri kalanını küçük yap
                        if (p.Length > 0)
                        {
                            return char.ToUpper(p[0]) + (p.Length > 1 ? p.Substring(1).ToLower() : "");
                        }
                        return p;
                    }));
                    
                    // Eğer title çok uzunsa kısalt
                    if (title.Length > 80)
                    {
                        title = title.Substring(0, 80) + "...";
                    }
                    
                    // Eğer title hala anlamsız görünüyorsa, domain'i kullan
                    if (IsMeaninglessTitle(title))
                    {
                        // Anlamsız görünüyor, domain'i kullan
                        var domainParts = domain.Split('.');
                        if (domainParts.Length >= 2)
                        {
                            var mainDomain = domainParts[domainParts.Length - 2];
                            if (mainDomain.Length >= 4 && !IsMeaninglessTitle(mainDomain))
                            {
                                return char.ToUpper(mainDomain[0]) + (mainDomain.Length > 1 ? mainDomain.Substring(1) : "");
                            }
                        }
                        return null; // Anlamsız, null döndür (eklenmeyecek)
                    }
                    
                    return title;
                }
                
                // Path'den çıkarılamadıysa domain'i kullan (ama sadece anlamlısa)
                var domainParts2 = domain.Split('.');
                if (domainParts2.Length >= 2)
                {
                    var mainDomain = domainParts2[domainParts2.Length - 2]; // "wilesco" from "wilesco.com"
                    if (mainDomain.Length >= 4 && !IsMeaninglessTitle(mainDomain))
                    {
                        return char.ToUpper(mainDomain[0]) + (mainDomain.Length > 1 ? mainDomain.Substring(1) : "");
                    }
                }
                
                return null; // Anlamsız, null döndür (eklenmeyecek)
            }
            catch
            {
                return null; // Hata durumunda null döndür (eklenmeyecek)
            }
        }

        public string ExtractProductNameFromText(string text)
        {
            // Basit text extraction
            var lines = text.Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
            return lines.FirstOrDefault() ?? "Bilinmeyen Ürün";
        }
    }
}

