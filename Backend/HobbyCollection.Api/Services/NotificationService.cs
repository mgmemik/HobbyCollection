using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HobbyCollection.Api.Services;

[Flags]
public enum NotificationChannel
{
    None = 0,
    InApp = 1,
    Push = 2,
}

/// <summary>
/// Sistemde oluşan event'lere göre Notification (DB) ve/veya Push dispatch eden tek merkez servis.
/// </summary>
public interface INotificationService
{
    Task NotifyAsync(NotificationEventType eventType, NotificationPayload payload, CancellationToken ct = default);
}

/// <summary>
/// Event bazlı karar verebilmek için type-safe event listesi.
/// (DB'deki Notification.Type alanı string olarak kalır; bu enum onun "katalog" halidir.)
/// </summary>
public enum NotificationEventType
{
    Follow,                 // "follow"
    FollowRequest,          // "follow_request"
    FollowRequestAccepted,  // "follow_request_accepted"
    ProductLike,            // "product_like"
    Comment,                // "comment"
    CommentLike,            // "comment_like"
    Message,                // "message"
    NewProduct,             // "new_product"
    AICreditCharged,        // "ai_credit_charged"
}

public sealed record NotificationPayload(
    string RecipientUserId,
    string Title,
    string? Message,
    string? ActorUserId = null,
    Guid? RelatedProductId = null,
    Guid? RelatedCommentId = null,
    Guid? RelatedConversationId = null,
    string? RelatedFollowId = null
);

public class NotificationService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly ILogger<NotificationService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public NotificationService(AppDbContext db, ILogger<NotificationService> logger, IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    // Tek yerden karar: Bu event sadece in-app mi, yoksa in-app+push mı?
    // İleride config'e (DB/appsettings) taşınabilir; şimdilik hardcoded.
    private static readonly IReadOnlyDictionary<NotificationEventType, NotificationChannel> ChannelMap =
        new Dictionary<NotificationEventType, NotificationChannel>
        {
            [NotificationEventType.Follow] = NotificationChannel.InApp | NotificationChannel.Push,
            [NotificationEventType.FollowRequest] = NotificationChannel.InApp | NotificationChannel.Push,
            // Takip isteği kabul edildi: sadece app
            [NotificationEventType.FollowRequestAccepted] = NotificationChannel.InApp,
            [NotificationEventType.ProductLike] = NotificationChannel.InApp | NotificationChannel.Push,
            [NotificationEventType.Comment] = NotificationChannel.InApp | NotificationChannel.Push,
            // Şu an comment_like DB'ye yazılıyor ama push yoktu. Burada tek satırla karar veriyoruz:
            [NotificationEventType.CommentLike] = NotificationChannel.InApp, // İsterseniz sonra Push ekleriz
            [NotificationEventType.Message] = NotificationChannel.InApp | NotificationChannel.Push,
            // New Product: toplu bildirim (batch) ile takipçilere tek özet; in-app + push
            [NotificationEventType.NewProduct] = NotificationChannel.InApp | NotificationChannel.Push,
            // Yeni kredi yüklendi: push + app
            [NotificationEventType.AICreditCharged] = NotificationChannel.InApp | NotificationChannel.Push,
        };

    private static string ToWireType(NotificationEventType eventType) =>
        eventType switch
        {
            NotificationEventType.Follow => "follow",
            NotificationEventType.FollowRequest => "follow_request",
            NotificationEventType.FollowRequestAccepted => "follow_request_accepted",
            NotificationEventType.ProductLike => "product_like",
            NotificationEventType.Comment => "comment",
            NotificationEventType.CommentLike => "comment_like",
            NotificationEventType.Message => "message",
            NotificationEventType.NewProduct => "new_product",
            NotificationEventType.AICreditCharged => "ai_credit_charged",
            _ => throw new ArgumentOutOfRangeException(nameof(eventType), eventType, "Unknown notification event type"),
        };

    public async Task NotifyAsync(NotificationEventType eventType, NotificationPayload payload, CancellationToken ct = default)
    {
        var channels = ChannelMap.TryGetValue(eventType, out var ch) ? ch : NotificationChannel.InApp;
        if (channels == NotificationChannel.None)
        {
            _logger.LogInformation("Notification skipped (None) for event {EventType}", eventType);
            return;
        }

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = payload.RecipientUserId,
            Type = ToWireType(eventType),
            Title = payload.Title,
            Message = payload.Message,
            RelatedUserId = payload.ActorUserId,
            RelatedProductId = payload.RelatedProductId,
            RelatedCommentId = payload.RelatedCommentId,
            RelatedConversationId = payload.RelatedConversationId,
            RelatedFollowId = payload.RelatedFollowId,
            IsRead = false,
            CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
        };

        if (channels.HasFlag(NotificationChannel.InApp))
        {
            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync(ct);
        }

        if (channels.HasFlag(NotificationChannel.Push))
        {
            // Request scope'taki DbContext/servisleri Task.Run'a taşımayalım: yeni scope ile push gönder.
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var push = scope.ServiceProvider.GetService<PushNotificationService>();
                    if (push == null) return;
                    await push.SendNotificationAsync(notification);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send push for notification event {EventType}", eventType);
                }
            });
        }
    }
}

