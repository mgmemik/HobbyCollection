using System.Security.Claims;
using HobbyCollection.Infrastructure;
using HobbyCollection.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEntitlementService _entitlementService;
    private readonly UsernameService _usernameService;
    
    public UserPreferencesController(AppDbContext db, IEntitlementService entitlementService, UsernameService usernameService)
    {
        _db = db;
        _entitlementService = entitlementService;
        _usernameService = usernameService;
    }

    public record PreferencesDto(
        string UiLanguage, 
        string AiLanguage, 
        string? Currency, 
        bool? IsPrivateAccount, 
        bool? IsWebProfilePublic,
        string? AvatarUrl = null,
        string? Username = null // Username güncelleme için
    );

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound();

        var ui = string.IsNullOrWhiteSpace(user.UiLanguage) ? "en" : user.UiLanguage;
        var ai = string.IsNullOrWhiteSpace(user.AiLanguage) ? "en" : user.AiLanguage;
        var currency = string.IsNullOrWhiteSpace(user.Currency) ? "TRY" : user.Currency;
        
        // Premium durumunu kontrol et
        var isPremium = await _entitlementService.IsPremiumAsync(userId);
        
        // Güncel username'i al
        var currentUsername = _usernameService.GetUserCurrentUsername(user);
        
        // Log: GET endpoint'te döndürülen username
        var logger = HttpContext.RequestServices.GetRequiredService<ILogger<UserPreferencesController>>();
        logger.LogInformation(
            "UserPreferencesController.Get for user {UserId} ({Email}): " +
            "UserName in DB: '{UserName}', GetUserCurrentUsername returned: '{CurrentUsername}'",
            userId, user.Email, user.UserName, currentUsername);
        
        // webProfileUrl artık backend'den gönderilmiyor
        // Frontend'de güncel username ile oluşturulmalı
        // Bu sayede username değiştiğinde eski URL gösterilmez
        
        return Ok(new { 
            uiLanguage = ui, 
            aiLanguage = ai, 
            username = currentUsername, // Güncel username
            currency = currency,
            isPrivateAccount = user.IsPrivateAccount,
            isWebProfilePublic = user.IsWebProfilePublic,
            avatarUrl = user.AvatarUrl,
            isPremium = isPremium
            // webProfileUrl kaldırıldı - frontend'de username ile oluşturulmalı
        });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] PreferencesDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound();
        
        // Logger'ı bir kez tanımla
        var logger = HttpContext.RequestServices.GetRequiredService<ILogger<UserPreferencesController>>();

        // Basic whitelist (optional): allow only known codes (2-5 length)
        user.UiLanguage = string.IsNullOrWhiteSpace(dto.UiLanguage) ? user.UiLanguage : dto.UiLanguage.Trim();
        user.AiLanguage = string.IsNullOrWhiteSpace(dto.AiLanguage) ? user.AiLanguage : dto.AiLanguage.Trim();
        
        if (!string.IsNullOrWhiteSpace(dto.Currency))
        {
            user.Currency = dto.Currency.Trim().ToUpper();
        }

        // Username güncelleme
        if (dto.Username != null)
        {
            var trimmed = dto.Username.Trim();
            var oldUserName = user.UserName;
            
            if (!string.IsNullOrWhiteSpace(trimmed))
            {
                // Username slug oluştur
                var newUsernameSlug = _usernameService.CreateSlugFromTextPublic(trimmed);
                
                logger.LogInformation(
                    "User {UserId} ({Email}) updating Username: '{OldUserName}' -> '{NewUsernameSlug}'",
                    userId, user.Email, oldUserName, newUsernameSlug);
                
                if (!string.IsNullOrWhiteSpace(newUsernameSlug))
                {
                    // Username unique mi kontrol et
                    if (!await _usernameService.IsUsernameTakenAsync(newUsernameSlug, userId))
                    {
                        // Unique ise direkt kullan
                        user.UserName = newUsernameSlug;
                        logger.LogInformation(
                            "User {UserId} username updated: '{OldUserName}' -> '{NewUserName}' (unique, direct)",
                            userId, oldUserName, newUsernameSlug);
                    }
                    else
                    {
                        // Unique değilse, unique hale getir (sonuna 2, 3, 4... ekle)
                        var uniqueUsername = await _usernameService.EnsureUniqueUsernameAsync(newUsernameSlug);
                        user.UserName = uniqueUsername;
                        logger.LogInformation(
                            "User {UserId} username updated: '{OldUserName}' -> '{NewUserName}' (made unique)",
                            userId, oldUserName, uniqueUsername);
                    }
                }
                else
                {
                    logger.LogWarning(
                        "User {UserId} Username '{Username}' resulted in empty username slug, keeping old UserName: '{OldUserName}'",
                        userId, trimmed, oldUserName);
                }
            }
        }

        if (dto.IsPrivateAccount.HasValue)
        {
            // Standart kullanıcılar için kapalı profil kullanılamaz - her zaman açık olmalı
            var isPremium = await _entitlementService.IsPremiumAsync(userId);
            if (!isPremium)
            {
                // Standart kullanıcılar için isPrivateAccount her zaman false olmalı (profil açık)
                user.IsPrivateAccount = false;
            }
            else
            {
                // Premium kullanıcılar için değeri güncelle
                user.IsPrivateAccount = dto.IsPrivateAccount.Value;
            }
            
            // Eğer uygulama profili kapatılıyorsa, web profili de otomatik kapansın
            if (user.IsPrivateAccount && user.IsWebProfilePublic == true)
            {
                user.IsWebProfilePublic = false;
            }
        }

        if (dto.IsWebProfilePublic.HasValue)
        {
            // Web profil görünürlüğü için kontroller
            if (dto.IsWebProfilePublic.Value)
            {
                // Açmak için önce uygulama profilinin açık olması gerekli
                if (user.IsPrivateAccount)
                {
                    return BadRequest(new { 
                        error = "APP_PROFILE_PRIVATE",
                        message = "Önce uygulama profilinizi herkese açık yapmalısınız"
                    });
                }
                
                // Sadece premium üyeler web profilini açabilir
                var isPremium = await _entitlementService.IsPremiumAsync(userId);
                if (!isPremium)
                {
                    return BadRequest(new { 
                        error = "PREMIUM_REQUIRED",
                        message = "Web profil görünürlüğü sadece premium üyeler için kullanılabilir"
                    });
                }
                
                user.IsWebProfilePublic = true;
            }
            else
            {
                // Kapatma her zaman serbest
                user.IsWebProfilePublic = false;
            }
        }

        await _db.SaveChangesAsync();
        
        // Database'den fresh user bilgisini çek (SaveChanges sonrası)
        await _db.Entry(user).ReloadAsync();
        
        // Güncel username'i al
        var currentUsername = _usernameService.GetUserCurrentUsername(user);
        
        // Log: Response'ta döndürülen username
        logger.LogInformation(
            "UserPreferencesController.Update response for user {UserId} ({Email}): " +
            "UserName in DB: '{UserName}', GetUserCurrentUsername returned: '{CurrentUsername}'",
            userId, user.Email, user.UserName, currentUsername);
        
        // webProfileUrl artık backend'den gönderilmiyor
        // Frontend'de güncel username ile oluşturulmalı
        // Bu sayede username değiştiğinde eski URL gösterilmez
        
        return Ok(new { 
            message = "Preferences updated",
            username = currentUsername, // Güncel username
            isWebProfilePublic = user.IsWebProfilePublic
            // webProfileUrl kaldırıldı - frontend'de username ile oluşturulmalı
        });
    }
}
