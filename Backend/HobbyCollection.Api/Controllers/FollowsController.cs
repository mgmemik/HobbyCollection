using System.Security.Claims;
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HobbyCollection.Api.Services;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FollowsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<FollowsController> _logger;
    private readonly INotificationService _notificationService;

    public FollowsController(AppDbContext db, ILogger<FollowsController> logger, INotificationService notificationService)
    {
        _db = db;
        _logger = logger;
        _notificationService = notificationService;
    }

    /// <summary>
    /// Bir kullanıcıyı takip et veya takip talebi gönder
    /// </summary>
    [HttpPost("{followingId}")]
    public async Task<IActionResult> Follow(string followingId)
    {
        var followerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(followerId)) return Unauthorized();

        // Kendi kendini takip etmeyi engelle
        if (followerId == followingId)
        {
            return BadRequest(new { message = "Kendi kendinizi takip edemezsiniz." });
        }

        // Kullanıcının varlığını kontrol et
        var followingUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == followingId);
        if (followingUser == null)
        {
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        }

        // Zaten takip ediliyor mu kontrol et
        var existingFollow = await _db.Follows
            .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);

        if (existingFollow != null)
        {
            if (existingFollow.Status == FollowStatus.Accepted)
            {
                return Ok(new { message = "Zaten takip ediyorsunuz.", isFollowing = true, status = "accepted" });
            }
            else if (existingFollow.Status == FollowStatus.Pending)
            {
                return Ok(new { message = "Takip talebi bekliyor.", isFollowing = false, status = "pending" });
            }
        }

        // Kapalı hesap kontrolü
        bool isPrivateAccount = followingUser.IsPrivateAccount;
        var followStatus = isPrivateAccount ? FollowStatus.Pending : FollowStatus.Accepted;

        // Takip ilişkisi oluştur
        var follow = new Follow
        {
            FollowerId = followerId,
            FollowingId = followingId,
            Status = followStatus,
            CreatedAt = DateTime.UtcNow
        };

        _db.Follows.Add(follow);
        await _db.SaveChangesAsync();

        // Bildirim oluştur (dil desteği ile)
        var followerUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == followerId);
        var recipientUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == followingId);
        
        // Kullanıcının dil tercihini al
        var userLanguage = recipientUser?.UiLanguage ?? "en";
        var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
        
        var followerName = GetUserDisplayName(followerUser, followerId);
        var notificationTitle = isPrivateAccount
            ? (isTurkish ? "Yeni takip talebi" : "New follow request")
            : (isTurkish ? "Yeni takipçi" : "New follower");
        
        var notificationMessage = isPrivateAccount
            ? (isTurkish 
                ? $"{followerName} size takip talebi gönderdi."
                : $"{followerName} sent you a follow request.")
            : (isTurkish
                ? $"{followerName} sizi takip etmeye başladı."
                : $"{followerName} started following you.");

        await _notificationService.NotifyAsync(
            isPrivateAccount ? NotificationEventType.FollowRequest : NotificationEventType.Follow,
            new NotificationPayload(
                RecipientUserId: followingId,
                Title: notificationTitle,
                Message: notificationMessage,
                ActorUserId: followerId,
                RelatedFollowId: isPrivateAccount ? follow.Id.ToString() : null
            )
        );

        if (isPrivateAccount)
        {
            return Ok(new { message = "Takip talebi gönderildi.", isFollowing = false, status = "pending" });
        }
        else
        {
            return Ok(new { message = "Takip edildi.", isFollowing = true, status = "accepted" });
        }
    }

    // Helper method: Username döndürür (DisplayName kaldırıldı)
    private string GetUserDisplayName(ApplicationUser? user, string userId)
    {
        if (user == null) return "User";
        
        // DisplayName kaldırıldı - sadece UserName kullan
        return !string.IsNullOrWhiteSpace(user.UserName) ? user.UserName : "User";
    }

    /// <summary>
    /// Bir kullanıcıyı takipten çık
    /// </summary>
    [HttpDelete("{followingId}")]
    public async Task<IActionResult> Unfollow(string followingId)
    {
        var followerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(followerId)) return Unauthorized();

        var follow = await _db.Follows
            .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);

        if (follow == null)
        {
            return NotFound(new { message = "Takip ilişkisi bulunamadı.", isFollowing = false });
        }

        _db.Follows.Remove(follow);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Takipten çıkıldı.", isFollowing = false });
    }

    /// <summary>
    /// Bir kullanıcıyı takip edip etmediğini kontrol et
    /// </summary>
    [HttpGet("check/{followingId}")]
    public async Task<IActionResult> CheckFollow(string followingId)
    {
        var followerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(followerId)) return Unauthorized();

        var follow = await _db.Follows
            .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);

        var isFollowing = follow != null && follow.Status == FollowStatus.Accepted;
        var status = follow?.Status.ToString().ToLower() ?? "none";

        return Ok(new { isFollowing, status });
    }

    /// <summary>
    /// Kullanıcının takipçilerini getir
    /// </summary>
    [HttpGet("followers/{userId}")]
    public async Task<IActionResult> GetFollowers(string userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwnProfile = !string.IsNullOrEmpty(currentUserId) && currentUserId == userId;

        // Kendi profilinde ise tüm takipçileri göster, değilse sadece kabul edilmiş olanları
        var followers = await _db.Follows
            .Where(f => f.FollowingId == userId && (isOwnProfile || f.Status == FollowStatus.Accepted))
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var followerIds = followers.Select(f => f.FollowerId).ToList();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => followerIds.Contains(u.Id))
            .ToListAsync();
        var userDict = users.ToDictionary(u => u.Id);

        var result = followers.Select(f => {
            var user = userDict.ContainsKey(f.FollowerId) ? userDict[f.FollowerId] : null;
            return new
            {
                userId = f.FollowerId,
                displayName = user != null && !string.IsNullOrWhiteSpace(user.UserName)
                    ? user.UserName // DisplayName kaldırıldı, UserName kullanılıyor
                    : f.FollowerId.Substring(0, 8),
                email = user?.Email ?? string.Empty,
                createdAt = f.CreatedAt
            };
        }).ToList();

        var total = await _db.Follows.CountAsync(f => f.FollowingId == userId && (isOwnProfile || f.Status == FollowStatus.Accepted));

        return Ok(new { items = result, total, page, pageSize });
    }

    /// <summary>
    /// Kullanıcının takip ettiklerini getir
    /// </summary>
    [HttpGet("following/{userId}")]
    public async Task<IActionResult> GetFollowing(string userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isOwnProfile = !string.IsNullOrEmpty(currentUserId) && currentUserId == userId;

        // Kendi profilinde ise tüm takip ettiklerini göster, değilse sadece kabul edilmiş olanları
        var following = await _db.Follows
            .Where(f => f.FollowerId == userId && (isOwnProfile || f.Status == FollowStatus.Accepted))
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var followingIds = following.Select(f => f.FollowingId).ToList();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => followingIds.Contains(u.Id))
            .ToListAsync();
        var userDict = users.ToDictionary(u => u.Id);

        var result = following.Select(f => {
            var user = userDict.ContainsKey(f.FollowingId) ? userDict[f.FollowingId] : null;
            return new
            {
                userId = f.FollowingId,
                displayName = user != null && !string.IsNullOrWhiteSpace(user.UserName)
                    ? user.UserName // DisplayName kaldırıldı, UserName kullanılıyor
                    : f.FollowingId.Substring(0, 8),
                email = user?.Email ?? string.Empty,
                createdAt = f.CreatedAt
            };
        }).ToList();

        var total = await _db.Follows.CountAsync(f => f.FollowerId == userId && (isOwnProfile || f.Status == FollowStatus.Accepted));

        return Ok(new { items = result, total, page, pageSize });
    }

    /// <summary>
    /// Kullanıcının takipçi ve takip edilen sayılarını getir
    /// </summary>
    [HttpGet("counts/{userId}")]
    public async Task<IActionResult> GetCounts(string userId)
    {
        // Sadece kabul edilmiş takipçileri say
        var followerCount = await _db.Follows.CountAsync(f => f.FollowingId == userId && f.Status == FollowStatus.Accepted);
        var followingCount = await _db.Follows.CountAsync(f => f.FollowerId == userId && f.Status == FollowStatus.Accepted);

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var follow = !string.IsNullOrEmpty(currentUserId) 
            ? await _db.Follows.FirstOrDefaultAsync(f => f.FollowerId == currentUserId && f.FollowingId == userId)
            : null;
        
        var isFollowing = follow != null && follow.Status == FollowStatus.Accepted;
        var status = follow?.Status.ToString().ToLower() ?? "none";

        // Kullanıcının kapalı hesap durumunu kontrol et
        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        var isPrivateAccount = user?.IsPrivateAccount ?? false;

        return Ok(new { followerCount, followingCount, isFollowing, status, isPrivateAccount });
    }

    /// <summary>
    /// Bekleyen takip taleplerini getir (sadece kendi hesabı için)
    /// </summary>
    [HttpGet("pending-requests")]
    public async Task<IActionResult> GetPendingRequests([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var pendingFollows = await _db.Follows
            .Where(f => f.FollowingId == userId && f.Status == FollowStatus.Pending)
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var followerIds = pendingFollows.Select(f => f.FollowerId).ToList();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => followerIds.Contains(u.Id))
            .ToListAsync();
        var userDict = users.ToDictionary(u => u.Id);

        var result = pendingFollows.Select(f => {
            var user = userDict.ContainsKey(f.FollowerId) ? userDict[f.FollowerId] : null;
            return new
            {
                userId = f.FollowerId,
                displayName = GetUserDisplayName(user, f.FollowerId),
                email = user?.Email ?? string.Empty,
                createdAt = f.CreatedAt,
                followId = f.Id
            };
        }).ToList();

        var total = await _db.Follows.CountAsync(f => f.FollowingId == userId && f.Status == FollowStatus.Pending);

        return Ok(new { items = result, total, page, pageSize });
    }

    /// <summary>
    /// Takip talebini kabul et
    /// </summary>
    [HttpPost("accept/{followId}")]
    public async Task<IActionResult> AcceptFollowRequest(Guid followId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var follow = await _db.Follows
            .FirstOrDefaultAsync(f => f.Id == followId && f.FollowingId == userId && f.Status == FollowStatus.Pending);

        if (follow == null)
        {
            return NotFound(new { message = "Takip talebi bulunamadı." });
        }

        follow.Status = FollowStatus.Accepted;
        await _db.SaveChangesAsync();

        // Bildirim oluştur (takip eden kullanıcıya - dil desteği ile)
        var followingUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        var followerUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == follow.FollowerId);
        
        // Kullanıcının dil tercihini al
        var userLanguage = followerUser?.UiLanguage ?? "en";
        var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
        
        var followingName = GetUserDisplayName(followingUser, userId);
        var title = isTurkish ? "Takip talebi kabul edildi" : "Follow request accepted";
        var message = isTurkish
            ? $"{followingName} takip talebinizi kabul etti."
            : $"{followingName} accepted your follow request.";
        
        await _notificationService.NotifyAsync(
            NotificationEventType.FollowRequestAccepted,
            new NotificationPayload(
                RecipientUserId: follow.FollowerId,
                Title: title,
                Message: message,
                ActorUserId: userId,
                RelatedFollowId: follow.Id.ToString()
            )
        );

        return Ok(new { message = "Takip talebi kabul edildi." });
    }

    /// <summary>
    /// Takip talebini reddet
    /// </summary>
    [HttpPost("reject/{followId}")]
    public async Task<IActionResult> RejectFollowRequest(Guid followId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var follow = await _db.Follows
            .FirstOrDefaultAsync(f => f.Id == followId && f.FollowingId == userId && f.Status == FollowStatus.Pending);

        if (follow == null)
        {
            return NotFound(new { message = "Takip talebi bulunamadı." });
        }

        _db.Follows.Remove(follow);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Takip talebi reddedildi." });
    }
}

