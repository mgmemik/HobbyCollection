using System.Text;
using System.Text.RegularExpressions;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Username yönetimi ve slug üretimi servisi
/// </summary>
public class UsernameService
{
    private readonly AppDbContext _db;
    private readonly ILogger<UsernameService> _logger;
    
    // Reserved usernames (sistem kullanımı için ayrılmış)
    private static readonly HashSet<string> ReservedUsernames = new(StringComparer.OrdinalIgnoreCase)
    {
        "admin", "api", "app", "help", "support", "about", "terms", "privacy",
        "login", "register", "signin", "signup", "logout", "settings", "profile",
        "user", "users", "account", "dashboard", "home", "index", "search",
        "explore", "discover", "trending", "popular", "new", "notifications",
        "messages", "inbox", "following", "followers", "saved", "bookmarks",
        "categories", "category", "products", "product", "collection", "collections",
        "report", "reports", "analytics", "stats", "statistics", "legal",
        "contact", "feedback", "faq", "docs", "documentation", "blog", "news",
        "download", "downloads", "upload", "uploads", "file", "files", "image", "images",
        "video", "videos", "static", "assets", "public", "private", "internal",
        "system", "root", "null", "undefined", "test", "demo", "example", "sample",
        "web", "mobile", "ios", "android", "www", "mail", "email", "smtp", "ftp",
        "http", "https", "ssl", "tls", "cdn", "dns", "ip", "localhost",
        "saveall", "save-all", "save_all", "hobbycollection", "hobby-collection"
    };

    public UsernameService(AppDbContext db, ILogger<UsernameService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Email'den username slug üretir ve unique olmasını sağlar
    /// </summary>
    public async Task<string> GenerateUsernameFromEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email cannot be empty", nameof(email));
        }

        // Email'in @ öncesi kısmını al
        var localPart = email.Split('@')[0];
        
        // Slug'a çevir
        var baseSlug = CreateSlugFromText(localPart);
        
        // Reserved kontrolü
        if (ReservedUsernames.Contains(baseSlug))
        {
            baseSlug = $"user_{baseSlug}";
        }
        
        // Unique hale getir
        var uniqueSlug = await EnsureUniqueUsernameAsync(baseSlug);
        
        _logger.LogInformation("Generated username '{Username}' from email '{Email}'", uniqueSlug, email);
        
