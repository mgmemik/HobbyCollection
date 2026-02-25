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
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<MessagesController> _logger;
    private readonly INotificationService _notificationService;

    public MessagesController(AppDbContext db, ILogger<MessagesController> logger, INotificationService notificationService)
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

    /// <summary>
    /// Bir konuşmaya mesaj gönderir
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest(new { message = "Mesaj içeriği boş olamaz." });
        }

        // Konuşmayı bul ve kontrol et
        var conversation = await _db.Conversations.FindAsync(request.ConversationId);
        if (conversation == null)
        {
            return NotFound(new { message = "Konuşma bulunamadı." });
        }

        // Kullanıcının bu konuşmaya erişimi var mı kontrol et
        if (conversation.User1Id != currentUserId && conversation.User2Id != currentUserId)
        {
            return Forbid();
        }

        // Konuşma silinmişse, tekrar aktif et
        if (conversation.User1Id == currentUserId && conversation.IsDeletedByUser1)
        {
            conversation.IsDeletedByUser1 = false;
        }
        else if (conversation.User2Id == currentUserId && conversation.IsDeletedByUser2)
        {
            conversation.IsDeletedByUser2 = false;
        }

        // Alıcı ID'sini belirle
        var receiverId = conversation.User1Id == currentUserId 
            ? conversation.User2Id 
            : conversation.User1Id;

        // Mesaj oluştur
        var message = new Message
        {
            ConversationId = request.ConversationId,
            SenderId = currentUserId,
            ReceiverId = receiverId,
            Type = request.Type ?? MessageType.Text,
            Content = request.Content.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Messages.Add(message);

        // Konuşmayı güncelle
        conversation.LastMessageText = request.Content.Trim();
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.LastMessageSenderId = currentUserId;
        conversation.UpdatedAt = DateTime.UtcNow;

        // Okunmamış mesaj sayısını artır (alıcı için)
        if (conversation.User1Id == receiverId)
        {
            conversation.UnreadCountUser1++;
        }
        else
        {
            conversation.UnreadCountUser2++;
        }

        // Gönderenin okunmamış sayısını sıfırla (eğer varsa)
        if (conversation.User1Id == currentUserId)
        {
            conversation.UnreadCountUser1 = 0;
        }
        else
        {
            conversation.UnreadCountUser2 = 0;
        }

        await _db.SaveChangesAsync();

        // Bildirim oluştur (alıcıya)
        if (receiverId != currentUserId)
        {
            try
            {
                var senderUser = await _db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == currentUserId);
                var receiverUser = await _db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == receiverId);
                
                // Kullanıcının dil tercihini al
                var userLanguage = receiverUser?.UiLanguage ?? "en";
                var isTurkish = userLanguage.StartsWith("tr", StringComparison.OrdinalIgnoreCase);
                
                var senderName = GetUserDisplayName(senderUser, currentUserId);
                var preview = request.Content.Trim();
                if (preview.Length > 140) preview = preview.Substring(0, 140) + "...";
                
                var title = isTurkish ? "Yeni mesaj" : "New message";
                
                await _notificationService.NotifyAsync(
                    NotificationEventType.Message,
                    new NotificationPayload(
                        RecipientUserId: receiverId,
                        Title: title,
                        Message: $"{senderName}: {preview}",
                        ActorUserId: currentUserId,
                        RelatedConversationId: request.ConversationId
                    )
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create/send message notification");
            }
        }

        return Ok(new
        {
            message.Id,
            message.ConversationId,
            message.SenderId,
            message.ReceiverId,
            message.Type,
            message.Content,
            message.IsRead,
            message.CreatedAt
        });
    }

    /// <summary>
    /// Bir konuşmadaki mesajları getirir
    /// </summary>
    [HttpGet("conversation/{conversationId}")]
    public async Task<IActionResult> GetMessages(Guid conversationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId))
        {
            return Unauthorized();
        }

        // Konuşmayı bul ve kontrol et
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

        // Mesajları getir (silinmemiş olanlar - kullanıcı kendi tarafından silmediyse göster)
        var messages = await _db.Messages
            .Where(m => m.ConversationId == conversationId &&
                       !(m.SenderId == currentUserId && m.IsDeletedBySender) &&
                       !(m.ReceiverId == currentUserId && m.IsDeletedByReceiver))
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(m => m.CreatedAt) // Sayfalama için tekrar sırala
            .ToListAsync();

        // Gönderen kullanıcı bilgilerini al
        var senderIds = messages.Select(m => m.SenderId).Distinct().ToList();
        var senders = await _db.Users
            .Where(u => senderIds.Contains(u.Id))
            .ToListAsync();
        var senderDict = senders.ToDictionary(u => u.Id);

        var result = messages.Select(m =>
        {
            var sender = senderDict.ContainsKey(m.SenderId) ? senderDict[m.SenderId] as ApplicationUser : null;
            return new
            {
                m.Id,
                m.ConversationId,
                m.SenderId,
                SenderDisplayName = GetUserDisplayName(sender, m.SenderId),
                SenderAvatarUrl = sender?.AvatarUrl,
                m.ReceiverId,
                m.Type,
                m.Content,
                m.IsRead,
                m.ReadAt,
                m.CreatedAt,
                IsFromMe = m.SenderId == currentUserId
            };
        }).ToList();

        return Ok(new
        {
            Messages = result,
            Page = page,
            PageSize = pageSize,
            TotalCount = await _db.Messages.CountAsync(m => 
                m.ConversationId == conversationId &&
                !(m.SenderId == currentUserId && m.IsDeletedBySender) &&
                !(m.ReceiverId == currentUserId && m.IsDeletedByReceiver))
        });
    }

    /// <summary>
    /// Mesajları okundu olarak işaretler
    /// </summary>
    [HttpPut("{conversationId}/read")]
    public async Task<IActionResult> MarkAsRead(Guid conversationId)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId))
        {
            return Unauthorized();
        }

        // Konuşmayı bul ve kontrol et
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

        // Okunmamış mesajları okundu olarak işaretle
        var unreadMessages = await _db.Messages
            .Where(m => m.ConversationId == conversationId && 
                       m.ReceiverId == currentUserId && 
                       !m.IsRead)
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var message in unreadMessages)
        {
            message.IsRead = true;
            message.ReadAt = now;
        }

        // Konuşmadaki okunmamış sayısını sıfırla
        if (conversation.User1Id == currentUserId)
        {
            conversation.UnreadCountUser1 = 0;
        }
        else
        {
            conversation.UnreadCountUser2 = 0;
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Mesajlar okundu olarak işaretlendi.", readCount = unreadMessages.Count });
    }

    /// <summary>
    /// Bir mesajı siler (soft delete - sadece kendi tarafından görünmez olur)
    /// </summary>
    [HttpDelete("{messageId}")]
    public async Task<IActionResult> DeleteMessage(Guid messageId)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentUserId))
        {
            return Unauthorized();
        }

        // Mesajı bul
        var message = await _db.Messages.FindAsync(messageId);
        if (message == null)
        {
            return NotFound(new { message = "Mesaj bulunamadı." });
        }

        // Kullanıcının bu mesaja erişimi var mı kontrol et
        if (message.SenderId != currentUserId && message.ReceiverId != currentUserId)
        {
            return Forbid();
        }

        // Soft delete - gönderen ise IsDeletedBySender, alıcı ise IsDeletedByReceiver
        if (message.SenderId == currentUserId)
        {
            message.IsDeletedBySender = true;
        }
        else
        {
            message.IsDeletedByReceiver = true;
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Mesaj silindi." });
    }
}

public record SendMessageRequest(
    Guid ConversationId,
    string Content,
    MessageType? Type = null
);

