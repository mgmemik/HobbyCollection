using Microsoft.AspNetCore.Identity;

namespace HobbyCollection.Infrastructure;

public class ApplicationUser : IdentityUser
{
    // DisplayName kaldırıldı - artık sadece UserName kullanılıyor

    // UI language preference (i18n code like 'tr', 'en', 'de'...)
    public string? UiLanguage { get; set; }

    // AI assistant language preference (default 'en')
    public string? AiLanguage { get; set; } = "en";

    // Currency preference (ISO 4217 code like 'TRY', 'USD', 'EUR'...)
    public string? Currency { get; set; } = "TRY";

    // Kapalı hesap ayarı (Instagram benzeri)
    public bool IsPrivateAccount { get; set; } = false;

    // Web profil görünürlüğü (sadece premium üyeler için)
    // null = standart kullanıcı (ürünleri görünür), true/false = premium kullanıcı
    public bool? IsWebProfilePublic { get; set; } = null;

    // Admin yetkisi (database'de manuel olarak true yapılacak)
    public bool IsAdmin { get; set; } = false;

    // Avatar fotoğrafı URL'i (Google Cloud Storage'da saklanır)
    public string? AvatarUrl { get; set; }

    // Kullanıcı oluşturulma tarihi (onaylanmamış kullanıcı temizleme için)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


