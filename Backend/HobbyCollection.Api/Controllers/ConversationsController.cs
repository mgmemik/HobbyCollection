using System.Security.Claims;
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ConversationsController> _logger;

    public ConversationsController(AppDbContext db, ILogger<ConversationsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // Helper method: DisplayName yoksa email'den otomatik isim üret
    // Helper method: Username döndürür (DisplayName kaldırıldı)
    private string GetUserDisplayName(ApplicationUser? user, string userId)
    {
        if (user == null) return "User";
        
        // DisplayName kaldırıldı - sadece UserName kullan
        return !string.IsNullOrWhiteSpace(user.UserName) ? user.UserName : "User";
    }

    /// <summary>
    /// Kullanıcının tüm konuşmalarını getirir (inbox)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetConversations()
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId))
        {
            return Unauthorized();
        }

        // Kullanıcının konuşmalarını getir (silinmemiş olanlar)
        var conversations = await _db.Conversations
            .Where(c => 
                (c.User1Id == currentUserId && !c.IsDeletedByUser1) ||
                (c.User2Id == currentUserId && !c.IsDeletedByUser2)
            )
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
            .ToListAsync();

        // Kullanıcı bilgilerini topla
        var userIds = conversations
            .SelectMany(c => new[] { c.User1Id, c.User2Id })
            .Where(id => id != currentUserId)
            .Distinct()
            .ToList();

        var users = await _db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToListAsync();

        var userDict = users.ToDictionary(u => u.Id);

        var result = conversations.Select(c =>
        {
            var otherUserId = c.User1Id == currentUserId ? c.User2Id : c.User1Id;
            var otherUser = userDict.ContainsKey(otherUserId) ? userDict[otherUserId] as ApplicationUser : null;
            var unreadCount = c.User1Id == currentUserId ? c.UnreadCountUser1 : c.UnreadCountUser2;
            
            var displayName = GetUserDisplayName(otherUser, otherUserId);

            return new
            {
                id = c.Id.ToString(),
                otherUserId = otherUserId,
                otherUserDisplayName = displayName,
                otherUserUsername = otherUser?.UserName ?? "",
                otherUserAvatarUrl = otherUser?.AvatarUrl,
                lastMessage = c.LastMessageText,
                lastMessageAt = c.LastMessageAt,
                lastMessageSenderId = c.LastMessageSenderId,
                unreadCount = unreadCount,
                isLastMessageFromMe = c.LastMessageSenderId == currentUserId,
                createdAt = c.CreatedAt,
                updatedAt = c.UpdatedAt
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Belirli bir kullanıcıyla konuşmayı getirir veya oluşturur
    /// </summary>
    [HttpGet("with/{otherUserId}")]
    public async Task<IActionResult> GetOrCreateConversation(string otherUserId)
    {
        try
        {
            _logger.LogInformation("GetOrCreateConversation - Request: OtherUserId={OtherUserId}", otherUserId);
            
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
            {
                _logger.LogWarning("GetOrCreateConversation - Unauthorized: CurrentUserId is empty");
                return Unauthorized(new { message = "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın." });
            }

            _logger.LogInformation("GetOrCreateConversation - CurrentUserId={CurrentUserId}, OtherUserId={OtherUserId}", 
                currentUserId, otherUserId);

            if (currentUserId == otherUserId)
            {
                _logger.LogWarning("GetOrCreateConversation - BadRequest: User trying to create conversation with themselves");
                return BadRequest(new { message = "Kendinizle konuşma oluşturamazsınız." });
            }

            // Diğer kullanıcının varlığını kontrol et
            var otherUserExists = await _db.Users.AnyAsync(u => u.Id == otherUserId);
            if (!otherUserExists)
            {
                _logger.LogWarning("GetOrCreateConversation - NotFound: OtherUserId={OtherUserId} not found", otherUserId);
                return NotFound(new { message = "Kullanıcı bulunamadı." });
            }

            _logger.LogInformation("GetOrCreateConversation - Other user exists, searching for conversation...");

            // Mevcut konuşmayı bul (User1Id ve User2Id sırası önemli değil)
            var conversation = await _db.Conversations
                .FirstOrDefaultAsync(c =>
                    (c.User1Id == currentUserId && c.User2Id == otherUserId) ||
                    (c.User1Id == otherUserId && c.User2Id == currentUserId)
                );

            if (conversation == null)
            {
                _logger.LogInformation("GetOrCreateConversation - No existing conversation found, creating new one...");
                
                // Yeni konuşma oluştur (User1Id < User2Id sıralaması ile)
                var userId1 = string.Compare(currentUserId, otherUserId, StringComparison.Ordinal) < 0 
                    ? currentUserId 
                    : otherUserId;
                var userId2 = userId1 == currentUserId ? otherUserId : currentUserId;

                conversation = new Conversation
                {
                    User1Id = userId1,
                    User2Id = userId2,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Conversations.Add(conversation);
                await _db.SaveChangesAsync();
                
                _logger.LogInformation("GetOrCreateConversation - New conversation created: Id={ConversationId}", conversation.Id);
            }
            else
            {
                _logger.LogInformation("GetOrCreateConversation - Existing conversation found: Id={ConversationId}", conversation.Id);
                
                // Konuşma silinmişse, tekrar aktif et
                if (conversation.User1Id == currentUserId && conversation.IsDeletedByUser1)
                {
                    conversation.IsDeletedByUser1 = false;
                    _logger.LogInformation("GetOrCreateConversation - Reactivated conversation (User1)");
                }
                else if (conversation.User2Id == currentUserId && conversation.IsDeletedByUser2)
                {
                    conversation.IsDeletedByUser2 = false;
                    _logger.LogInformation("GetOrCreateConversation - Reactivated conversation (User2)");
                }
                await _db.SaveChangesAsync();
            }

            // Diğer kullanıcı bilgilerini al
            var otherUser = await _db.Users.FindAsync(otherUserId) as ApplicationUser;
            var unreadCount = conversation.User1Id == currentUserId 
                ? conversation.UnreadCountUser1 
                : conversation.UnreadCountUser2;

            var displayName = GetUserDisplayName(otherUser, otherUserId);

            var response = new
            {
                id = conversation.Id.ToString(),
                otherUserId = otherUserId,
                otherUserDisplayName = displayName,
                otherUserUsername = otherUser?.UserName ?? "",
                otherUserAvatarUrl = otherUser?.AvatarUrl,
                lastMessage = conversation.LastMessageText,
                lastMessageAt = conversation.LastMessageAt,
                lastMessageSenderId = conversation.LastMessageSenderId,
                unreadCount = unreadCount,
                isLastMessageFromMe = conversation.LastMessageSenderId == currentUserId,
                createdAt = conversation.CreatedAt,
                updatedAt = conversation.UpdatedAt
            };
            
            _logger.LogInformation("GetOrCreateConversation - Success: Id={Id}, OtherUserId={OtherUserId}, DisplayName={DisplayName}", 
                response.id, response.otherUserId, response.otherUserDisplayName);
            
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetOrCreateConversation - Exception: CurrentUserId={CurrentUserId}, OtherUserId={OtherUserId}", 
                User.FindFirstValue(ClaimTypes.NameIdentifier), otherUserId);
            return StatusCode(500, new { message = "Konuşma oluşturulurken bir hata oluştu.", error = ex.Message });
        }
    }

    /// <summary>
    /// Konuşmayı siler (soft delete)
    /// </summary>
    [HttpDelete("{conversationId}")]
    public async Task<IActionResult> DeleteConversation(Guid conversationId)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId))
        {
            return Unauthorized();
        }

        var conversation = await _db.Conversations.FindAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { message = "Konuşma bulunamadı." });
        }

        // Kullanıcının bu konuşmaya erişimi var mı kontrol et
        if (conversation.User1Id != currentUserId && conversation.User2Id != currentUserId)
        {
            return Forbid();
        }

        // Soft delete
        if (conversation.User1Id == currentUserId)
        {
            conversation.IsDeletedByUser1 = true;
        }
        else
        {
            conversation.IsDeletedByUser2 = true;
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Konuşma silindi." });
    }
}

