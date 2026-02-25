using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Infrastructure;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CategoryClosure> CategoryClosures => Set<CategoryClosure>();
    public DbSet<CategoryTranslation> CategoryTranslations => Set<CategoryTranslation>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductPhoto> ProductPhotos => Set<ProductPhoto>();
    public DbSet<ProductBadgeInfo> ProductBadges => Set<ProductBadgeInfo>();
    public DbSet<ProductLike> ProductLikes => Set<ProductLike>();
    public DbSet<ProductSave> ProductSaves => Set<ProductSave>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<CommentLike> CommentLikes => Set<CommentLike>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Follow> Follows => Set<Follow>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<AnalysisLog> AnalysisLogs => Set<AnalysisLog>();
    public DbSet<AnalysisLogEntry> AnalysisLogEntries => Set<AnalysisLogEntry>();
    public DbSet<LoginLog> LoginLogs => Set<LoginLog>();
    public DbSet<SearchLog> SearchLogs => Set<SearchLog>();
    public DbSet<UserDeviceInfo> UserDeviceInfos => Set<UserDeviceInfo>();

    // AI Credits System
    public DbSet<AICreditPackage> AICreditPackages => Set<AICreditPackage>();
    public DbSet<AIOperationCost> AIOperationCosts => Set<AIOperationCost>();
    public DbSet<UserAICredit> UserAICredits => Set<UserAICredit>();
    public DbSet<AICreditTransaction> AICreditTransactions => Set<AICreditTransaction>();

    // Entitlement System (Premium subscriptions)
    public DbSet<UserEntitlement> UserEntitlements => Set<UserEntitlement>();
    public DbSet<EntitlementEvent> EntitlementEvents => Set<EntitlementEvent>();

    // Content Reports (Şikayetler)
    public DbSet<ContentReport> ContentReports => Set<ContentReport>();

    // App Version Management
    public DbSet<AppVersion> AppVersions => Set<AppVersion>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Category>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique(false);
            e.HasIndex(x => new { x.ParentId, x.Name }).IsUnique(false);
            
            e.HasMany(x => x.Translations)
             .WithOne(x => x.Category)
             .HasForeignKey(x => x.CategoryId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<CategoryTranslation>(e =>
        {
            e.HasIndex(x => new { x.CategoryId, x.LanguageCode }).IsUnique();
            e.HasIndex(x => x.LanguageCode).IsUnique(false);
        });

        builder.Entity<CategoryClosure>(e =>
        {
            e.HasIndex(x => new { x.AncestorId, x.DescendantId }).IsUnique();
        });

        builder.Entity<Product>(e =>
        {
            e.HasMany(x => x.Photos)
             .WithOne(x => x.Product!)
             .HasForeignKey(x => x.ProductId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(x => x.Badges)
             .WithOne(x => x.Product!)
             .HasForeignKey(x => x.ProductId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Category)
             .WithMany()
             .HasForeignKey(x => x.CategoryId)
             .OnDelete(DeleteBehavior.SetNull);

            // Keep user link implicit (no FK migration). We'll join via manual query when needed.
        });

        builder.Entity<ProductBadgeInfo>(e =>
        {
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.Badge);
            e.HasIndex(x => x.ExpiresAt);
            e.HasIndex(x => new { x.ProductId, x.Badge }).IsUnique();
        });

        builder.Entity<ProductLike>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.UserId }).IsUnique();
            e.HasOne(x => x.Product!)
             .WithMany()
             .HasForeignKey(x => x.ProductId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProductSave>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.UserId }).IsUnique();
            e.HasOne(x => x.Product!)
             .WithMany()
             .HasForeignKey(x => x.ProductId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Comment>(e =>
        {
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.CreatedAt);
            e.HasOne(x => x.Product!)
             .WithMany()
             .HasForeignKey(x => x.ProductId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Follow>(e =>
        {
            e.HasIndex(x => new { x.FollowerId, x.FollowingId }).IsUnique();
            e.HasIndex(x => x.FollowerId);
            e.HasIndex(x => x.FollowingId);
            e.HasIndex(x => x.CreatedAt);
            // Self-follow prevention will be handled in controller
        });

        builder.Entity<CommentLike>(e =>
        {
            e.HasIndex(x => new { x.CommentId, x.UserId }).IsUnique();
            e.HasOne(x => x.Comment!)
             .WithMany()
             .HasForeignKey(x => x.CommentId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Notification>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.IsRead);
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => new { x.UserId, x.IsRead });
        });

        builder.Entity<Brand>(e =>
        {
            e.HasIndex(x => x.NormalizedName).IsUnique(false);
            e.HasIndex(x => x.Name).IsUnique(false);
            e.HasIndex(x => x.IsActive);
        });

        builder.Entity<AnalysisLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasMany(x => x.Entries)
             .WithOne(x => x.AnalysisLog)
             .HasForeignKey(x => x.AnalysisLogId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AnalysisLogEntry>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.AnalysisLogId);
            e.HasIndex(x => new { x.AnalysisLogId, x.Order });
        });

        builder.Entity<LoginLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.Email);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            e.HasIndex(x => x.IsSuccessful);
        });

        // ApplicationUser configurations
        builder.Entity<ApplicationUser>(e =>
        {
            e.Property(u => u.UiLanguage).HasMaxLength(8);
            e.Property(u => u.AiLanguage).HasMaxLength(8);
            e.Property(u => u.Currency).HasMaxLength(8);
        });

        // AI Credits System configurations
        builder.Entity<AICreditPackage>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            e.HasIndex(x => x.IsDefault);
            e.HasIndex(x => x.IsActive);
        });

        builder.Entity<AIOperationCost>(e =>
        {
            e.HasIndex(x => x.OperationType).IsUnique();
            e.HasIndex(x => x.IsActive);
        });

        builder.Entity<UserAICredit>(e =>
        {
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => x.NextRechargeDate);
            e.HasOne(x => x.Package)
             .WithMany()
             .HasForeignKey(x => x.PackageId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<AICreditTransaction>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => x.TransactionType);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        // Messaging System configurations
        builder.Entity<Conversation>(e =>
        {
            // Her iki kullanıcı kombinasyonu için tek bir konuşma olmalı (User1Id < User2Id sıralaması ile)
            e.HasIndex(x => new { x.User1Id, x.User2Id }).IsUnique();
            e.HasIndex(x => x.User1Id);
            e.HasIndex(x => x.User2Id);
            e.HasIndex(x => x.LastMessageAt);
            e.HasIndex(x => new { x.User1Id, x.LastMessageAt });
            e.HasIndex(x => new { x.User2Id, x.LastMessageAt });
        });

        builder.Entity<Message>(e =>
        {
            e.HasIndex(x => x.ConversationId);
            e.HasIndex(x => x.SenderId);
            e.HasIndex(x => x.ReceiverId);
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => new { x.ConversationId, x.CreatedAt });
            e.HasIndex(x => new { x.ReceiverId, x.IsRead });
            e.HasOne(x => x.Conversation!)
                .WithMany()
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // PostgreSQL için DateTime UTC converter - Tüm DateTime değerlerini UTC'ye zorla
        // Bu, PostgreSQL'in "timestamp with time zone" tipi için gereklidir
        var dateTimeConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableDateTimeConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue 
                ? (v.Value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v.Value.ToUniversalTime())
                : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        // UserAICredit entity'sindeki DateTime alanlarına converter ekle
        builder.Entity<UserAICredit>(e =>
        {
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.UpdatedAt).HasConversion(nullableDateTimeConverter);
            e.Property(x => x.LastRechargeDate).HasConversion(dateTimeConverter);
            e.Property(x => x.NextRechargeDate).HasConversion(dateTimeConverter);
        });

        // AICreditTransaction entity'sindeki DateTime alanlarına converter ekle
        builder.Entity<AICreditTransaction>(e =>
        {
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
        });

        // AICreditPackage entity'sindeki DateTime alanlarına converter ekle
        builder.Entity<AICreditPackage>(e =>
        {
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.UpdatedAt).HasConversion(nullableDateTimeConverter);
        });

        // AIOperationCost entity'sindeki DateTime alanlarına converter ekle
        builder.Entity<AIOperationCost>(e =>
        {
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.UpdatedAt).HasConversion(nullableDateTimeConverter);
        });

        // Conversation ve Message entity'lerindeki DateTime alanlarına converter ekle
        builder.Entity<Conversation>(e =>
        {
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.UpdatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.LastMessageAt).HasConversion(nullableDateTimeConverter);
        });

        builder.Entity<Message>(e =>
        {
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.ReadAt).HasConversion(nullableDateTimeConverter);
        });

        // LoginLog entity'sindeki DateTime alanlarına converter ekle
        builder.Entity<LoginLog>(e =>
        {
            e.Property(x => x.CreatedAtUtc).HasConversion(dateTimeConverter);
        });

        // UserDeviceInfo entity configuration
        builder.Entity<UserDeviceInfo>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.Platform);
            e.HasIndex(x => x.PushToken);
            e.HasIndex(x => new { x.UserId, x.Platform });
            e.HasIndex(x => x.LastUpdatedUtc);
            e.HasIndex(x => new { x.UserId, x.LastUpdatedUtc });
            e.Property(x => x.CreatedAtUtc).HasConversion(dateTimeConverter);
            e.Property(x => x.LastUpdatedUtc).HasConversion(dateTimeConverter);
        });

        // SearchLog entity configuration
        builder.Entity<SearchLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.SearchType);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasIndex(x => new { x.SearchType, x.CreatedAtUtc });
            e.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            e.Property(x => x.CreatedAtUtc).HasConversion(dateTimeConverter);
        });

        // UserEntitlement entity configuration (Premium subscriptions)
        builder.Entity<UserEntitlement>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.EntitlementType);
            e.HasIndex(x => x.Source);
            e.HasIndex(x => new { x.UserId, x.EntitlementType, x.Status });
            e.HasIndex(x => x.EndsAtUtc);
            e.HasIndex(x => new { x.Source, x.ExternalSubscriptionId });
            
            e.Property(x => x.EntitlementType).HasConversion<string>();
            e.Property(x => x.Source).HasConversion<string>();
            e.Property(x => x.Status).HasConversion<string>();
            
            e.Property(x => x.StartsAtUtc).HasConversion(dateTimeConverter);
            e.Property(x => x.EndsAtUtc).HasConversion(nullableDateTimeConverter);
            e.Property(x => x.CurrentPeriodStartUtc).HasConversion(nullableDateTimeConverter);
            e.Property(x => x.CurrentPeriodEndUtc).HasConversion(nullableDateTimeConverter);
            e.Property(x => x.CancelledAtUtc).HasConversion(nullableDateTimeConverter);
            e.Property(x => x.CreatedAtUtc).HasConversion(dateTimeConverter);
            e.Property(x => x.UpdatedAtUtc).HasConversion(nullableDateTimeConverter);
        });

        // EntitlementEvent entity configuration (audit log)
        builder.Entity<EntitlementEvent>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.EntitlementId);
            e.HasIndex(x => x.EventType);
            e.HasIndex(x => x.EventTimeUtc);
            e.HasIndex(x => x.ExternalEventId).IsUnique().HasFilter("\"ExternalEventId\" IS NOT NULL");
            e.HasIndex(x => new { x.EntitlementId, x.EventTimeUtc });
            
            e.Property(x => x.EventType).HasConversion<string>();
            
            e.Property(x => x.EventTimeUtc).HasConversion(dateTimeConverter);
            e.Property(x => x.ProcessedAtUtc).HasConversion(dateTimeConverter);
            
            e.HasOne(x => x.Entitlement)
             .WithMany()
             .HasForeignKey(x => x.EntitlementId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ContentReport entity configuration (Şikayetler)
        builder.Entity<ContentReport>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.ReporterUserId);
            e.HasIndex(x => x.ContentType);
            e.HasIndex(x => x.ContentId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => new { x.ContentType, x.ContentId });
            e.HasIndex(x => new { x.ReporterUserId, x.ContentType, x.ContentId }).IsUnique(); // Aynı kullanıcı aynı içeriği birden fazla kez şikayet edemez
            e.HasIndex(x => new { x.Status, x.CreatedAt });
            
            e.Property(x => x.CreatedAt).HasConversion(dateTimeConverter);
            e.Property(x => x.ReviewedAt).HasConversion(nullableDateTimeConverter);
        });

        // AppVersion entity configuration
        builder.Entity<AppVersion>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Version).IsUnique();
            e.HasIndex(x => x.IsValid);
            
            e.Property(x => x.CreatedAtUtc).HasConversion(dateTimeConverter);
            e.Property(x => x.UpdatedAtUtc).HasConversion(nullableDateTimeConverter);
        });
    }

    // Cloud SQL kullanıyoruz, backup kodu artık gerekli değil
    // SaveChangesAsync override'ı kaldırıldı - base implementation kullanılıyor
}


