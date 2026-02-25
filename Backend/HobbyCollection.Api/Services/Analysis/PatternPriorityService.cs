using System.Text.RegularExpressions;

namespace HobbyCollection.Api.Services.Analysis;

/// <summary>
/// Pattern'leri önceliklerine göre kategorize eden ve optimize eden servis
/// </summary>
public static class PatternPriorityService
{
    /// <summary>
    /// Pattern öncelik seviyeleri
    /// </summary>
    public enum PatternPriority
    {
        High = 1,      // En spesifik ve güvenilir pattern'ler
        Medium = 2,    // Orta spesifiklik
        Low = 3        // Genel pattern'ler (fallback)
    }

    /// <summary>
    /// Model extraction için öncelikli pattern'ler
    /// </summary>
    public static class ModelPatterns
    {
        // HIGH PRIORITY: En spesifik pattern'ler (marka özel, çok kesin)
        public static readonly (string Pattern, PatternPriority Priority)[] HighPriority = new[]
        {
            // Logitech özel pattern'leri
            (@"M\d{3}", PatternPriority.High),                    // M570, M705, M510
            (@"MX\d+", PatternPriority.High),                      // MX Master, MX518
            (@"G\d{3}", PatternPriority.High),                     // G502, G403, G305
            
            // Nintendo özel pattern'leri
            (@"GAME\s+BOY\s+(ADVANCE|COLOR|POCKET)", PatternPriority.High), // Game Boy Advance/Color/Pocket
            (@"NINTENDO\s+DS", PatternPriority.High),              // Nintendo DS
            
            // Sony özel pattern'leri
            (@"PLAYSTATION\s+\d+", PatternPriority.High),          // PlayStation 1/2/3/4/5
            (@"PSP", PatternPriority.High),                         // PSP
            
            // Kamera özel pattern'leri
            (@"OLYMPUS\s+\d{3,4}", PatternPriority.High),         // Olympus 760, M760
            (@"CANON\s+[A-Z]+\s*\d+", PatternPriority.High),      // Canon EOS 5D
            (@"NIKON\s+D\d+", PatternPriority.High),               // Nikon D3500
            
            // Steam engine özel pattern'leri
            (@"WILESCO\s+[A-Z]\d+", PatternPriority.High),         // Wilesco D16
            (@"MAMOD\s+[A-Z]\d+", PatternPriority.High),           // Mamod SA1
        };

        // MEDIUM PRIORITY: Orta spesifiklik (genel ama yararlı)
        public static readonly (string Pattern, PatternPriority Priority)[] MediumPriority = new[]
        {
            // Alphanumerik pattern'ler
            (@"[A-Z]{1,2}\d{3,4}", PatternPriority.Medium),       // M570, G502, C1084
            (@"[A-Z]{1,2}\d{2}[A-Z]?", PatternPriority.Medium),    // M90, G90
            
            // Özel formatlar
            (@"[A-Z]{2,}\-\d+", PatternPriority.Medium),           // XX-1234 formatı
            (@"\d{4}[A-Z]?", PatternPriority.Medium),               // 4 haneli model (1084, 1702A)
            
            // Marka + Model kombinasyonları
            (@"[A-Z]{4,}\s+[A-Z]\d+", PatternPriority.Medium),     // Brand Model formatı
        };

        // LOW PRIORITY: Genel pattern'ler (fallback)
        public static readonly (string Pattern, PatternPriority Priority)[] LowPriority = new[]
        {
            (@"MODEL\s+[A-Z0-9\-]+", PatternPriority.Low),         // MODEL xxx formatı
            (@"TYPE\s+[A-Z0-9\-]+", PatternPriority.Low),           // TYPE xxx formatı
            (@"CD\d+", PatternPriority.Low),                         // CD formatı
            (@"BP\d+", PatternPriority.Low),                         // BP serisi
        };
    }

    /// <summary>
    /// Brand extraction için öncelikli pattern'ler
    /// </summary>
    public static class BrandPatterns
    {
        // HIGH PRIORITY: Bilinen marka isimleri (database'den)
        public static readonly (string Pattern, PatternPriority Priority)[] HighPriority = new[]
        {
            // Büyük markalar (çok yaygın)
            (@"\bNINTENDO\b", PatternPriority.High),
            (@"\bSONY\b", PatternPriority.High),
            (@"\bMICROSOFT\b", PatternPriority.High),
            (@"\bAPPLE\b", PatternPriority.High),
            (@"\bSAMSUNG\b", PatternPriority.High),
            (@"\bLOGITECH\b", PatternPriority.High),
            (@"\bCANON\b", PatternPriority.High),
            (@"\bNIKON\b", PatternPriority.High),
            (@"\bOLYMPUS\b", PatternPriority.High),
        };

        // MEDIUM PRIORITY: Orta yaygınlıkta markalar
        public static readonly (string Pattern, PatternPriority Priority)[] MediumPriority = new[]
        {
            // Genel marka pattern'i (büyük harfle başlayan, 2-20 karakter)
            (@"\b[A-Z][A-Z0-9]{1,19}\b", PatternPriority.Medium),
        };
    }

    /// <summary>
    /// Tüm model pattern'lerini öncelik sırasına göre döndürür
    /// </summary>
    public static IEnumerable<(string Pattern, PatternPriority Priority)> GetAllModelPatterns()
    {
        foreach (var pattern in ModelPatterns.HighPriority)
            yield return pattern;
        
        foreach (var pattern in ModelPatterns.MediumPriority)
            yield return pattern;
        
        foreach (var pattern in ModelPatterns.LowPriority)
            yield return pattern;
    }

    /// <summary>
    /// Tüm brand pattern'lerini öncelik sırasına göre döndürür
    /// </summary>
    public static IEnumerable<(string Pattern, PatternPriority Priority)> GetAllBrandPatterns()
    {
        foreach (var pattern in BrandPatterns.HighPriority)
            yield return pattern;
        
        foreach (var pattern in BrandPatterns.MediumPriority)
            yield return pattern;
    }

    /// <summary>
    /// Pattern'i text'te ara ve sonuçları öncelik sırasına göre döndürür
    /// </summary>
    public static List<(string Match, PatternPriority Priority)> FindMatches(
        string text, 
        IEnumerable<(string Pattern, PatternPriority Priority)> patterns,
        bool caseInsensitive = true)
    {
        var results = new List<(string Match, PatternPriority Priority)>();
        var regexOptions = caseInsensitive ? RegexOptions.IgnoreCase : RegexOptions.None;

        foreach (var (pattern, priority) in patterns)
        {
            try
            {
                var matches = Regex.Matches(text, pattern, regexOptions);
                foreach (Match match in matches)
                {
                    var value = match.Value.Trim();
                    if (!string.IsNullOrEmpty(value))
                    {
                        results.Add((value, priority));
                    }
                }
            }
            catch
            {
                // Geçersiz pattern'leri atla
                continue;
            }
        }

        // Önceliğe göre sırala (High -> Medium -> Low)
        return results
            .OrderBy(r => r.Priority)
            .ThenByDescending(r => r.Match.Length) // Aynı öncelikte uzun olanlar önce
            .ToList();
    }
}

