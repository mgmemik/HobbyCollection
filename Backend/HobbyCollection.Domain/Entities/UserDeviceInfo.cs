namespace HobbyCollection.Domain.Entities;

/// <summary>
/// Kullanıcı cihaz bilgileri - Uygulama versiyonu, işletim sistemi, cihaz bilgileri
/// </summary>
public class UserDeviceInfo
{
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Kullanıcı ID
    /// </summary>
    public string UserId { get; set; } = string.Empty;
    
    /// <summary>
    /// İşletim sistemi (iOS, Android)
    /// </summary>
    public string Platform { get; set; } = string.Empty;
    
    /// <summary>
    /// İşletim sistemi versiyonu (örn: iOS 17.0, Android 14)
    /// </summary>
    public string? OsVersion { get; set; }
    
    /// <summary>
    /// Uygulama versiyonu (örn: 1.0.0)
    /// </summary>
    public string? AppVersion { get; set; }
    
    /// <summary>
    /// Build numarası (örn: 123)
    /// </summary>
    public string? BuildNumber { get; set; }
    
    /// <summary>
    /// Cihaz modeli (örn: iPhone 14 Pro, Samsung Galaxy S23)
    /// </summary>
    public string? DeviceModel { get; set; }
    
    /// <summary>
    /// Cihaz üreticisi (örn: Apple, Samsung)
    /// </summary>
    public string? DeviceManufacturer { get; set; }
    
    /// <summary>
    /// Cihaz adı (kullanıcının verdiği isim)
    /// </summary>
    public string? DeviceName { get; set; }
    
    /// <summary>
    /// Push notification token (FCM veya APNs token)
    /// </summary>
    public string? PushToken { get; set; }
    
    /// <summary>
    /// Push notification izni var mı?
    /// </summary>
    public bool HasNotificationPermission { get; set; }

    /// <summary>
    /// Uygulama içi bildirim ayarı açık mı?
    /// OS/telefon ayarlarından bağımsız olarak, uygulama bildirim göndermeli mi?
    /// </summary>
    public bool NotificationsEnabled { get; set; } = true;
    
    /// <summary>
    /// IP adresi (son güncelleme)
    /// </summary>
    public string? IpAddress { get; set; }
    
    /// <summary>
    /// User Agent (web'den geliyorsa)
    /// </summary>
    public string? UserAgent { get; set; }
    
    /// <summary>
    /// Son güncelleme tarihi
    /// </summary>
    public DateTime LastUpdatedUtc { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// İlk kayıt tarihi
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Bu cihaz aktif mi? (son 30 gün içinde güncellenmişse aktif)
    /// </summary>
    public bool IsActive => LastUpdatedUtc >= DateTime.UtcNow.AddDays(-30);
}

