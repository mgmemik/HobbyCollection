using HobbyCollection.Domain.Entities;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Yeni ürün bildirimlerini toplu (batch) gönderir: Takipçiler tek tek her ürün için değil,
/// belirli bir pencere içinde tek bir özet bildirim alır (örn. "X 5 yeni ürün ekledi").
/// Modern uygulamalardaki gibi spam önleme ve özet bildirim.
/// </summary>
public class NewProductNotificationBatchService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NewProductNotificationBatchService> _logger;

    private static readonly TimeSpan RunInterval = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan ActivityWindow = TimeSpan.FromHours(1);   // Son 1 saat içinde eklenen ürünler toplanır
    private static readonly TimeSpan RecentActivity = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan ThrottleWindow = TimeSpan.FromHours(1);   // Aynı (takipçi, aktör) için en fazla 1 saatte bir bildirim

    public NewProductNotificationBatchService(
        IServiceProvider serviceProvider,
        ILogger<NewProductNotificationBatchService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("New Product Notification Batch Service başlatıldı.");
        await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);
        _logger.LogInformation("New Product Notification Batch Service aktif.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchedNewProductNotificationsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Yeni ürün toplu bildirim işlenirken hata.");
            }

            await Task.Delay(RunInterval, stoppingToken);
        }
    }

    private async Task ProcessBatchedNewProductNotificationsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var usernameService = scope.ServiceProvider.GetRequiredService<UsernameService>();

        var now = DateTime.UtcNow;
        var recentStart = now - RecentActivity;
        var windowStart = now - ActivityWindow;
        var throttleSince = now - ThrottleWindow;

        var actorIds = await db.Products
            .Where(p => p.IsPublic && p.CreatedAt >= recentStart && p.CreatedAt <= now)
            .Select(p => p.UserId)
            .Distinct()
            .ToListAsync();

        if (actorIds.Count == 0)
            return;

        foreach (var actorId in actorIds)
        {
            try
            {
                var alreadySentForActor = await db.Notifications
                    .AnyAsync(n => n.Type == "new_product" && n.RelatedUserId == actorId && n.CreatedAt >= throttleSince);

                if (alreadySentForActor)
                    continue;

                var productsInWindow = await db.Products
                    .Where(p => p.UserId == actorId && p.IsPublic && p.CreatedAt >= windowStart)
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new { p.Id, p.Title })
                    .ToListAsync();

                var count = productsInWindow.Count;
                if (count == 0)
                    continue;

                var latestProduct = productsInWindow.First();
                var latestProductId = latestProduct.Id;

                var followers = await db.Follows
                    .Where(f => f.FollowingId == actorId && f.Status == FollowStatus.Accepted)
                    .Select(f => f.FollowerId)
                    .ToListAsync();

                if (followers.Count == 0)
                    continue;

                var alreadyNotifiedUserIds = await db.Notifications
                    .Where(n => n.Type == "new_product" && n.RelatedUserId == actorId && n.CreatedAt >= throttleSince)
                    .Select(n => n.UserId)
                    .Distinct()
                    .ToListAsync();

                var toNotify = followers.Except(alreadyNotifiedUserIds).ToList();
                if (toNotify.Count == 0)
                    continue;

                var actorUser = await db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId);
                var ownerDisplayName = GetDisplayName(usernameService, actorUser, actorId);

                foreach (var followerId in toNotify)
                {
                    try
                    {
                        var followerUser = await db.Users.OfType<ApplicationUser>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == followerId);
                        var lang = followerUser?.UiLanguage ?? "en";
                        var isTr = lang.StartsWith("tr", StringComparison.OrdinalIgnoreCase);

                        string title = isTr ? "Yeni ürün" : "New product";
                        string message;
                        if (count == 1)
                        {
                            message = isTr
                                ? $"{ownerDisplayName} yeni bir ürün ekledi: {latestProduct.Title}"
                                : $"{ownerDisplayName} added a new product: {latestProduct.Title}";
                        }
                        else
                        {
                            message = isTr
                                ? $"{ownerDisplayName} {count} yeni ürün ekledi"
                                : $"{ownerDisplayName} added {count} new products";
                        }

                        await notificationService.NotifyAsync(
                            NotificationEventType.NewProduct,
                            new NotificationPayload(
                                RecipientUserId: followerId,
                                Title: title,
                                Message: message,
                                ActorUserId: actorId,
                                RelatedProductId: latestProductId
                            )
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Takipçi {FollowerId} için toplu yeni ürün bildirimi gönderilemedi.", followerId);
                    }
                }

                _logger.LogInformation(
                    "Yeni ürün toplu bildirim: {ActorId} için {Count} ürün, {ToNotify} takipçiye gönderildi.",
                    actorId, count, toNotify.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Aktör {ActorId} için toplu yeni ürün bildirimi işlenirken hata.", actorId);
            }
        }
    }

    private static string GetDisplayName(UsernameService usernameService, ApplicationUser? user, string userId)
    {
        if (user == null) return "User";
        var name = usernameService.GetUserCurrentUsername(user);
        return !string.IsNullOrWhiteSpace(name) ? name : "User";
    }
}
