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
public class CommentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<CommentsController> _logger;
    private readonly INotificationService _notificationService;

    public CommentsController(AppDbContext db, ILogger<CommentsController> logger, INotificationService notificationService)
    {
        _db = db;
        _logger = logger;
        _notificationService = notificationService;
    }

    // Helper method: Username döndürür (DisplayName kaldırıldı)
    private string GetUserDisplayName(ApplicationUser? user, string userId)
    {
        if (user == null) return "User";
        
        // DisplayName kaldırıldı - sadece UserName kullan
        return !string.IsNullOrWhiteSpace(user.UserName) ? user.UserName : "User";
    }

    // Yorum ekle
    [HttpPost("{productId}")]
    [Authorize]
    public async Task<IActionResult> CreateComment(Guid productId, [FromBody] CreateCommentRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        // Ürünü kontrol et
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.IsPublic == true);
        if (product == null) return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");

        // Yorumlar açık mı kontrol et
        if (!product.CommentsEnabled) return BadRequest("Bu ürün için yorumlar kapalı.");

        if (string.IsNullOrWhiteSpace(request.Text) || request.Text.Length > 1000)
        {
            return BadRequest("Yorum metni 1-1000 karakter arasında olmalıdır.");
        }

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            UserId = userId,
            Text = request.Text.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Comments.Add(comment);
        await _db.SaveChangesAsync();

        // Bildirim oluştur (ürün sahibine, kendisi yorum yapmadıysa - dil desteği ile)
        if (product.UserId != userId)
        {
            var actor = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
            var productOwner = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == product.UserId);
            
            // Kullanıcının dil tercihini al
            var userLanguage = productOwner?.UiLanguage ?? "en";
            var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
            
            var actorName = GetUserDisplayName(actor, userId);
            var title = isTurkish ? "Yeni yorum" : "New comment";
            var message = isTurkish
                ? $"{actorName} ürününüze yorum yaptı."
                : $"{actorName} commented on your product.";
            
            await _notificationService.NotifyAsync(
                NotificationEventType.Comment,
                new NotificationPayload(
                    RecipientUserId: product.UserId,
                    Title: title,
                    Message: message,
                    ActorUserId: userId,
                    RelatedProductId: productId,
                    RelatedCommentId: comment.Id
                )
            );
        }

        // Kullanıcı bilgisini al
        var commentUser = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        var likeCount = await _db.CommentLikes.CountAsync(cl => cl.CommentId == comment.Id);
        var isLiked = false; // Yeni yorum, henüz beğenilmemiş

        return Ok(new
        {
            comment.Id,
            comment.Text,
            comment.CreatedAt,
            UserId = comment.UserId,
            User = GetUserDisplayName(commentUser, userId),
            UserAvatarUrl = commentUser?.AvatarUrl,
            LikeCount = likeCount,
            IsLiked = isLiked
        });
    }

    // Yorumları getir
    [HttpGet("{productId}")]
    public async Task<IActionResult> GetComments(Guid productId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.IsPublic == true);
        if (product == null) return NotFound("Ürün bulunamadı veya paylaşıma açık değil.");

        // Yorumlar kapalıysa boş liste döndür
        if (!product.CommentsEnabled)
        {
            return Ok(new { total = 0, page, pageSize, items = new List<object>() });
        }

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var total = await _db.Comments.CountAsync(c => c.ProductId == productId);

        var comments = await _db.Comments
            .Where(c => c.ProductId == productId)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userIds = comments.Select(c => c.UserId).Distinct().ToList();
        var users = await _db.Users.OfType<ApplicationUser>()
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();
        var userDict = users.ToDictionary(u => u.Id, u => u);

        var commentIds = comments.Select(c => c.Id).ToList();
        var likeCounts = await _db.CommentLikes
            .Where(cl => commentIds.Contains(cl.CommentId))
            .GroupBy(cl => cl.CommentId)
            .Select(g => new { CommentId = g.Key, Count = g.Count() })
            .ToListAsync();
        var likeCountMap = likeCounts.ToDictionary(x => x.CommentId, x => x.Count);

        var likedCommentIds = new HashSet<Guid>();
        if (!string.IsNullOrEmpty(currentUserId))
        {
            var likedIds = await _db.CommentLikes
                .Where(cl => cl.UserId == currentUserId && commentIds.Contains(cl.CommentId))
                .Select(cl => cl.CommentId)
                .ToListAsync();
            likedCommentIds = new HashSet<Guid>(likedIds);
        }

        var result = comments.Select(c =>
        {
            var user = userDict.ContainsKey(c.UserId) ? userDict[c.UserId] : null;
            return new
            {
                c.Id,
                c.Text,
                c.CreatedAt,
                c.UpdatedAt,
                UserId = c.UserId,
                User = GetUserDisplayName(user, c.UserId),
                UserAvatarUrl = user?.AvatarUrl,
                LikeCount = likeCountMap.ContainsKey(c.Id) ? likeCountMap[c.Id] : 0,
                IsLiked = likedCommentIds.Contains(c.Id)
            };
        }).ToList();

        return Ok(new { total, page, pageSize, items = result });
    }

    // Yorum sil
    [HttpDelete("{commentId}")]
    [Authorize]
    public async Task<IActionResult> DeleteComment(Guid commentId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var comment = await _db.Comments
            .Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.Id == commentId);

        if (comment == null) return NotFound("Yorum bulunamadı.");

        // Sadece yorum sahibi veya ürün sahibi silebilir
        if (comment.UserId != userId && comment.Product?.UserId != userId)
        {
            return Forbid("Bu yorumu silme yetkiniz yok.");
        }

        _db.Comments.Remove(comment);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Yorum silindi." });
    }

    // Yorum güncelle
    [HttpPut("{commentId}")]
    [Authorize]
    public async Task<IActionResult> UpdateComment(Guid commentId, [FromBody] UpdateCommentRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == commentId && c.UserId == userId);
        if (comment == null) return NotFound("Yorum bulunamadı veya yetkiniz yok.");

        if (string.IsNullOrWhiteSpace(request.Text) || request.Text.Length > 1000)
        {
            return BadRequest("Yorum metni 1-1000 karakter arasında olmalıdır.");
        }

        comment.Text = request.Text.Trim();
        comment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { comment.Id, comment.Text, comment.UpdatedAt });
    }

    // Yorum beğen
    [HttpPost("{commentId}/like")]
    [Authorize]
    public async Task<IActionResult> LikeComment(Guid commentId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var comment = await _db.Comments
            .Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.Id == commentId);
        if (comment == null) return NotFound("Yorum bulunamadı.");

        var already = await _db.CommentLikes.AnyAsync(cl => cl.CommentId == commentId && cl.UserId == userId);
        if (!already)
        {
            _db.CommentLikes.Add(new CommentLike
            {
                Id = Guid.NewGuid(),
                CommentId = commentId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Unique constraint race condition; ignore if inserted by another request
            }

            // Bildirim oluştur (yorum sahibine, kendisi beğenmediyse - dil desteği ile)
            if (comment.UserId != userId)
            {
                var actor = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
                var commentOwner = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == comment.UserId);
                
                // Kullanıcının dil tercihini al
                var userLanguage = commentOwner?.UiLanguage ?? "en";
                var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
                
                var actorName = GetUserDisplayName(actor, userId);
                var title = isTurkish ? "Yorumunuz beğenildi" : "Your comment was liked";
                var message = isTurkish
                    ? $"{actorName} yorumunuzu beğendi."
                    : $"{actorName} liked your comment.";
                
                await _notificationService.NotifyAsync(
                    NotificationEventType.CommentLike,
                    new NotificationPayload(
                        RecipientUserId: comment.UserId,
                        Title: title,
                        Message: message,
                        ActorUserId: userId,
                        RelatedProductId: comment.ProductId,
                        RelatedCommentId: commentId
                    )
                );
            }
        }

        var likeCount = await _db.CommentLikes.CountAsync(cl => cl.CommentId == commentId);
        return Ok(new { likeCount, isLiked = true });
    }

    // Yorum beğenisini kaldır
    [HttpDelete("{commentId}/like")]
    [Authorize]
    public async Task<IActionResult> UnlikeComment(Guid commentId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var like = await _db.CommentLikes.FirstOrDefaultAsync(cl => cl.CommentId == commentId && cl.UserId == userId);
        if (like != null)
        {
            _db.CommentLikes.Remove(like);
            await _db.SaveChangesAsync();
        }

        var likeCount = await _db.CommentLikes.CountAsync(cl => cl.CommentId == commentId);
        return Ok(new { likeCount, isLiked = false });
    }

    public class CreateCommentRequest
    {
        public string Text { get; set; } = string.Empty;
    }

    public class UpdateCommentRequest
    {
        public string Text { get; set; } = string.Empty;
    }
}

