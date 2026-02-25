using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Abstractions;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<AuthController> _logger;
    private readonly AppDbContext _db;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly UsernameService _usernameService;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration configuration,
        IEmailSender emailSender,
        ILogger<AuthController> logger,
        AppDbContext db,
        IServiceScopeFactory serviceScopeFactory,
        UsernameService usernameService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _emailSender = emailSender;
        _logger = logger;
        _db = db;
        _serviceScopeFactory = serviceScopeFactory;
        _usernameService = usernameService;
    }

    public record RegisterRequest(string Email);
    public record VerifyEmailRequest(string Email, string Code, string? AppVersion = null);
    public record LoginRequest(string Email, bool RememberMe = false, string? AppVersion = null);

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        // App Store Review için özel test hesabı (sadece review sırasında kullanılacak)
        var reviewTestEmail = _configuration["AppStoreReview:TestEmail"] ?? "appstore.review@save-all.com";
        var reviewTestCode = _configuration["AppStoreReview:TestCode"] ?? "123456";
        
        if (request.Email.Equals(reviewTestEmail, StringComparison.OrdinalIgnoreCase))
        {
            // Review test email için sabit kod kullan
            var reviewUser = await _userManager.FindByEmailAsync(reviewTestEmail);
            if (reviewUser == null)
            {
                var reviewUsername = await _usernameService.GenerateUsernameFromEmailAsync(reviewTestEmail);
                reviewUser = new ApplicationUser { UserName = reviewUsername, Email = reviewTestEmail };
                var createResult = await _userManager.CreateAsync(reviewUser);
                if (!createResult.Succeeded)
                {
                    return BadRequest(createResult.Errors);
                }
                await _userManager.ConfirmEmailAsync(reviewUser, await _userManager.GenerateEmailConfirmationTokenAsync(reviewUser));
            }
            await _userManager.SetAuthenticationTokenAsync(reviewUser, "email", "short", reviewTestCode);
            _logger.LogInformation("App Store Review test account - Email: {Email}, Code: {Code}", reviewTestEmail, reviewTestCode);
            return Ok(new { message = "Verification code has been sent to your email.", code = reviewTestCode });
        }

        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user != null)
        {
            // Eğer kullanıcı varsa kısa doğrulama kodu üret ve E-Posta + Log
            var shortExisting = System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
            await _userManager.SetAuthenticationTokenAsync(user, "email", "short", shortExisting);
            _logger.LogInformation("Email verification code (existing user) for {Email}: {Short}", user.Email, shortExisting);

            // Mail gönderimi aktif
            try
            {
                var appName = "Save All";
                var html = $@"
                    <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
                        <h2 style=""color: #333;"">{appName} - E-posta Doğrulama</h2>
                        <p>Merhaba,</p>
                        <p>E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
                        <div style=""background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;"">
                            <h1 style=""color: #333; font-size: 32px; margin: 0; letter-spacing: 4px;"">{System.Net.WebUtility.HtmlEncode(shortExisting)}</h1>
                        </div>
                        <p style=""color: #666; font-size: 12px;"">Bu kod 10 dakika geçerlidir.</p>
                        <p style=""color: #666; font-size: 12px; margin-top: 20px;"">İyi günler,<br/>{appName} Ekibi</p>
                    </div>";
                await _emailSender.SendAsync(user.Email!, $"{appName} - E-posta Doğrulama Kodu", html);
                _logger.LogInformation("Verification email successfully sent to {Email} via SMTP", user.Email);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send verification email to {Email}", user.Email);
                // Mail gönderiminde hata olsa bile kod üretildi, response'ta kod göster
                return Ok(new { message = "Verification code generated but email sending failed. Please check your email or try again.", code = shortExisting });
            }

            return Ok(new { message = "Verification code has been sent to your email." });
        }

        // Yeni kullanıcı oluştur - email'den unique username üret
        var username = await _usernameService.GenerateUsernameFromEmailAsync(request.Email);
        user = new ApplicationUser { UserName = username, Email = request.Email };
        var create = await _userManager.CreateAsync(user);
        if (!create.Succeeded)
        {
            return BadRequest(create.Errors);
        }

        var code = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        // Kısa kod: 6 haneli sayısal
        var shortCode = System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
        await _userManager.SetAuthenticationTokenAsync(user, "email", "short", shortCode);
        _logger.LogInformation("Email verification code generated for {Email}: {Short}", user.Email, shortCode);
        // Mail gönderimi aktif
        try
        {
            var appName = "Save All";
            var html = $@"
                <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
                    <h2 style=""color: #333;"">{appName} - E-posta Doğrulama</h2>
                    <p>Merhaba,</p>
                    <p>E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
                    <div style=""background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;"">
                        <h1 style=""color: #333; font-size: 32px; margin: 0; letter-spacing: 4px;"">{System.Net.WebUtility.HtmlEncode(shortCode)}</h1>
                    </div>
                    <p style=""color: #666; font-size: 12px;"">Bu kod 10 dakika geçerlidir.</p>
                    <p style=""color: #666; font-size: 12px; margin-top: 20px;"">İyi günler,<br/>{appName} Ekibi</p>
                </div>";
            await _emailSender.SendAsync(user.Email!, $"{appName} - E-posta Doğrulama Kodu", html);
            _logger.LogInformation("Verification email successfully sent to {Email} via SMTP", user.Email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send verification email to {Email}", user.Email);
            // Mail gönderiminde hata olsa bile kod üretildi, response'ta kod göster
            return Ok(new { message = "Verification code generated but email sending failed. Please check your email or try again.", code = shortCode });
        }
        
        return Ok(new { message = "Verification code has been sent to your email." });
    }

    [HttpPost("verify-email")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            // Başarısız login denemesi - kullanıcı bulunamadı
            await LogLoginAttemptAsync(null, request.Email, false, "User not found");
            return NotFound();
        }

        // IP adresi ve User Agent bilgilerini al
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = Request.Headers["User-Agent"].ToString();

        // Hem kısa 6 haneli kodu hem de ASP.NET Identity uzun tokenını destekle
        var storedShort = await _userManager.GetAuthenticationTokenAsync(user, "email", "short");
        IdentityResult result;
        if (!string.IsNullOrEmpty(storedShort) && storedShort == request.Code)
        {
            // Email doğrulanmamışsa önce email'i doğrula
            if (!await _userManager.IsEmailConfirmedAsync(user))
            {
                result = await _userManager.ConfirmEmailAsync(user, await _userManager.GenerateEmailConfirmationTokenAsync(user));
            }
            else
            {
                // Email zaten doğrulanmışsa sadece kod kontrolü yap (her login'de verification gerektiği için)
                result = IdentityResult.Success;
            }
        }
        else
        {
            result = await _userManager.ConfirmEmailAsync(user, request.Code);
        }
        
        if (!result.Succeeded)
        {
            // Başarısız login denemesi - kod hatalı
            var failureReason = string.Join(", ", result.Errors.Select(e => e.Description));
            await LogLoginAttemptAsync(user.Id, user.Email ?? request.Email, false, failureReason, ipAddress, userAgent);
            return BadRequest(result.Errors);
        }

        // Sürüm kontrolü - Sadece AppVersion gönderilmişse ve geçersiz yapılmışsa güncelleme iste
        // AppVersion gönderilmemişse veya yeni versiyon (database'de yok) ise girişe izin ver
        if (!string.IsNullOrWhiteSpace(request.AppVersion))
        {
            var appVersion = await _db.AppVersions
                .FirstOrDefaultAsync(v => v.Version == request.AppVersion);
            
            // Sadece database'de kayıtlı VE IsValid = false olan versiyonlar için güncelleme iste
            // Yeni versiyonlar (database'de yok) varsayılan olarak geçerli kabul edilir
            if (appVersion != null && !appVersion.IsValid)
            {
                // Sürüm geçersiz, güncelleme iste
                _logger.LogWarning("Login blocked for {Email} - Invalid app version: {Version}", 
                    user.Email, request.AppVersion);
                return BadRequest(new 
                { 
                    message = "Uygulamanızın güncel sürümü yok. Lütfen uygulamayı güncelleyin.",
                    requiresUpdate = true,
                    currentVersion = request.AppVersion
                });
            }
            // appVersion == null (yeni versiyon, database'de yok) → girişe izin ver
            // appVersion != null && appVersion.IsValid == true → girişe izin ver
        }
        // AppVersion gönderilmemişse (null/empty) → girişe izin ver (eski uygulamalar için)

        // Verification başarılı, token oluştur ve döndür
        var token = GenerateJwt(user, false);
        _logger.LogInformation("Email verification successful for {Email}, AppVersion: {Version}", 
            user.Email, request.AppVersion ?? "Unknown");
        
        // Başarılı login logu
        await LogLoginAttemptAsync(user.Id, user.Email ?? request.Email, true, null, ipAddress, userAgent);
        
        return Ok(new { message = "Email confirmed", accessToken = token });
    }

    private async Task LogLoginAttemptAsync(string? userId, string email, bool isSuccessful, string? failureReason = null, string? ipAddress = null, string? userAgent = null)
    {
        try
        {
            var loginLog = new LoginLog
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId ?? string.Empty,
                Email = email,
                IpAddress = ipAddress ?? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                UserAgent = userAgent ?? Request.Headers["User-Agent"].ToString(),
                IsSuccessful = isSuccessful,
                FailureReason = failureReason,
                CreatedAtUtc = DateTime.UtcNow
            };

            _db.LoginLogs.Add(loginLog);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Login log hatası login işlemini engellememeli
            _logger.LogError(ex, "Failed to log login attempt for {Email}", email);
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        
        // Kullanıcı yoksa oluştur
        if (user == null)
        {
            user = new ApplicationUser { UserName = request.Email, Email = request.Email };
            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                return BadRequest(createResult.Errors);
            }
        }

        // Admin kontrolü - ApplicationUser'a cast et
        var appUser = user as ApplicationUser;
        var isAdmin = appUser?.IsAdmin ?? false;

        // Her login'de verification code gönder (email doğrulanmış olsa bile)
        var shortCode = System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
        await _userManager.SetAuthenticationTokenAsync(user, "email", "short", shortCode);
        _logger.LogInformation("Email verification code generated for {Email}: {Short}, IsAdmin: {IsAdmin}", user.Email, shortCode, isAdmin);

        // Admin kullanıcılar için de mail gönder (veya tüm kullanıcılar için - production'da)
        var shouldSendEmail = isAdmin; // Admin kullanıcılar için mail gönder
        
        if (shouldSendEmail)
        {
            try
            {
                var appName = "Save All";
                var html = $@"
                    <div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
                        <h2 style=""color: #333;"">{appName} - E-posta Doğrulama</h2>
                        <p>Merhaba,</p>
                        <p>E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
                        <div style=""background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;"">
                            <h1 style=""color: #333; font-size: 32px; margin: 0; letter-spacing: 4px;"">{System.Net.WebUtility.HtmlEncode(shortCode)}</h1>
                        </div>
                        <p style=""color: #666; font-size: 12px;"">Bu kod 10 dakika geçerlidir.</p>
                        <p style=""color: #666; font-size: 12px; margin-top: 20px;"">İyi günler,<br/>{appName} Ekibi</p>
                    </div>";
                await _emailSender.SendAsync(user.Email!, $"{appName} - E-posta Doğrulama Kodu", html);
                _logger.LogInformation("Verification email successfully sent to {Email} via SMTP", user.Email);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send verification email to {Email}", user.Email);
                // Mail gönderiminde hata olsa bile kod üretildi, response'ta kod göster
                return Ok(new { message = "Verification code generated but email sending failed. Please check your email or try again.", code = shortCode });
            }
        }
        else
        {
            // Admin olmayan kullanıcılar için mail gönderme ama "mail atıldı" mesajı döndür
            _logger.LogInformation("Verification code generated for non-admin user {Email} (email not sent for security)", user.Email);
        }

        return Ok(new { message = "Verification code has been sent to your email." });
    }

    private string GenerateJwt(ApplicationUser user, bool rememberMe = false)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        
        // Remember me true ise uzun süreli token (30 gün), false ise kısa süreli (60 dakika)
        DateTime expires;
        if (rememberMe)
        {
            var rememberMeDays = jwtSection.GetValue<int>("RememberMeTokenDays", 30);
            expires = DateTime.UtcNow.AddDays(rememberMeDays);
            _logger.LogInformation("Generating long-lived token for {Email} (expires in {Days} days)", user.Email, rememberMeDays);
        }
        else
        {
            var accessTokenMinutes = jwtSection.GetValue<int>("AccessTokenMinutes", 60);
            expires = DateTime.UtcNow.AddMinutes(accessTokenMinutes);
            _logger.LogInformation("Generating short-lived token for {Email} (expires in {Minutes} minutes)", user.Email, accessTokenMinutes);
        }

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("isAdmin", user.IsAdmin.ToString().ToLower()) // Admin claim ekle
        };

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [HttpGet("check-token")]
    [Authorize]
    public IActionResult CheckToken()
    {
        // Token'ın geçerliliğini kontrol et ve expiration bilgisini döndür
        var tokenHandler = new JwtSecurityTokenHandler();
        var authHeader = HttpContext.Request.Headers["Authorization"].ToString();
        
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "No token provided" });
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        
        try
        {
            var jwtToken = tokenHandler.ReadJwtToken(token);
            var expires = jwtToken.ValidTo;
            var now = DateTime.UtcNow;
            var timeRemaining = expires - now;
            
            _logger.LogInformation("Token check - Expires: {Expires}, Now: {Now}, Remaining: {Remaining}", 
                expires, now, timeRemaining);
            
            return Ok(new 
            { 
                valid = true,
                expiresAt = expires,
                expiresAtLocal = expires.ToLocalTime(),
                timeRemainingMinutes = (int)timeRemaining.TotalMinutes,
                timeRemainingDays = (int)timeRemaining.TotalDays
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Token check failed");
            return Unauthorized(new { message = "Invalid token", valid = false });
        }
    }

    // Helper method: Username döndürür (DisplayName kaldırıldı)
    private string GetUserDisplayName(ApplicationUser? user, string userId)
    {
        if (user == null) return "User";
        
        // DisplayName kaldırıldı - sadece username kullan
        var username = _usernameService.GetUserCurrentUsername(user);
        return !string.IsNullOrWhiteSpace(username) ? username : "User";
    }

    /// <summary>
    /// Kullanıcı arama endpoint'i - DisplayName ve Email'e göre arama yapar
    /// </summary>
    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<IActionResult> SearchUsers(
        [FromQuery] string? query = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        var usersQuery = _userManager.Users.AsQueryable();

        // Sadece aktif kullanıcıları göster (EmailConfirmed ve lockout kontrolü)
        var now = DateTimeOffset.UtcNow;
        usersQuery = usersQuery.Where(u => 
            u.EmailConfirmed && 
            (u.LockoutEnd == null || u.LockoutEnd < now)
        );

        // Metin araması (DisplayName ve Email)
        if (!string.IsNullOrWhiteSpace(query))
        {
            var searchTerm = query.ToLower();
            usersQuery = usersQuery.Where(u =>
                // DisplayName kaldırıldı, UserName zaten kontrol ediliyor
                (u.Email != null && u.Email.ToLower().Contains(searchTerm)) ||
                (u.UserName != null && u.UserName.ToLower().Contains(searchTerm))
            );
        }

        var totalUsers = await usersQuery.CountAsync();
        var users = await usersQuery
            .OrderBy(u => u.UserName ?? u.Email ?? "") // DisplayName kaldırıldı
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Takipçi/takip edilen sayılarını ve takip durumunu al
        var userIds = users.Select(u => u.Id).ToList();
        
        var followerCounts = new Dictionary<string, int>();
        var followingCounts = new Dictionary<string, int>();
        var productCounts = new Dictionary<string, int>();
        var isFollowingMap = new Dictionary<string, bool>();
        var isPrivateMap = new Dictionary<string, bool>();

        if (userIds.Any())
        {
            // Takipçi sayıları (sadece kabul edilmiş olanlar)
            var followerCountsQuery = await (from f in _db.Follows
                                            where userIds.Contains(f.FollowingId) && f.Status == FollowStatus.Accepted
                                            group f by f.FollowingId into g
                                            select new { UserId = g.Key, Count = g.Count() })
                                            .ToListAsync();
            followerCounts = followerCountsQuery.ToDictionary(x => x.UserId, x => x.Count);

            // Takip edilen sayıları (sadece kabul edilmiş olanlar)
            var followingCountsQuery = await (from f in _db.Follows
                                             where userIds.Contains(f.FollowerId) && f.Status == FollowStatus.Accepted
                                             group f by f.FollowerId into g
                                             select new { UserId = g.Key, Count = g.Count() })
                                             .ToListAsync();
            followingCounts = followingCountsQuery.ToDictionary(x => x.UserId, x => x.Count);

            // Ürün sayıları
            var productCountsQuery = await (from p in _db.Products
                                           where userIds.Contains(p.UserId)
                                           group p by p.UserId into g
                                           select new { UserId = g.Key, Count = g.Count() })
                                           .ToListAsync();
            productCounts = productCountsQuery.ToDictionary(x => x.UserId, x => x.Count);

            // Mevcut kullanıcı bu kullanıcıları takip ediyor mu?
            if (!string.IsNullOrEmpty(currentUserId))
            {
                var follows = await _db.Follows
                    .Where(f => f.FollowerId == currentUserId && 
                               userIds.Contains(f.FollowingId) && 
                               f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowingId)
                    .ToListAsync();
                
                foreach (var userId in userIds)
                {
                    isFollowingMap[userId] = follows.Contains(userId);
                }

                // Private account bilgileri
                foreach (var user in users)
                {
                    isPrivateMap[user.Id] = user.IsPrivateAccount;
                }
            }
        }

        var result = users.Select(u => new
        {
            userId = u.Id,
            displayName = GetUserDisplayName(u, u.Id),
            email = u.Email,
            avatarUrl = u.AvatarUrl,
            followerCount = followerCounts.ContainsKey(u.Id) ? followerCounts[u.Id] : 0,
            followingCount = followingCounts.ContainsKey(u.Id) ? followingCounts[u.Id] : 0,
            productCount = productCounts.ContainsKey(u.Id) ? productCounts[u.Id] : 0,
            isFollowing = !string.IsNullOrEmpty(currentUserId) && isFollowingMap.ContainsKey(u.Id) && isFollowingMap[u.Id],
            isPrivateAccount = isPrivateMap.ContainsKey(u.Id) && isPrivateMap[u.Id],
            isOwnProfile = !string.IsNullOrEmpty(currentUserId) && currentUserId == u.Id
        }).ToList();

        // Arama logunu kaydet (asenkron olarak, response'u geciktirmemek için)
        // Thread-safe olması için yeni scope oluştur
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                
                var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
                var userAgent = Request.Headers["User-Agent"].ToString();
                
                var searchLog = new SearchLog
                {
                    Id = Guid.NewGuid().ToString(),
                    UserId = currentUserId,
                    SearchType = SearchType.Users,
                    Query = query,
                    CategoryId = null,
                    ResultCount = result.Count,
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    Language = null,
                    CreatedAtUtc = DateTime.UtcNow
                };

                db.SearchLogs.Add(searchLog);
                await db.SaveChangesAsync();
                _logger.LogInformation("Search log saved: Type={SearchType}, Query={Query}, Results={ResultCount}, UserId={UserId}", 
                    SearchType.Users, query ?? "(empty)", result.Count, currentUserId ?? "anonymous");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log search attempt for Users search. Query={Query}, UserId={UserId}", 
                    query ?? "(empty)", currentUserId ?? "anonymous");
            }
        });

        return Ok(new
        {
            users = result,
            totalCount = totalUsers,
            page = page,
            pageSize = pageSize,
            hasMore = totalUsers > page * pageSize
        });
    }
}


