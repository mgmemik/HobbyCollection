using System.Text;
using System.Text.Json;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Expo Push Notification Service
/// Expo Push API kullanarak push notification gönderir
/// </summary>
public class PushNotificationService
{
    private readonly AppDbContext _db;
    private readonly ILogger<PushNotificationService> _logger;
    private readonly HttpClient _httpClient;
    private const string ExpoPushApiUrl = "https://exp.host/--/api/v2/push/send";

    public PushNotificationService(AppDbContext db, ILogger<PushNotificationService> logger, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
        _httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate");
    }

    /// <summary>
    /// Push notification gönderim sonucu detayları
    /// </summary>
    public class PushNotificationResult
    {
        public bool Success { get; set; }
        public int TotalDevices { get; set; }
        public int ActiveTokenCount { get; set; }
        public int SentCount { get; set; }
        public int FailedCount { get; set; }
        public List<DevicePushResult> DeviceResults { get; set; } = new();
        public string? ErrorMessage { get; set; }
        public string? ExpoApiResponse { get; set; }
    }

    public class DevicePushResult
    {
        public string Token { get; set; } = string.Empty;
        public string Platform { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ErrorMessage { get; set; }
        public string? ExpoTicketId { get; set; }
    }

    /// <summary>
    /// Kullanıcıya push notification gönder (detaylı sonuç ile)
    /// </summary>
    public async Task<PushNotificationResult> SendPushNotificationDetailedAsync(
        string userId,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        try
        {
            // Kullanıcının aktif cihazlarını ve push token'larını al
            // IsActive computed property olduğu için EF Core bunu SQL'e çeviremez
            // Bu yüzden direkt LastUpdatedUtc >= cutoff kontrolünü kullanıyoruz
            var cutoff = DateTime.UtcNow.AddDays(-30);
            var devices = await _db.UserDeviceInfos
                .Where(d => d.UserId == userId 
                    && !string.IsNullOrEmpty(d.PushToken)
                    && d.NotificationsEnabled
                    && d.HasNotificationPermission
                    && d.LastUpdatedUtc >= cutoff) // Son 30 gün içinde aktif (IsActive kontrolü yerine direkt tarih kontrolü)
                .Select(d => new { d.PushToken, d.Platform })
                .ToListAsync();

            // Dedupe: aynı token birden fazla kayıtla gelebilir (özellikle token güncellemeleri).
            devices = devices
                .Where(d => !string.IsNullOrWhiteSpace(d.PushToken))
                .GroupBy(d => d.PushToken!)
                .Select(g => g.First())
                .ToList();

            var result = new PushNotificationResult
            {
                TotalDevices = devices.Count,
                ActiveTokenCount = devices.Count
            };

            if (!devices.Any())
            {
                _logger.LogInformation("No active devices with push tokens found for user {UserId}", userId);
                result.ErrorMessage = "Aktif cihaz veya push token bulunamadı";
                return result;
            }

            var messages = devices.Select(device => new
            {
                to = device.PushToken,
                sound = "default",
                title = title,
                body = body,
                data = data ?? new Dictionary<string, object>(),
                priority = "default",
                channelId = "default"
            }).ToList();

            var payload = JsonSerializer.Serialize(messages);
            var content = new StringContent(payload, Encoding.UTF8, "application/json");

            _logger.LogInformation("Sending push notification to {Count} device(s) for user {UserId}", messages.Count, userId);

            try
            {
                var response = await _httpClient.PostAsync(ExpoPushApiUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                result.ExpoApiResponse = responseContent;

                if (response.IsSuccessStatusCode)
                {
                    // Expo Push API response'unu parse et ve hataları kontrol et
                    try
                    {
                        using var doc = JsonDocument.Parse(responseContent);
                        var rootElement = doc.RootElement;
                        
                        if (rootElement.ValueKind == JsonValueKind.Array)
                        {
                            var deviceIndex = 0;
                            foreach (var item in rootElement.EnumerateArray())
                            {
                                var deviceResult = new DevicePushResult();
                                
                                if (deviceIndex < devices.Count)
                                {
                                    deviceResult.Token = devices[deviceIndex].PushToken!;
                                    deviceResult.Platform = devices[deviceIndex].Platform ?? "Unknown";
                                }

                                if (item.TryGetProperty("status", out var statusElement))
                                {
                                    deviceResult.Status = statusElement.GetString() ?? "unknown";
                                    
                                    if (item.TryGetProperty("id", out var idElement))
                                    {
                                        deviceResult.ExpoTicketId = idElement.GetString();
                                    }

                                    if (deviceResult.Status == "ok")
                                    {
                                        result.SentCount++;
                                        deviceResult.ErrorMessage = null;
                                    }
                                    else
                                    {
                                        result.FailedCount++;
                                        if (item.TryGetProperty("message", out var msgElement))
                                        {
                                            deviceResult.ErrorMessage = msgElement.GetString();
                                        }
                                        else
                                        {
                                            deviceResult.ErrorMessage = "Bilinmeyen hata";
                                        }
                                        _logger.LogWarning("Push notification failed for token {Token}: {Status} - {Message}", 
                                            deviceResult.Token, deviceResult.Status, deviceResult.ErrorMessage);
                                    }
                                }
                                else
                                {
                                    deviceResult.Status = "unknown";
                                    deviceResult.ErrorMessage = "Status bilgisi alınamadı";
                                    result.FailedCount++;
                                }

                                result.DeviceResults.Add(deviceResult);
                                deviceIndex++;
                            }
                            
                            result.Success = result.FailedCount == 0;
                            
                            if (result.Success)
                            {
                                _logger.LogInformation("Push notification sent successfully to user {UserId}. Sent: {SentCount}", userId, result.SentCount);
                            }
                            else
                            {
                                _logger.LogWarning("Some push notifications failed for user {UserId}. Sent: {SentCount}, Failed: {FailedCount}", 
                                    userId, result.SentCount, result.FailedCount);
                            }
                        }
                        else
                        {
                            result.Success = true;
                            result.SentCount = messages.Count;
                            _logger.LogInformation("Push notification sent successfully to user {UserId}. Response: {Response}", userId, responseContent);
                        }
                    }
                    catch (Exception parseEx)
                    {
                        _logger.LogWarning(parseEx, "Could not parse Expo Push API response for user {UserId}. Response: {Response}", userId, responseContent);
                        result.ErrorMessage = $"Response parse edilemedi: {parseEx.Message}";
                        result.Success = false;
                    }
                }
                else
                {
                    result.Success = false;
                    result.ErrorMessage = $"HTTP {response.StatusCode}: {responseContent}";
                    _logger.LogError("Failed to send push notification to user {UserId}. Status: {Status}, Response: {Response}", 
                        userId, response.StatusCode, responseContent);
                }
            }
            catch (Exception httpEx)
            {
                result.Success = false;
                result.ErrorMessage = $"HTTP isteği başarısız: {httpEx.Message}";
                _logger.LogError(httpEx, "HTTP error sending push notification to user {UserId}", userId);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending push notification to user {UserId}", userId);
            return new PushNotificationResult
            {
                Success = false,
                ErrorMessage = $"Beklenmeyen hata: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Kullanıcıya push notification gönder (basit boolean sonuç ile - geriye dönük uyumluluk için)
    /// </summary>
    public async Task<bool> SendPushNotificationAsync(
        string userId,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        var result = await SendPushNotificationDetailedAsync(userId, title, body, data);
        return result.Success;
    }

    /// <summary>
    /// Birden fazla kullanıcıya push notification gönder
    /// </summary>
    public async Task<Dictionary<string, bool>> SendPushNotificationsAsync(
        List<string> userIds,
        string title,
        string body,
        Dictionary<string, object>? data = null)
    {
        var results = new Dictionary<string, bool>();

        foreach (var userId in userIds)
        {
            var success = await SendPushNotificationAsync(userId, title, body, data);
            results[userId] = success;
        }

        return results;
    }

    /// <summary>
    /// Notification entity oluşturulduğunda otomatik push notification gönder
    /// </summary>
    public async Task SendNotificationAsync(Notification notification)
    {
        try
        {
            var data = new Dictionary<string, object>
            {
                { "notificationId", notification.Id.ToString() },
                { "type", notification.Type }
            };

            if (notification.RelatedProductId.HasValue)
            {
                data["productId"] = notification.RelatedProductId.Value.ToString();
            }

            if (notification.RelatedCommentId.HasValue)
            {
                data["commentId"] = notification.RelatedCommentId.Value.ToString();
            }

            if (notification.RelatedConversationId.HasValue)
            {
                data["conversationId"] = notification.RelatedConversationId.Value.ToString();
            }

            if (!string.IsNullOrEmpty(notification.RelatedUserId))
            {
                data["userId"] = notification.RelatedUserId;
            }

            if (!string.IsNullOrEmpty(notification.RelatedFollowId))
            {
                data["followId"] = notification.RelatedFollowId;
            }

            // Mesaj bildirimi için, Chat ekranına direkt gidebilmek adına gönderici bilgilerini payload'a ekle
            if (notification.Type == "message" && !string.IsNullOrEmpty(notification.RelatedUserId))
            {
                var sender = await _db.Users
                    .OfType<ApplicationUser>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == notification.RelatedUserId);

                if (sender != null)
                {
                    // DisplayName kaldırıldı - sadece UserName kullan
                    var displayName = !string.IsNullOrWhiteSpace(sender.UserName)
                        ? sender.UserName
                        : sender.Id.Substring(0, Math.Min(8, sender.Id.Length));
                    data["otherUserDisplayName"] = displayName;
                    if (!string.IsNullOrEmpty(sender.AvatarUrl))
                    {
                        data["otherUserAvatarUrl"] = sender.AvatarUrl!;
                    }
                }
            }

            await SendPushNotificationAsync(
                notification.UserId,
                notification.Title,
                notification.Message ?? "",
                data
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending push notification for notification {NotificationId}", notification.Id);
        }
    }
}