        return uniqueSlug;
    }

    /// <summary>
    /// Text'i username slug'a çevirir (küçük harf, alt çizgi, rakam)
    /// </summary>
    private string CreateSlugFromText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "user";
        }

        // Küçük harfe çevir
        var slug = text.ToLowerInvariant();
        
        // Türkçe karakterleri değiştir
        slug = slug.Replace('ı', 'i')
                   .Replace('ğ', 'g')
                   .Replace('ü', 'u')
                   .Replace('ş', 's')
                   .Replace('ö', 'o')
                   .Replace('ç', 'c')
                   .Replace('İ', 'i')
                   .Replace('Ğ', 'g')
                   .Replace('Ü', 'u')
                   .Replace('Ş', 's')
                   .Replace('Ö', 'o')
                   .Replace('Ç', 'c');
        
        // Özel karakterleri kaldır, sadece harf, rakam, alt çizgi ve tire
        slug = Regex.Replace(slug, @"[^a-z0-9_\-]", "_");
        
        // Birden fazla alt çizgi veya tireyi teke indir
        slug = Regex.Replace(slug, @"[_\-]+", "_");
        
        // Baştaki ve sondaki alt çizgi/tireleri kaldır
        slug = slug.Trim('_', '-');
        
        // Boş kalırsa default
        if (string.IsNullOrWhiteSpace(slug))
        {
            slug = "user";
        }
        
        // Çok uzunsa kısalt (max 30 karakter)
        if (slug.Length > 30)
        {
            slug = slug.Substring(0, 30).TrimEnd('_', '-');
        }
        
        // Çok kısaysa (min 3 karakter)
        if (slug.Length < 3)
        {
            slug = slug.PadRight(3, '_');
        }
        
        return slug;
    }

    /// <summary>
    /// Username'in unique olmasını sağlar (varsa sonuna 2, 3, 4... ekler)
    /// </summary>
    public async Task<string> EnsureUniqueUsernameAsync(string baseUsername)
    {
        var username = baseUsername;
        var counter = 2;
        
        // Username'in veritabanında olup olmadığını kontrol et
        while (await IsUsernameTakenAsync(username))
        {
            username = $"{baseUsername}{counter}";
            counter++;
            
            // Sonsuz döngüyü önle (max 9999)
            if (counter > 9999)
            {
                // Rastgele bir suffix ekle
                var random = new Random();
                username = $"{baseUsername}_{random.Next(1000, 9999)}";
                break;
            }
        }
        
        return username;
    }

    /// <summary>
    /// Username'in alınmış olup olmadığını kontrol eder
    /// </summary>
    public async Task<bool> IsUsernameTakenAsync(string username, string? excludeUserId = null)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return true;
        }

        var query = _db.Users.Where(u => u.UserName == username);
        
        if (!string.IsNullOrEmpty(excludeUserId))
        {
            query = query.Where(u => u.Id != excludeUserId);
        }
        
        return await query.AnyAsync();
    }

    /// <summary>
    /// Username validasyonu yapar
    /// </summary>
    public (bool IsValid, string? ErrorMessage) ValidateUsername(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return (false, "Username cannot be empty");
        }

        // Uzunluk kontrolü
        if (username.Length < 3)
        {
            return (false, "Username must be at least 3 characters long");
        }

        if (username.Length > 30)
        {
            return (false, "Username must be at most 30 characters long");
        }

        // Karakter kontrolü (sadece küçük harf, rakam, alt çizgi)
        if (!Regex.IsMatch(username, @"^[a-z0-9_]+$"))
        {
            return (false, "Username can only contain lowercase letters, numbers, and underscores");
        }

        // Başlangıç ve bitiş kontrolü (rakam veya alt çizgi ile başlayamaz/bitemez)
        if (username.StartsWith("_") || username.EndsWith("_") || 
            char.IsDigit(username[0]))
        {
            return (false, "Username cannot start with a number or underscore, and cannot end with underscore");
        }

        // Reserved kontrolü
        if (ReservedUsernames.Contains(username))
        {
            return (false, "This username is reserved and cannot be used");
        }

        return (true, null);
    }

    /// <summary>
    /// Kullanıcının username'ini değiştirir
    /// </summary>
    public async Task<(bool Success, string? ErrorMessage)> ChangeUsernameAsync(
        string userId, 
        string newUsername)
    {
        // Validasyon
        var (isValid, errorMessage) = ValidateUsername(newUsername);
        if (!isValid)
        {
            return (false, errorMessage);
        }

        // Kullanıcıyı bul
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return (false, "User not found");
        }

        // Username alınmış mı kontrol et
        if (await IsUsernameTakenAsync(newUsername, userId))
        {
            return (false, "This username is already taken");
        }

        // Eski username'i logla
        var oldUsername = user.UserName;
        
        // Username'i değiştir
        user.UserName = newUsername;
        await _db.SaveChangesAsync();
        
        _logger.LogInformation(
            "Username changed for user {UserId}: '{OldUsername}' -> '{NewUsername}'", 
            userId, oldUsername, newUsername);
        
        return (true, null);
    }

    /// <summary>
    /// Text'ten username slug üretir (public metod - username güncelleme için kullanılır)
    /// DisplayName kaldırıldı - artık direkt text'ten slug üretiliyor
    /// </summary>
    public string CreateSlugFromTextPublic(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }
        
        return CreateSlugFromText(text);
    }

    /// <summary>
    /// Kullanıcının güncel username'ini döndürür
    /// Basit mimari: Sadece UserName alanını döndürür (Identity framework standardı)
    /// Email fallback kaldırıldı - eski username'leri döndürmemesi için
    /// </summary>
    public string GetUserCurrentUsername(ApplicationUser? user)
    {
        if (user == null)
        {
            _logger.LogWarning("GetUserCurrentUsername called with null user");
            return string.Empty;
        }
        
        // Basit mimari: Sadece UserName alanını kullan
        // Email fallback kaldırıldı - kullanıcı username değiştirdiğinde eski email'den üretilen username dönmemeli
        if (!string.IsNullOrWhiteSpace(user.UserName))
        {
            _logger.LogDebug("GetUserCurrentUsername for user {UserId} ({Email}): returning UserName '{UserName}'", 
                user.Id, user.Email, user.UserName);
            return user.UserName;
        }
        
        // UserName boşsa logla ve boş döndür
        _logger.LogWarning("GetUserCurrentUsername for user {UserId} ({Email}): UserName is null or empty!", 
            user.Id, user.Email);
        
        return string.Empty;
    }

    /// <summary>
    /// Username'den kullanıcı ID'si bulur
    /// Basit mimari: Direkt UserName alanında arama yapar (performanslı)
    /// </summary>
    public async Task<string?> GetUserIdByUsernameAsync(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return null;
        }

        // Basit mimari: Direkt UserName alanında ara (index'lenmiş, hızlı)
        var user = await _db.Users
            .OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.UserName == username);
        
        if (user != null)
        {
            return user.Id;
        }
        
        // Bulunamadıysa null döndür
        return null;
    }
}
