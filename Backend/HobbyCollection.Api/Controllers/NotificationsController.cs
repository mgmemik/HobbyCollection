using System.Security.Claims;
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(AppDbContext db, ILogger<NotificationsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // Bildirimleri getir
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var total = await _db.Notifications.CountAsync(n => n.UserId == userId);

        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = notifications.Select(n => new
        {
            n.Id,
            n.UserId,
            n.Type,
            n.Title,
            n.Message,
            RelatedProductId = n.RelatedProductId?.ToString(),
            RelatedCommentId = n.RelatedCommentId?.ToString(),
            RelatedConversationId = n.RelatedConversationId?.ToString(),
            RelatedUserId = n.RelatedUserId,
            RelatedFollowId = n.RelatedFollowId,
            n.IsRead,
            n.CreatedAt
        }).ToList();

        return Ok(new { total, page, pageSize, items = result });
    }

    // Bildirimi okundu olarak işaretle
    [HttpPost("{id}/read")]
    [Authorize]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (notification == null) return NotFound("Bildirim bulunamadı.");

        notification.IsRead = true;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Bildirim okundu olarak işaretlendi." });
    }

    // Tüm bildirimleri okundu olarak işaretle
    [HttpPost("read-all")]
    [Authorize]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(setters => setters.SetProperty(n => n.IsRead, true));

        return Ok(new { message = "Tüm bildirimler okundu olarak işaretlendi." });
    }

    // Okunmamış bildirim sayısını getir
    [HttpGet("unread-count")]
    [Authorize]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var count = await _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        return Ok(new { count });
    }
}

