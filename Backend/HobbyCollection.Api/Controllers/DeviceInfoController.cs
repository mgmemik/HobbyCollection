using System.Security.Claims;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DeviceInfoController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<DeviceInfoController> _logger;

    public DeviceInfoController(AppDbContext db, ILogger<DeviceInfoController> logger)
    {
        _db = db;
        _logger = logger;
    }

    public record UpdateDeviceInfoRequest(
        string Platform,
        string? OsVersion = null,
        string? AppVersion = null,
        string? BuildNumber = null,
        string? DeviceModel = null,
        string? DeviceManufacturer = null,
        string? DeviceName = null,
        string? PushToken = null,
        bool? HasNotificationPermission = null,
        bool? NotificationsEnabled = null
    );

    /// <summary>
    /// Kullanıcı cihaz bilgilerini günceller veya oluşturur
    /// </summary>
    [HttpPost("update")]
    public async Task<IActionResult> UpdateDeviceInfo([FromBody] UpdateDeviceInfoRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // IP adresi ve User Agent bilgilerini al
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = Request.Headers["User-Agent"].ToString();

        // PushToken'a bağlı ID üretmek, token değişimlerinde yeni satırlar oluşturup
        // push tarafında eski token'lara da bildirim gitmesine yol açabilir.
        // Bu nedenle cihaz ID'yi mümkün olduğunca STABLE alanlardan üret.
        var deviceId = GenerateDeviceId(
            userId,
            request.Platform,
            request.DeviceModel,
            request.DeviceManufacturer,
            request.DeviceName
        );

        // Mevcut cihaz bilgisini bul veya yeni oluştur
        var deviceInfo = await _db.UserDeviceInfos
            .FirstOrDefaultAsync(d => d.Id == deviceId);

        if (deviceInfo == null)
        {
            // Yeni cihaz bilgisi oluştur
            // Yeni kullanıcılar için notification permission default olarak true
            deviceInfo = new UserDeviceInfo
            {
                Id = deviceId,
                UserId = userId,
                Platform = request.Platform,
                CreatedAtUtc = DateTime.UtcNow,
                LastUpdatedUtc = DateTime.UtcNow,
                HasNotificationPermission = request.HasNotificationPermission ?? true, // Yeni kullanıcılar için default true
                NotificationsEnabled = request.NotificationsEnabled ?? true // Uygulama içi ayar default true
            };
            _db.UserDeviceInfos.Add(deviceInfo);
            _logger.LogInformation("New device info created for user {UserId}, platform {Platform}, HasNotificationPermission: {HasPermission}", 
                userId, request.Platform, deviceInfo.HasNotificationPermission);
        }
        else
        {
            // Mevcut cihaz bilgisini güncelle
            deviceInfo.LastUpdatedUtc = DateTime.UtcNow;
            // IsActive computed property olduğu için LastUpdatedUtc güncellendiğinde otomatik olarak true olacak
            _logger.LogInformation("Device info updated for user {UserId}, platform {Platform}", userId, request.Platform);
        }

        // Bilgileri güncelle
        if (!string.IsNullOrWhiteSpace(request.OsVersion))
            deviceInfo.OsVersion = request.OsVersion;
        
        if (!string.IsNullOrWhiteSpace(request.AppVersion))
        {
            deviceInfo.AppVersion = request.AppVersion;
            
            // AppVersions tablosuna yeni sürümü ekle (eğer yoksa)
            var existingVersion = await _db.AppVersions
                .FirstOrDefaultAsync(v => v.Version == request.AppVersion);
            
            if (existingVersion == null)
            {
                var newVersion = new AppVersion
                {
                    Id = Guid.NewGuid(),
                    Version = request.AppVersion,
                    IsValid = true, // Yeni sürümler varsayılan olarak geçerli
                    CreatedAtUtc = DateTime.UtcNow
                };
                _db.AppVersions.Add(newVersion);
                _logger.LogInformation("Yeni uygulama sürümü otomatik olarak eklendi: {Version}", request.AppVersion);
            }
        }
        
        if (!string.IsNullOrWhiteSpace(request.BuildNumber))
            deviceInfo.BuildNumber = request.BuildNumber;
        
        if (!string.IsNullOrWhiteSpace(request.DeviceModel))
            deviceInfo.DeviceModel = request.DeviceModel;
        
        if (!string.IsNullOrWhiteSpace(request.DeviceManufacturer))
            deviceInfo.DeviceManufacturer = request.DeviceManufacturer;
        
        if (!string.IsNullOrWhiteSpace(request.DeviceName))
            deviceInfo.DeviceName = request.DeviceName;
        
        if (!string.IsNullOrWhiteSpace(request.PushToken))
            deviceInfo.PushToken = request.PushToken;
        
        if (request.HasNotificationPermission.HasValue)
            deviceInfo.HasNotificationPermission = request.HasNotificationPermission.Value;

        if (request.NotificationsEnabled.HasValue)
            deviceInfo.NotificationsEnabled = request.NotificationsEnabled.Value;

        deviceInfo.IpAddress = ipAddress;
        deviceInfo.UserAgent = userAgent;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Device info updated successfully",
            deviceId = deviceInfo.Id
        });
    }

    /// <summary>
    /// Kullanıcının tüm cihaz bilgilerini getirir
    /// </summary>
    [HttpGet("my-devices")]
    public async Task<IActionResult> GetMyDevices()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var devices = await _db.UserDeviceInfos
            .Where(d => d.UserId == userId)
            .OrderByDescending(d => d.LastUpdatedUtc)
            .Select(d => new
            {
                id = d.Id,
                platform = d.Platform,
                osVersion = d.OsVersion,
                appVersion = d.AppVersion,
                buildNumber = d.BuildNumber,
                deviceModel = d.DeviceModel,
                deviceManufacturer = d.DeviceManufacturer,
                deviceName = d.DeviceName,
                hasNotificationPermission = d.HasNotificationPermission,
                notificationsEnabled = d.NotificationsEnabled,
                hasPushToken = !string.IsNullOrEmpty(d.PushToken),
                lastUpdatedUtc = d.LastUpdatedUtc,
                createdAtUtc = d.CreatedAtUtc,
                isActive = d.IsActive
            })
            .ToListAsync();

        return Ok(new
        {
            devices
        });
    }

    /// <summary>
    /// Cihaz ID oluştur (UserId + Platform + cihaz bilgileri hash)
    /// </summary>
    private string GenerateDeviceId(
        string userId,
        string platform,
        string? deviceModel,
        string? deviceManufacturer,
        string? deviceName)
    {
        // Aynı kullanıcı aynı platformda birden fazla cihaz kullanabilir.
        // DeviceName/model/manufacturer kombinasyonu genelde yeterince ayırt edicidir.
        // Boşlukları normalize ederek stabil bir anahtar üret.
        static string Norm(string? s) => string.IsNullOrWhiteSpace(s) ? "" : s.Trim().ToLowerInvariant();
        var uniqueKey = $"{userId}:{Norm(platform)}:{Norm(deviceManufacturer)}:{Norm(deviceModel)}:{Norm(deviceName)}";

        // SHA256 hash ile benzersiz ID oluştur
        using (var sha256 = System.Security.Cryptography.SHA256.Create())
        {
            var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(uniqueKey));
            return Convert.ToBase64String(hashBytes).Replace("+", "-").Replace("/", "_").Replace("=", "").Substring(0, 32);
        }
    }
}

