// DbContext + Identity + Auth
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using HobbyCollection.Api.Services;
using HobbyCollection.Domain.Abstractions;
using HobbyCollection.Domain.Repositories;
using HobbyCollection.Infrastructure.Repositories;
using HobbyCollection.Infrastructure.Services;
using HobbyCollection.Domain.Services;
using HobbyCollection.Api.Seeders;
using Google.Cloud.Storage.V1;
using Google.Apis.Auth.OAuth2;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Console logging config (timestamp + single line) to make logs clearly visible
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.TimestampFormat = "HH:mm:ss ";
});
builder.Logging.SetMinimumLevel(LogLevel.Information);

// Add services to the container.

// Database configuration - PostgreSQL for all environments
var environment = builder.Configuration["ASPNETCORE_ENVIRONMENT"];

string connectionString;
if (environment == "Production")
{
    // PostgreSQL for Production (Cloud SQL)
    var instanceConnectionName = "fresh-inscriber-472521-t7:europe-west1:hobbycollection-db";
    var databaseName = builder.Configuration["CloudSql:DatabaseName"] ?? "hobbycollection";
    var userId = builder.Configuration["CloudSql:UserId"] ?? "postgres";
    var password = builder.Configuration["CloudSql:Password"];
    
    // Cloud SQL için optimize edilmiş connection string
    // db-f1-micro tier için optimize edilmiş ayarlar
    // Command Timeout: 30 saniye (Cloud SQL için yeterli)
    // Connection Timeout: 15 saniye
    // Keepalive: Bağlantıyı canlı tut
    // Pooling: Connection pooling aktif
    // Maximum Pool Size: 10 (db-f1-micro için optimize - 0.6 GB RAM limiti)
    connectionString = $"Host=/cloudsql/{instanceConnectionName};Database={databaseName};Username={userId};Password={password};" +
        $"Command Timeout=30;Timeout=15;Keepalive=60;Pooling=true;Minimum Pool Size=0;Maximum Pool Size=10;";
    Console.WriteLine("Using PostgreSQL (Cloud SQL) for database");
}
else
{
    // PostgreSQL for Development (Local)
    connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
        ?? "Host=localhost;Database=hobbycollection_dev;Username=gokhanmemik;Password=";
    Console.WriteLine("Using PostgreSQL (Local) for database");
}

builder.Services.AddDbContext<AppDbContext>(options => 
{
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        // Command timeout: 30 saniye
        npgsqlOptions.CommandTimeout(30);
        // Enable retry on failure (Cloud SQL için önemli)
        npgsqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorCodesToAdd: null);
    });
});

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.SignIn.RequireConfirmedEmail = true;
})
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

var jwtSection = builder.Configuration.GetSection("Jwt");
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection.GetValue<string>("Key")!));
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true, // Token süresini kontrol et
        ValidIssuer = jwtSection.GetValue<string>("Issuer"),
        ValidAudience = jwtSection.GetValue<string>("Audience"),
        IssuerSigningKey = signingKey,
        ClockSkew = TimeSpan.FromMinutes(5) // Sunucu-istemci saat farkı toleransı (5 dakika)
    };
});

// Authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return false;
            
            // HttpContext'ten service provider al
            var httpContext = context.Resource as Microsoft.AspNetCore.Http.HttpContext;
            if (httpContext == null) return false;
            
            var db = httpContext.RequestServices.GetRequiredService<AppDbContext>();
            var user = db.Users.Find(userId);
            return user?.IsAdmin == true;
        });
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (Dev için geniş izin; prod’da daraltılmalı)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

// SMTP Options & Email Sender
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddScoped<IEmailSender, EmailSender>();
builder.Services.AddScoped<IUserReadService, UserReadService>();

// Photo Analysis Services
builder.Services.AddScoped<IPhotoPreprocessingService, PhotoPreprocessingService>();

        // Analysis Services (Modüler yapı)
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IUrlParserService, HobbyCollection.Api.Services.Analysis.UrlParserService>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IVisionApiService, HobbyCollection.Api.Services.Analysis.VisionApiService>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IOcrExtractionService, HobbyCollection.Api.Services.Analysis.OcrExtractionService>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IWebSearchService, HobbyCollection.Api.Services.Analysis.WebSearchService>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IAiEnrichmentService, HobbyCollection.Api.Services.Analysis.AiEnrichmentService>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IHashtagGenerationService, HobbyCollection.Api.Services.Analysis.HashtagGenerationService>();
        
        // Strategy Pattern: Identification Strategies
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.WebSearchHighConfidenceStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.OcrWebSearchCombinedStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.OcrOnlyStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.WebSearchWithOcrBrandStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.OcrLabelsCombinedStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.WebDetectionStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.LabelsStrategy>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.Strategies.IIdentificationStrategy, HobbyCollection.Api.Services.Analysis.Strategies.OcrFallbackStrategy>();
        
        // Product Identification Service (Strategy Pattern kullanıyor)
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IProductIdentificationService, HobbyCollection.Api.Services.Analysis.ProductIdentificationService>();
        
        // Gemini Analysis Service (Google Cloud Credentials ile)
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.IGeminiAnalysisService>(provider =>
        {
            var logger = provider.GetRequiredService<ILogger<HobbyCollection.Api.Services.Analysis.GeminiAnalysisService>>();
            var configuration = provider.GetRequiredService<IConfiguration>();
            var googleCredential = provider.GetService<GoogleCredential>();
            return new HobbyCollection.Api.Services.Analysis.GeminiAnalysisService(logger, configuration, googleCredential);
        });
        
        // Metrics Service
        builder.Services.AddSingleton<HobbyCollection.Api.Services.Analysis.AnalysisMetricsService>();
        
        // Category Detection & Extractors
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.CategoryDetectionService>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.ICategorySpecificExtractor, HobbyCollection.Api.Services.Analysis.CategoryDetection.BookExtractor>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.ICategorySpecificExtractor, HobbyCollection.Api.Services.Analysis.CategoryDetection.CoinCurrencyExtractor>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.ICategorySpecificExtractor, HobbyCollection.Api.Services.Analysis.CategoryDetection.StampExtractor>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.ICategorySpecificExtractor, HobbyCollection.Api.Services.Analysis.CategoryDetection.WatchExtractor>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.ICategorySpecificExtractor, HobbyCollection.Api.Services.Analysis.CategoryDetection.CameraExtractor>();
        builder.Services.AddScoped<HobbyCollection.Api.Services.Analysis.CategoryDetection.ICategorySpecificExtractor, HobbyCollection.Api.Services.Analysis.CategoryDetection.VideoGameExtractor>();

// Enhanced Photo Analysis Service (Orchestrator) - YEDEK (Full versiyon)
// builder.Services.AddScoped<IEnhancedPhotoAnalysisService, EnhancedPhotoAnalysisService>();

// Simple Photo Analysis Service (Sadece Gemini AI) - AKTİF
builder.Services.AddScoped<SimplePhotoAnalysisService>();
builder.Services.AddScoped<ISimplePhotoAnalysisService>(provider => provider.GetRequiredService<SimplePhotoAnalysisService>());
builder.Services.AddScoped<IEnhancedPhotoAnalysisService>(provider => provider.GetRequiredService<SimplePhotoAnalysisService>());
builder.Services.AddScoped<IProductService, HobbyCollection.Infrastructure.Services.ProductService>();
        builder.Services.AddScoped<ICategoryService, HobbyCollection.Infrastructure.Services.CategoryService>();
        
        // AI Credits System
        builder.Services.AddScoped<IAICreditRepository, AICreditRepository>();
        builder.Services.AddScoped<IAICreditService, AICreditService>();
        builder.Services.AddHostedService<HobbyCollection.Api.Services.AICreditBackgroundService>();
        builder.Services.AddHostedService<HobbyCollection.Api.Services.NewProductNotificationBatchService>();
        builder.Services.AddHostedService<HobbyCollection.Api.Services.UnverifiedUserCleanupService>();
        builder.Services.AddHostedService<HobbyCollection.Api.Services.PremiumExpirationService>();
        
        // Exchange Rate Service
        builder.Services.AddSingleton<HobbyCollection.Api.Services.IExchangeRateService, HobbyCollection.Api.Services.ExchangeRateService>();

// Google Cloud Credential (ADC veya config yolundan)
builder.Services.AddSingleton(provider =>
{
    var cfg = provider.GetRequiredService<IConfiguration>();
    var credentialPath = cfg["GoogleCloud:CredentialsPath"] ?? Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
    GoogleCredential credential = !string.IsNullOrWhiteSpace(credentialPath) && File.Exists(credentialPath)
        ? GoogleCredential.FromFile(credentialPath)
        : GoogleCredential.GetApplicationDefault();
    return credential;
});

// Google Cloud Storage client
builder.Services.AddSingleton(provider =>
{
    var credential = provider.GetRequiredService<GoogleCredential>();
    return StorageClient.Create(credential);
});

builder.Services.AddScoped<IImageStorageService, GcsImageStorageService>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<ICategoryClosureRepository, CategoryClosureRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<HobbyCollection.Domain.Repositories.IBrandRepository, HobbyCollection.Infrastructure.Repositories.BrandRepository>();
builder.Services.AddScoped<HobbyCollection.Domain.Services.IBrandService, HobbyCollection.Infrastructure.Services.BrandService>();
builder.Services.AddScoped<HobbyCollection.Domain.Services.IAnalysisLogService, HobbyCollection.Infrastructure.Services.AnalysisLogService>();
builder.Services.AddScoped<IBadgeService, BadgeService>();
builder.Services.AddHttpClient(); // Push notification için HttpClient
builder.Services.AddScoped<PushNotificationService>();
builder.Services.AddScoped<HobbyCollection.Api.Services.INotificationService, HobbyCollection.Api.Services.NotificationService>();
builder.Services.AddScoped<HobbyCollection.Api.Services.IEntitlementService, HobbyCollection.Api.Services.EntitlementService>();
builder.Services.AddScoped<HobbyCollection.Api.Services.IAppleSubscriptionService, HobbyCollection.Api.Services.AppleSubscriptionService>();
builder.Services.AddScoped<HobbyCollection.Api.Services.IGoogleSubscriptionService, HobbyCollection.Api.Services.GoogleSubscriptionService>();
builder.Services.AddScoped<UsernameService>();

// Cloud SQL kullanıyoruz, DatabaseBackupService artık gerekli değil

// AppDbContext factory pattern artık gerekli değil (Cloud SQL kullanıyoruz)
// Standard AddDbContext registration yukarıda yapıldı

var app = builder.Build();

// Cloud SQL kullanıyoruz, artık database download/backup'a gerek yok

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Ensure database migrations are applied
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
        app.Logger.LogInformation("Database migrations applied successfully");
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("pending changes"))
    {
        // Pending model changes - use EnsureCreated instead
        app.Logger.LogInformation("Pending model changes detected. Using EnsureCreated to initialize database.");
        await db.Database.EnsureCreatedAsync();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Database migration failed!");
        throw; // Re-throw to prevent application startup with broken database
    }
    
    // AI Credits System - Safe Migration (Idempotent - runs safely multiple times)
    // IMPORTANT: Run OUTSIDE the try-catch block to see real errors
    try
    {
        app.Logger.LogInformation("🚀 Starting AI Credits tables creation...");
        await EnsureAICreditTablesAsync(db);
        app.Logger.LogInformation("✅ AI Credits tables created successfully!");
    }
    catch (Exception aiEx)
    {
        app.Logger.LogError(aiEx, "❌ AI Credits tables creation FAILED!");
        // Don't throw - let app start, but log the error prominently
    }
    
    // Entitlement System Migration (Idempotent - güvenli bir şekilde birden fazla kez çalışır)
    try
    {
        app.Logger.LogInformation("👑 Entitlement sistemi migration başlatılıyor...");
        await EnsureEntitlementTablesAsync(db);
        app.Logger.LogInformation("✅ Entitlement tabloları oluşturuldu!");
    }
    catch (Exception entEx)
    {
        app.Logger.LogError(entEx, "❌ Entitlement tabloları oluşturma HATASI!");
    }
    
    // Badge System Migration (Idempotent - güvenli bir şekilde birden fazla kez çalışır)
    try
    {
        app.Logger.LogInformation("🏅 Badge sistemi migration başlatılıyor...");
        await HobbyCollection.Api.Services.MigrationService.ApplyBadgeMigrationAsync(db, app.Logger);
        app.Logger.LogInformation("✅ Badge sistemi hazır!");
        
        // IsPrivateAccount migration'ını uygula
        await HobbyCollection.Api.Services.MigrationService.ApplyPrivateAccountMigrationAsync(db, app.Logger);
        app.Logger.LogInformation("✅ IsPrivateAccount migration hazır!");
        
        // IsWebProfilePublic migration'ını uygula (KRİTİK - exception throw edilmeli)
        try
        {
            await HobbyCollection.Api.Services.MigrationService.ApplyWebProfilePublicMigrationAsync(db, app.Logger);
            app.Logger.LogInformation("✅ IsWebProfilePublic migration hazır!");
        }
        catch (Exception webProfileEx)
        {
            app.Logger.LogError(webProfileEx, "❌ IsWebProfilePublic migration KRİTİK HATA!");
            // Bu migration kritik - exception throw et
            throw new Exception("IsWebProfilePublic migration başarısız! Uygulama başlatılamıyor.", webProfileEx);
        }
        
        // App Versions Migration (Idempotent - güvenli bir şekilde birden fazla kez çalışır)
        try
        {
            app.Logger.LogInformation("📱 App Versions migration başlatılıyor...");
            await EnsureAppVersionsTableAsync(db);
            app.Logger.LogInformation("✅ App Versions tablosu hazır!");
        }
        catch (Exception appVerEx)
        {
            app.Logger.LogError(appVerEx, "❌ App Versions tablosu oluşturma HATASI!");
        }
        
        // CreatedAt kolonunu UsernameGenerationMigration'dan ÖNCE ekle
        // (UsernameGenerationMigration CreatedAt kullanıyor)
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                -- Kolon yoksa ekle (nullable)
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'AspNetUsers' AND column_name = 'CreatedAt'
                    ) THEN
                        ALTER TABLE ""AspNetUsers"" 
                        ADD COLUMN ""CreatedAt"" TIMESTAMP WITH TIME ZONE;
                        
                        -- Mevcut kullanıcılar için default değer set et
                        UPDATE ""AspNetUsers"" 
                        SET ""CreatedAt"" = CURRENT_TIMESTAMP 
                        WHERE ""CreatedAt"" IS NULL;
                        
                        -- Artık NOT NULL yapabiliriz
                        ALTER TABLE ""AspNetUsers"" 
                        ALTER COLUMN ""CreatedAt"" SET NOT NULL,
                        ALTER COLUMN ""CreatedAt"" SET DEFAULT CURRENT_TIMESTAMP;
                    END IF;
                END $$;
            ");
            app.Logger.LogInformation("CreatedAt column ensured in AspNetUsers table (before UsernameGenerationMigration)");
        }
        catch (PostgresException pgEx) when (pgEx.SqlState == "42701") // duplicate_column
        {
            // Column already exists, mevcut kullanıcılar için null olan değerleri güncelle
            try
            {
                await db.Database.ExecuteSqlRawAsync(@"
                    UPDATE ""AspNetUsers"" 
                    SET ""CreatedAt"" = CURRENT_TIMESTAMP 
                    WHERE ""CreatedAt"" IS NULL;
                ");
                app.Logger.LogInformation("Updated existing users' CreatedAt values");
            }
            catch (Exception ex)
            {
                app.Logger.LogWarning(ex, "Failed updating existing users' CreatedAt values.");
            }
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Failed ensuring CreatedAt column creation (before UsernameGenerationMigration).");
        }

        // Username generation migration
        var usernameService = scope.ServiceProvider.GetRequiredService<UsernameService>();
        await HobbyCollection.Api.Services.MigrationService.ApplyUsernameGenerationMigrationAsync(db, app.Logger, usernameService);
        app.Logger.LogInformation("✅ Username generation migration hazır!");

        // DisplayName kolonunu kaldır (artık sadece UserName kullanılıyor)
        await HobbyCollection.Api.Services.MigrationService.RemoveDisplayNameColumnAsync(db, app.Logger);
        app.Logger.LogInformation("✅ DisplayName kolonu kaldırma migration hazır!");
    }
    catch (Exception badgeEx)
    {
        app.Logger.LogError(badgeEx, "❌ Migration FAILED!");
        // Kritik migration'lar için exception throw et
        if (badgeEx.Message.Contains("IsWebProfilePublic") || badgeEx.InnerException?.Message.Contains("IsWebProfilePublic") == true)
        {
            throw; // Kritik migration hatası - uygulama başlatılamamalı
        }
        // Diğer migration'lar için sadece log et
        app.Logger.LogWarning("⚠️ Non-critical migration hatası, uygulama devam ediyor...");
    }
    
    // AnalysisLogs System - Safe Migration (Idempotent - runs safely multiple times)
    try
    {
        app.Logger.LogInformation("🚀 Starting AnalysisLogs tables creation...");
        await EnsureAnalysisLogsTablesAsync(db);
        app.Logger.LogInformation("✅ AnalysisLogs tables created successfully!");
    }
    catch (Exception logsEx)
    {
        app.Logger.LogError(logsEx, "❌ AnalysisLogs tables creation FAILED!");
        // Don't throw - let app start, but log the error prominently
    }

    // LoginLogs System - Safe Migration (Idempotent - runs safely multiple times)
    try
    {
        app.Logger.LogInformation("🚀 Starting LoginLogs table creation...");
        await EnsureLoginLogsTableAsync(db);
        app.Logger.LogInformation("✅ LoginLogs table created successfully!");
    }
    catch (Exception logsEx)
    {
        app.Logger.LogError(logsEx, "❌ LoginLogs table creation FAILED!");
        // Don't throw - let app start, but log the error prominently
    }

    // UserDeviceInfos System - Safe Migration (Idempotent - runs safely multiple times)
    try
    {
        app.Logger.LogInformation("🚀 Starting UserDeviceInfos table creation...");
        await EnsureUserDeviceInfosTableAsync(db);
        app.Logger.LogInformation("✅ UserDeviceInfos table created successfully!");
    }
    catch (Exception devEx)
    {
        app.Logger.LogError(devEx, "❌ UserDeviceInfos table creation FAILED!");
        // Don't throw - let app start, but log the error prominently
    }

    // Conversations and Messages System - Safe Migration (Idempotent - runs safely multiple times)
    try
    {
        app.Logger.LogInformation("🚀 Starting Conversations and Messages tables creation...");
        await EnsureConversationsTablesAsync(db);
        app.Logger.LogInformation("✅ Conversations and Messages tables created successfully!");
    }
    catch (Exception convEx)
    {
        app.Logger.LogError(convEx, "❌ Conversations and Messages tables creation FAILED!");
        // Don't throw - let app start, but log the error prominently
    }

    // Ensure CategoryTranslations table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""CategoryTranslations"" (
                ""Id"" VARCHAR(450) NOT NULL CONSTRAINT PK_CategoryTranslations PRIMARY KEY,
                ""CategoryId"" VARCHAR(450) NOT NULL,
                ""LanguageCode"" VARCHAR(10) NOT NULL,
                ""Name"" TEXT NOT NULL,
                ""Description"" TEXT,
                CONSTRAINT FK_CategoryTranslations_Categories_CategoryId FOREIGN KEY (""CategoryId"") REFERENCES ""Categories"" (""Id"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CategoryTranslations_CategoryId_LanguageCode ON ""CategoryTranslations"" (""CategoryId"", ""LanguageCode"");
            CREATE INDEX IF NOT EXISTS IX_CategoryTranslations_LanguageCode ON ""CategoryTranslations"" (""LanguageCode"");
        ");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring CategoryTranslations table creation.");
    }

    // Ensure Brands table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""Brands"" (
                ""Id"" VARCHAR(450) NOT NULL CONSTRAINT PK_Brands PRIMARY KEY,
                ""Name"" TEXT NOT NULL,
                ""NormalizedName"" TEXT,
                ""Category"" TEXT,
                ""Country"" TEXT,
                ""FoundedYear"" INTEGER,
                ""IsActive"" BOOLEAN NOT NULL,
                ""PopularityScore"" INTEGER NOT NULL,
                ""CreatedAtUtc"" TIMESTAMP NOT NULL,
                ""UpdatedAtUtc"" TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS IX_Brands_IsActive ON ""Brands"" (""IsActive"");
            CREATE INDEX IF NOT EXISTS IX_Brands_Name ON ""Brands"" (""Name"");
            CREATE INDEX IF NOT EXISTS IX_Brands_NormalizedName ON ""Brands"" (""NormalizedName"");
        ");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring Brands table creation.");
    }

    // SQLite'tan PostgreSQL'e migration sırasında oluşan tip uyumsuzluklarını düzelt
    try
    {
        app.Logger.LogInformation("🔧 SQLite tip uyumsuzlukları kontrol ediliyor...");
        await HobbyCollection.Api.Services.FixSqliteTypeMigrations.FixAllTypeMismatchesAsync(db, app.Logger);
        app.Logger.LogInformation("✅ Tip uyumsuzlukları düzeltildi!");
    }
    catch (Exception typeEx)
    {
        app.Logger.LogWarning(typeEx, "⚠️ Tip uyumsuzlukları düzeltilirken hata (devam ediliyor)");
    }

    // UserDeviceInfos.NotificationsEnabled kolonu (uygulama içi bildirim toggle) - idempotent
    try
    {
        await HobbyCollection.Api.Services.MigrationService.ApplyUserDeviceNotificationsEnabledAsync(db, app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "⚠️ NotificationsEnabled kolonu eklenirken hata (devam ediliyor)");
    }
    
    // CategorySeeder DEVRE DIŞI - Admin panelden kategori yönetimi yapılıyor
    // Otomatik seed tehlikeli olabilir, kategoriler admin panelden manuel olarak yönetilmeli
    // Seed işlemini manuel olarak çalıştırmak için: await CategorySeeder.SeedAsync(db);
    var categoryCount = await db.Categories.CountAsync();
    app.Logger.LogInformation($"✅ {categoryCount} kategori mevcut. CategorySeeder devre dışı (admin panelden yönetiliyor)");
    
    // Kategori isim güncellemeleri
    try
    {
        app.Logger.LogInformation("🔄 Kategori isimleri güncelleniyor...");
        
        // "Retro Elektronik" -> "Retro Elektronik & Bilgisayar"
        var retroElectronics = await db.Categories
            .FirstOrDefaultAsync(c => c.Name == "Retro Elektronik" && c.ParentId != null);
        if (retroElectronics != null)
        {
            retroElectronics.Name = "Retro Elektronik & Bilgisayar";
            retroElectronics.Slug = "retro-elektronik-bilgisayar";
            
            // İngilizce çeviriyi güncelle
            var enTranslation = await db.CategoryTranslations
                .FirstOrDefaultAsync(t => t.CategoryId == retroElectronics.Id && t.LanguageCode == "en");
            if (enTranslation != null)
            {
                enTranslation.Name = "Retro Electronics & Computer";
            }
            else
            {
                db.CategoryTranslations.Add(new CategoryTranslation
                {
                    CategoryId = retroElectronics.Id,
                    LanguageCode = "en",
                    Name = "Retro Electronics & Computer"
                });
            }
            
            await db.SaveChangesAsync();
            app.Logger.LogInformation("✅ Retro Elektronik kategorisi güncellendi");
        }
        
        // "Vintage PC" -> "Retro Computer"
        var vintagePC = await db.Categories
            .FirstOrDefaultAsync(c => c.Name == "Vintage PC" && c.ParentId != null);
        if (vintagePC != null)
        {
            vintagePC.Name = "Retro Computer";
            vintagePC.Slug = "retro-computer";
            
            // İngilizce çeviriyi güncelle
            var enTranslation = await db.CategoryTranslations
                .FirstOrDefaultAsync(t => t.CategoryId == vintagePC.Id && t.LanguageCode == "en");
            if (enTranslation != null)
            {
                enTranslation.Name = "Retro Computer";
            }
            else
            {
                db.CategoryTranslations.Add(new CategoryTranslation
                {
                    CategoryId = vintagePC.Id,
                    LanguageCode = "en",
                    Name = "Retro Computer"
                });
            }
            
            await db.SaveChangesAsync();
            app.Logger.LogInformation("✅ Vintage PC kategorisi güncellendi");
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "⚠️ Kategori güncelleme hatası (devam ediliyor)");
    }
    
    await BrandSeeder.SeedAsync(db);

    // Cleanup: "Model ve Diecastler" ana kategorisi altındaki "Model ve Diecast" alt kategorisini kaldır
    try
    {
        var modelsDiecastParent = await db.Categories.FirstOrDefaultAsync(c => c.Name == "Model ve Diecastler" && c.ParentId == null);
        if (modelsDiecastParent != null)
        {
            var duplicateCategory = await db.Categories.FirstOrDefaultAsync(c => c.Name == "Model ve Diecast" && c.ParentId == modelsDiecastParent.Id);
            if (duplicateCategory != null)
            {
                // Bu kategorinin alt kategorileri var mı kontrol et
                var hasChildren = await db.Categories.AnyAsync(c => c.ParentId == duplicateCategory.Id);
                if (!hasChildren)
                {
                    // Closure kayıtlarını sil
                    var closures = await db.CategoryClosures
                        .Where(x => x.AncestorId == duplicateCategory.Id || x.DescendantId == duplicateCategory.Id)
                        .ToListAsync();
                    if (closures.Any())
                    {
                        db.CategoryClosures.RemoveRange(closures);
                    }

                    // Çevirileri sil
                    var translations = await db.CategoryTranslations
                        .Where(t => t.CategoryId == duplicateCategory.Id)
                        .ToListAsync();
                    if (translations.Any())
                    {
                        db.CategoryTranslations.RemoveRange(translations);
                    }

                    // Kategoriyi sil
                    db.Categories.Remove(duplicateCategory);
                    await db.SaveChangesAsync();
                    app.Logger.LogInformation("Duplicate 'Model ve Diecast' subcategory removed from 'Model ve Diecastler' parent category.");
                }
                else
                {
                    app.Logger.LogWarning("Cannot remove 'Model ve Diecast' category as it has child categories.");
                }
            }
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed to cleanup duplicate 'Model ve Diecast' category.");
    }

    // Ensure ProductLikes table exists for backward compatibility without explicit migration (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""ProductLikes"" (
                ""Id"" UUID NOT NULL CONSTRAINT PK_ProductLikes PRIMARY KEY,
                ""ProductId"" UUID NOT NULL,
                ""UserId"" TEXT NOT NULL,
                ""CreatedAt"" TIMESTAMP NOT NULL,
                CONSTRAINT FK_ProductLikes_Products_ProductId FOREIGN KEY (""ProductId"") REFERENCES ""Products"" (""Id"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_ProductLikes_ProductId_UserId ON ""ProductLikes"" (""ProductId"", ""UserId"");
            CREATE INDEX IF NOT EXISTS IX_ProductLikes_ProductId ON ""ProductLikes"" (""ProductId"");
        ");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring ProductLikes table creation.");
    }

    // Ensure ProductSaves table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""ProductSaves"" (
                ""Id"" UUID NOT NULL CONSTRAINT PK_ProductSaves PRIMARY KEY,
                ""ProductId"" UUID NOT NULL,
                ""UserId"" TEXT NOT NULL,
                ""CreatedAt"" TIMESTAMP NOT NULL,
                CONSTRAINT FK_ProductSaves_Products_ProductId FOREIGN KEY (""ProductId"") REFERENCES ""Products"" (""Id"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_ProductSaves_ProductId_UserId ON ""ProductSaves"" (""ProductId"", ""UserId"");
            CREATE INDEX IF NOT EXISTS IX_ProductSaves_ProductId ON ""ProductSaves"" (""ProductId"");
        ");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring ProductSaves table creation.");
    }

    // Ensure Currency column exists in AspNetUsers (PostgreSQL)
    try
    {
        // Try to add the column - PostgreSQL will throw an error if it already exists
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"AspNetUsers\" ADD COLUMN \"Currency\" VARCHAR(8) DEFAULT 'TRY'");
        app.Logger.LogInformation("Currency column added to AspNetUsers table");
    }
    catch (PostgresException pgEx) when (pgEx.SqlState == "42701") // duplicate_column
    {
        // Column already exists, which is fine - no need to log
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring Currency column creation.");
    }

    // Ensure AvatarUrl column exists in AspNetUsers (PostgreSQL)
    try
    {
        // Try to add the column - PostgreSQL will throw an error if it already exists
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"AspNetUsers\" ADD COLUMN \"AvatarUrl\" TEXT");
        app.Logger.LogInformation("AvatarUrl column added to AspNetUsers table");
    }
    catch (PostgresException pgEx) when (pgEx.SqlState == "42701") // duplicate_column
    {
        // Column already exists, which is fine - no need to log
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring AvatarUrl column creation.");
    }

    // Ensure CreatedAt column exists in AspNetUsers (PostgreSQL)
    try
    {
        // Önce nullable olarak ekle, sonra mevcut kullanıcılar için değer set et, sonra NOT NULL yap
        await db.Database.ExecuteSqlRawAsync(@"
            -- Kolon yoksa ekle (nullable)
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'AspNetUsers' AND column_name = 'CreatedAt'
                ) THEN
                    ALTER TABLE ""AspNetUsers"" 
                    ADD COLUMN ""CreatedAt"" TIMESTAMP WITH TIME ZONE;
                    
                    -- Mevcut kullanıcılar için default değer set et
                    UPDATE ""AspNetUsers"" 
                    SET ""CreatedAt"" = CURRENT_TIMESTAMP 
                    WHERE ""CreatedAt"" IS NULL;
                    
                    -- Artık NOT NULL yapabiliriz
                    ALTER TABLE ""AspNetUsers"" 
                    ALTER COLUMN ""CreatedAt"" SET NOT NULL,
                    ALTER COLUMN ""CreatedAt"" SET DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        ");
        app.Logger.LogInformation("CreatedAt column ensured in AspNetUsers table");
    }
    catch (PostgresException pgEx) when (pgEx.SqlState == "42701") // duplicate_column
    {
        // Column already exists, mevcut kullanıcılar için null olan değerleri güncelle
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                UPDATE ""AspNetUsers"" 
                SET ""CreatedAt"" = CURRENT_TIMESTAMP 
                WHERE ""CreatedAt"" IS NULL;
            ");
            app.Logger.LogInformation("Updated existing users' CreatedAt values");
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Failed updating existing users' CreatedAt values.");
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring CreatedAt column creation.");
    }

    // Ensure Comments table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""Comments"" (
                ""Id"" UUID NOT NULL CONSTRAINT PK_Comments PRIMARY KEY,
                ""ProductId"" UUID NOT NULL,
                ""UserId"" TEXT NOT NULL,
                ""Text"" TEXT NOT NULL,
                ""CreatedAt"" TIMESTAMP NOT NULL,
                ""UpdatedAt"" TIMESTAMP,
                CONSTRAINT FK_Comments_Products_ProductId FOREIGN KEY (""ProductId"") REFERENCES ""Products"" (""Id"") ON DELETE CASCADE
            );
        ");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Comments_ProductId ON ""Comments"" (""ProductId"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Comments_UserId ON ""Comments"" (""UserId"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Comments_CreatedAt ON ""Comments"" (""CreatedAt"");");
        app.Logger.LogInformation("Comments table ensured.");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring Comments table creation.");
    }

    // Ensure CommentLikes table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""CommentLikes"" (
                ""Id"" UUID NOT NULL CONSTRAINT PK_CommentLikes PRIMARY KEY,
                ""CommentId"" UUID NOT NULL,
                ""UserId"" TEXT NOT NULL,
                ""CreatedAt"" TIMESTAMP NOT NULL,
                CONSTRAINT FK_CommentLikes_Comments_CommentId FOREIGN KEY (""CommentId"") REFERENCES ""Comments"" (""Id"") ON DELETE CASCADE
            );
        ");
        await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS IX_CommentLikes_CommentId_UserId ON ""CommentLikes"" (""CommentId"", ""UserId"");");
        app.Logger.LogInformation("CommentLikes table ensured.");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring CommentLikes table creation.");
    }

    // Ensure Notifications table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""Notifications"" (
                ""Id"" UUID NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
                ""UserId"" TEXT NOT NULL,
                ""Type"" TEXT NOT NULL,
                ""Title"" TEXT NOT NULL,
                ""Message"" TEXT,
                ""RelatedProductId"" UUID,
                ""RelatedCommentId"" UUID,
                ""RelatedConversationId"" UUID,
                ""RelatedUserId"" TEXT,
                ""RelatedFollowId"" TEXT,
                ""IsRead"" BOOLEAN NOT NULL,
                ""CreatedAt"" TIMESTAMP NOT NULL
            );
        ");
        
        // RelatedFollowId kolonu yoksa ekle (mevcut tablolar için)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'Notifications' 
                    AND column_name = 'RelatedFollowId'
                ) THEN
                    ALTER TABLE ""Notifications"" 
                    ADD COLUMN ""RelatedFollowId"" TEXT;
                    RAISE NOTICE 'RelatedFollowId kolonu eklendi';
                END IF;
            END $$;
        ");

        // RelatedConversationId kolonu yoksa ekle (mevcut tablolar için)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'Notifications' 
                    AND column_name = 'RelatedConversationId'
                ) THEN
                    ALTER TABLE ""Notifications"" 
                    ADD COLUMN ""RelatedConversationId"" UUID;
                    RAISE NOTICE 'RelatedConversationId kolonu eklendi';
                END IF;
            END $$;
        ");

        // Bazı ortamlarda (özellikle SQLite -> Postgres taşımalarında) Guid alanları TEXT olarak kalmış olabiliyor.
        // EF Core ise bu alanları Guid(UUID) olarak okumaya çalıştığında InvalidCastException ile 500 verir.
        // Bu yüzden TEXT/character varying olan kolonları güvenli şekilde UUID'ye çeviriyoruz (UUID regex ile).
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
                -- RelatedProductId
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'Notifications'
                      AND column_name = 'RelatedProductId'
                      AND data_type IN ('text', 'character varying')
                ) THEN
                    ALTER TABLE ""Notifications""
                    ALTER COLUMN ""RelatedProductId"" TYPE UUID
                    USING CASE
                        WHEN ""RelatedProductId"" ~* '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'
                        THEN ""RelatedProductId""::uuid
                        ELSE NULL
                    END;
                    RAISE NOTICE 'RelatedProductId kolonu UUID''ye dönüştürüldü';
                END IF;

                -- RelatedCommentId
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'Notifications'
                      AND column_name = 'RelatedCommentId'
                      AND data_type IN ('text', 'character varying')
                ) THEN
                    ALTER TABLE ""Notifications""
                    ALTER COLUMN ""RelatedCommentId"" TYPE UUID
                    USING CASE
                        WHEN ""RelatedCommentId"" ~* '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'
                        THEN ""RelatedCommentId""::uuid
                        ELSE NULL
                    END;
                    RAISE NOTICE 'RelatedCommentId kolonu UUID''ye dönüştürüldü';
                END IF;

                -- RelatedConversationId
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'Notifications'
                      AND column_name = 'RelatedConversationId'
                      AND data_type IN ('text', 'character varying')
                ) THEN
                    ALTER TABLE ""Notifications""
                    ALTER COLUMN ""RelatedConversationId"" TYPE UUID
                    USING CASE
                        WHEN ""RelatedConversationId"" ~* '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'
                        THEN ""RelatedConversationId""::uuid
                        ELSE NULL
                    END;
                    RAISE NOTICE 'RelatedConversationId kolonu UUID''ye dönüştürüldü';
                END IF;
            END $$;
        ");
        
        // IsRead kolonu tipini düzelt (integer ise boolean'a çevir)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'Notifications' 
                    AND column_name = 'IsRead'
                    AND data_type = 'integer'
                ) THEN
                    -- Önce yeni boolean kolonu ekle
                    ALTER TABLE ""Notifications"" 
                    ADD COLUMN ""IsReadNew"" BOOLEAN NOT NULL DEFAULT false;
                    
                    -- Mevcut integer değerleri boolean'a çevir (0=false, 1=true)
                    UPDATE ""Notifications"" 
                    SET ""IsReadNew"" = (""IsRead"" = 1);
                    
                    -- Eski kolonu sil
                    ALTER TABLE ""Notifications"" 
                    DROP COLUMN ""IsRead"";
                    
                    -- Yeni kolonu eski isimle yeniden adlandır
                    ALTER TABLE ""Notifications"" 
                    RENAME COLUMN ""IsReadNew"" TO ""IsRead"";
                    
                    RAISE NOTICE 'IsRead kolonu integer''dan boolean''a dönüştürüldü';
                END IF;
            END $$;
        ");
        
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Notifications_UserId ON ""Notifications"" (""UserId"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Notifications_IsRead ON ""Notifications"" (""IsRead"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Notifications_CreatedAt ON ""Notifications"" (""CreatedAt"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Notifications_UserId_IsRead ON ""Notifications"" (""UserId"", ""IsRead"");");
        app.Logger.LogInformation("Notifications table ensured.");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring Notifications table creation.");
    }

    // Ensure Follows table exists (PostgreSQL)
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""Follows"" (
                ""Id"" UUID NOT NULL CONSTRAINT PK_Follows PRIMARY KEY,
                ""FollowerId"" TEXT NOT NULL,
                ""FollowingId"" TEXT NOT NULL,
                ""Status"" INTEGER NOT NULL DEFAULT 1,
                ""CreatedAt"" TIMESTAMP NOT NULL,
                CONSTRAINT FK_Follows_Follower FOREIGN KEY (""FollowerId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE,
                CONSTRAINT FK_Follows_Following FOREIGN KEY (""FollowingId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
            );
        ");
        
        // Status kolonu yoksa ekle (mevcut tablolar için)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'Follows' 
                    AND column_name = 'Status'
                ) THEN
                    ALTER TABLE ""Follows"" 
                    ADD COLUMN ""Status"" INTEGER NOT NULL DEFAULT 1;
                    RAISE NOTICE 'Status kolonu eklendi';
                END IF;
            END $$;
        ");
        
        // Id kolonu tipini düzelt (text ise UUID'ye çevir)
        await db.Database.ExecuteSqlRawAsync(@"
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'Follows' 
                    AND column_name = 'Id'
                    AND data_type = 'text'
                ) THEN
                    -- Foreign key'leri geçici olarak sil
                    ALTER TABLE ""Follows"" 
                    DROP CONSTRAINT IF EXISTS FK_Follows_Follower;
                    ALTER TABLE ""Follows"" 
                    DROP CONSTRAINT IF EXISTS FK_Follows_Following;
                    
                    -- Primary key'i geçici olarak sil
                    ALTER TABLE ""Follows"" 
                    DROP CONSTRAINT IF EXISTS PK_Follows;
                    
                    -- Önce yeni UUID kolonu ekle
                    ALTER TABLE ""Follows"" 
                    ADD COLUMN ""IdNew"" UUID;
                    
                    -- Mevcut text değerleri UUID'ye çevir
                    UPDATE ""Follows"" 
                    SET ""IdNew"" = ""Id""::uuid;
                    
                    -- Eski kolonu sil
                    ALTER TABLE ""Follows"" 
                    DROP COLUMN ""Id"";
                    
                    -- Yeni kolonu eski isimle yeniden adlandır ve primary key yap
                    ALTER TABLE ""Follows"" 
                    RENAME COLUMN ""IdNew"" TO ""Id"";
                    ALTER TABLE ""Follows"" 
                    ALTER COLUMN ""Id"" SET NOT NULL;
                    ALTER TABLE ""Follows"" 
                    ADD CONSTRAINT PK_Follows PRIMARY KEY (""Id"");
                    
                    -- Foreign key'leri yeniden oluştur
                    ALTER TABLE ""Follows"" 
                    ADD CONSTRAINT FK_Follows_Follower FOREIGN KEY (""FollowerId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE;
                    ALTER TABLE ""Follows"" 
                    ADD CONSTRAINT FK_Follows_Following FOREIGN KEY (""FollowingId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE;
                    
                    RAISE NOTICE 'Follows.Id kolonu text''den UUID''ye dönüştürüldü';
                END IF;
            END $$;
        ");
        
        await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS IX_Follows_FollowerId_FollowingId ON ""Follows"" (""FollowerId"", ""FollowingId"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Follows_FollowerId ON ""Follows"" (""FollowerId"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Follows_FollowingId ON ""Follows"" (""FollowingId"");");
        await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS IX_Follows_CreatedAt ON ""Follows"" (""CreatedAt"");");
        app.Logger.LogInformation("Follows table ensured.");
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Failed ensuring Follows table creation.");
    }
}

app.UseHttpsRedirection();

// CORS kimlik doğrulamadan önce çağrılmalı
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Helper method for AI Credits tables (Safe - Idempotent) - PostgreSQL only
static async Task EnsureAICreditTablesAsync(AppDbContext db)
{
    // PostgreSQL için
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AICreditPackages"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""Name"" VARCHAR(255) NOT NULL,
            ""Description"" TEXT,
            ""MonthlyCredits"" INTEGER NOT NULL,
            ""Price"" DECIMAL(18,2) NOT NULL,
            ""IsActive"" BOOLEAN NOT NULL DEFAULT TRUE,
            ""IsDefault"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW(),
            ""UpdatedAt"" TIMESTAMP
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_AICreditPackages_Name"" ON ""AICreditPackages"" (""Name"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AICreditPackages_IsDefault"" ON ""AICreditPackages"" (""IsDefault"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AICreditPackages_IsActive"" ON ""AICreditPackages"" (""IsActive"");");
    
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AIOperationCosts"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""OperationType"" VARCHAR(255) NOT NULL,
            ""Description"" TEXT,
            ""CreditCost"" INTEGER NOT NULL,
            ""IsActive"" BOOLEAN NOT NULL DEFAULT TRUE,
            ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW(),
            ""UpdatedAt"" TIMESTAMP
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_AIOperationCosts_OperationType"" ON ""AIOperationCosts"" (""OperationType"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AIOperationCosts_IsActive"" ON ""AIOperationCosts"" (""IsActive"");");
    
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserAICredits"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""UserId"" VARCHAR(450) NOT NULL,
            ""PackageId"" INTEGER NOT NULL,
            ""CurrentBalance"" INTEGER NOT NULL DEFAULT 0,
            ""BonusBalance"" INTEGER NOT NULL DEFAULT 0,
            ""TotalEarned"" INTEGER NOT NULL DEFAULT 0,
            ""TotalSpent"" INTEGER NOT NULL DEFAULT 0,
            ""LastRechargeDate"" TIMESTAMP NOT NULL,
            ""NextRechargeDate"" TIMESTAMP NOT NULL,
            ""LastPlanType"" VARCHAR(20) NOT NULL DEFAULT 'standard',
            ""LastRefreshAmount"" INTEGER NOT NULL DEFAULT 0,
            ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW(),
            ""UpdatedAt"" TIMESTAMP,
            CONSTRAINT ""FK_UserAICredits_AICreditPackages_PackageId"" FOREIGN KEY (""PackageId"") REFERENCES ""AICreditPackages"" (""Id"") ON DELETE RESTRICT
        );
    ");
    
    // BonusBalance ve LastPlanType için kolon ekleme (eğer tablo zaten varsa)
    await db.Database.ExecuteSqlRawAsync(@"
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UserAICredits' AND column_name='BonusBalance') THEN
                ALTER TABLE ""UserAICredits"" ADD COLUMN ""BonusBalance"" INTEGER NOT NULL DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UserAICredits' AND column_name='LastPlanType') THEN
                ALTER TABLE ""UserAICredits"" ADD COLUMN ""LastPlanType"" VARCHAR(20) NOT NULL DEFAULT 'standard';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UserAICredits' AND column_name='LastRefreshAmount') THEN
                ALTER TABLE ""UserAICredits"" ADD COLUMN ""LastRefreshAmount"" INTEGER NOT NULL DEFAULT 0;
            END IF;
        END $$;
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserAICredits_UserId"" ON ""UserAICredits"" (""UserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserAICredits_NextRechargeDate"" ON ""UserAICredits"" (""NextRechargeDate"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserAICredits_PackageId"" ON ""UserAICredits"" (""PackageId"");");
    
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AICreditTransactions"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""UserId"" VARCHAR(450) NOT NULL,
            ""TransactionType"" VARCHAR(50) NOT NULL,
            ""Amount"" INTEGER NOT NULL,
            ""BalanceBefore"" INTEGER NOT NULL,
            ""BalanceAfter"" INTEGER NOT NULL,
            ""OperationType"" VARCHAR(255),
            ""Description"" TEXT,
            ""ProductId"" INTEGER,
            ""IsSuccessful"" BOOLEAN NOT NULL DEFAULT TRUE,
            ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT NOW()
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AICreditTransactions_UserId"" ON ""AICreditTransactions"" (""UserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AICreditTransactions_CreatedAt"" ON ""AICreditTransactions"" (""CreatedAt"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AICreditTransactions_TransactionType"" ON ""AICreditTransactions"" (""TransactionType"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AICreditTransactions_UserId_CreatedAt"" ON ""AICreditTransactions"" (""UserId"", ""CreatedAt"");");
    
    // Seed data
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            INSERT INTO ""AICreditPackages"" (""Name"", ""Description"", ""MonthlyCredits"", ""Price"", ""IsActive"", ""IsDefault"", ""CreatedAt"")
            VALUES ('Standard', 'Aylık 50 AI kredisi içeren standart paket', 50, 0, TRUE, TRUE, NOW())
            ON CONFLICT (""Name"") DO NOTHING;
        ");
        await db.Database.ExecuteSqlRawAsync(@"
            INSERT INTO ""AICreditPackages"" (""Name"", ""Description"", ""MonthlyCredits"", ""Price"", ""IsActive"", ""IsDefault"", ""CreatedAt"")
            VALUES ('Premium', 'Aylık 300 AI kredisi içeren premium paket', 300, 0, TRUE, FALSE, NOW())
            ON CONFLICT (""Name"") DO NOTHING;
        ");
        
        await db.Database.ExecuteSqlRawAsync(@"
            INSERT INTO ""AIOperationCosts"" (""OperationType"", ""Description"", ""CreditCost"", ""IsActive"", ""CreatedAt"")
            VALUES 
                ('ProductRecognition', 'Ürün tanıma işlemi', 3, TRUE, NOW()),
                ('PriceDetection', 'Fiyat tespit işlemi', 1, TRUE, NOW()),
                ('CategoryDetection', 'Kategori tespit işlemi', 1, TRUE, NOW())
            ON CONFLICT (""OperationType"") DO NOTHING;
        ");
    }
    catch
    {
        // Seed data zaten var, hata yok
    }
}

// Helper method for AnalysisLogs tables (Safe - Idempotent) - PostgreSQL only
static async Task EnsureAnalysisLogsTablesAsync(AppDbContext db)
{
    // PostgreSQL için
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AnalysisLogs"" (
            ""Id"" VARCHAR(450) PRIMARY KEY,
            ""ProductId"" VARCHAR(450),
            ""UserId"" VARCHAR(450) NOT NULL,
            ""Language"" VARCHAR(10) NOT NULL DEFAULT 'en',
            ""PhotoCount"" INTEGER NOT NULL,
            ""FinalProductName"" TEXT,
            ""FinalConfidence"" DOUBLE PRECISION,
            ""DetectedCategory"" TEXT,
            ""ProcessingTimeMs"" BIGINT NOT NULL DEFAULT 0,
            ""IsSuccessful"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""ErrorMessage"" TEXT,
            ""CreatedAtUtc"" TIMESTAMP NOT NULL DEFAULT NOW()
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AnalysisLogs_UserId"" ON ""AnalysisLogs"" (""UserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AnalysisLogs_ProductId"" ON ""AnalysisLogs"" (""ProductId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AnalysisLogs_CreatedAtUtc"" ON ""AnalysisLogs"" (""CreatedAtUtc"");");
    
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AnalysisLogEntries"" (
            ""Id"" VARCHAR(450) PRIMARY KEY,
            ""AnalysisLogId"" VARCHAR(450) NOT NULL,
            ""Step"" VARCHAR(50) NOT NULL,
            ""StepName"" TEXT NOT NULL,
            ""Message"" TEXT NOT NULL,
            ""Data"" TEXT,
            ""Level"" VARCHAR(20) NOT NULL DEFAULT 'Information',
            ""DurationMs"" BIGINT,
            ""Order"" INTEGER NOT NULL,
            ""CreatedAtUtc"" TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT ""FK_AnalysisLogEntries_AnalysisLogs_AnalysisLogId"" FOREIGN KEY (""AnalysisLogId"") REFERENCES ""AnalysisLogs"" (""Id"") ON DELETE CASCADE
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AnalysisLogEntries_AnalysisLogId"" ON ""AnalysisLogEntries"" (""AnalysisLogId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AnalysisLogEntries_AnalysisLogId_Order"" ON ""AnalysisLogEntries"" (""AnalysisLogId"", ""Order"");");
}

// Helper method for LoginLogs table (Safe - Idempotent) - PostgreSQL only
static async Task EnsureLoginLogsTableAsync(AppDbContext db)
{
    // PostgreSQL için
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""LoginLogs"" (
            ""Id"" VARCHAR(450) PRIMARY KEY,
            ""UserId"" VARCHAR(450) NOT NULL,
            ""Email"" VARCHAR(256) NOT NULL,
            ""IpAddress"" VARCHAR(45) NOT NULL,
            ""UserAgent"" TEXT,
            ""IsSuccessful"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""FailureReason"" TEXT,
            ""CreatedAtUtc"" TIMESTAMP NOT NULL DEFAULT NOW()
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_LoginLogs_UserId"" ON ""LoginLogs"" (""UserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_LoginLogs_Email"" ON ""LoginLogs"" (""Email"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_LoginLogs_CreatedAtUtc"" ON ""LoginLogs"" (""CreatedAtUtc"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_LoginLogs_UserId_CreatedAtUtc"" ON ""LoginLogs"" (""UserId"", ""CreatedAtUtc"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_LoginLogs_IsSuccessful"" ON ""LoginLogs"" (""IsSuccessful"");");
}

// Helper method for UserDeviceInfos table (Safe - Idempotent) - PostgreSQL only
static async Task EnsureUserDeviceInfosTableAsync(AppDbContext db)
{
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserDeviceInfos"" (
            ""Id"" TEXT NOT NULL CONSTRAINT PK_UserDeviceInfos PRIMARY KEY,
            ""UserId"" TEXT NOT NULL,
            ""Platform"" TEXT NOT NULL,
            ""OsVersion"" TEXT,
            ""AppVersion"" TEXT,
            ""BuildNumber"" TEXT,
            ""DeviceModel"" TEXT,
            ""DeviceManufacturer"" TEXT,
            ""DeviceName"" TEXT,
            ""PushToken"" TEXT,
            ""HasNotificationPermission"" BOOLEAN NOT NULL DEFAULT false,
            ""IpAddress"" TEXT,
            ""UserAgent"" TEXT,
            ""LastUpdatedUtc"" TIMESTAMP NOT NULL,
            ""CreatedAtUtc"" TIMESTAMP NOT NULL
        );
    ");

    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserDeviceInfos_UserId"" ON ""UserDeviceInfos"" (""UserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserDeviceInfos_Platform"" ON ""UserDeviceInfos"" (""Platform"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserDeviceInfos_PushToken"" ON ""UserDeviceInfos"" (""PushToken"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserDeviceInfos_UserId_Platform"" ON ""UserDeviceInfos"" (""UserId"", ""Platform"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserDeviceInfos_LastUpdatedUtc"" ON ""UserDeviceInfos"" (""LastUpdatedUtc"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserDeviceInfos_UserId_LastUpdatedUtc"" ON ""UserDeviceInfos"" (""UserId"", ""LastUpdatedUtc"");");
}

// Helper method for Conversations and Messages tables (Safe - Idempotent) - PostgreSQL only
static async Task EnsureConversationsTablesAsync(AppDbContext db)
{
    // PostgreSQL için Conversations tablosu
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Conversations"" (
            ""Id"" UUID PRIMARY KEY,
            ""User1Id"" VARCHAR(450) NOT NULL,
            ""User2Id"" VARCHAR(450) NOT NULL,
            ""LastMessageText"" TEXT,
            ""LastMessageAt"" TIMESTAMP WITH TIME ZONE,
            ""LastMessageSenderId"" VARCHAR(450),
            ""UnreadCountUser1"" INTEGER NOT NULL DEFAULT 0,
            ""UnreadCountUser2"" INTEGER NOT NULL DEFAULT 0,
            ""IsDeletedByUser1"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""IsDeletedByUser2"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ""UpdatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Conversations_User1Id_User2Id"" ON ""Conversations"" (""User1Id"", ""User2Id"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Conversations_User1Id"" ON ""Conversations"" (""User1Id"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Conversations_User2Id"" ON ""Conversations"" (""User2Id"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Conversations_LastMessageAt"" ON ""Conversations"" (""LastMessageAt"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Conversations_User1Id_LastMessageAt"" ON ""Conversations"" (""User1Id"", ""LastMessageAt"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Conversations_User2Id_LastMessageAt"" ON ""Conversations"" (""User2Id"", ""LastMessageAt"");");
    
    // PostgreSQL için Messages tablosu
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Messages"" (
            ""Id"" UUID PRIMARY KEY,
            ""ConversationId"" UUID NOT NULL,
            ""SenderId"" VARCHAR(450) NOT NULL,
            ""ReceiverId"" VARCHAR(450) NOT NULL,
            ""Type"" INTEGER NOT NULL DEFAULT 0,
            ""Content"" TEXT NOT NULL,
            ""IsRead"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""ReadAt"" TIMESTAMP WITH TIME ZONE,
            ""IsDeletedBySender"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""IsDeletedByReceiver"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT ""FK_Messages_Conversations_ConversationId"" FOREIGN KEY (""ConversationId"") REFERENCES ""Conversations"" (""Id"") ON DELETE CASCADE
        );
    ");
    
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Messages_ConversationId"" ON ""Messages"" (""ConversationId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Messages_SenderId"" ON ""Messages"" (""SenderId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Messages_ReceiverId"" ON ""Messages"" (""ReceiverId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Messages_CreatedAt"" ON ""Messages"" (""CreatedAt"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Messages_ConversationId_CreatedAt"" ON ""Messages"" (""ConversationId"", ""CreatedAt"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Messages_ReceiverId_IsRead"" ON ""Messages"" (""ReceiverId"", ""IsRead"");");
}

// Entitlement (Premium) Tabloları - Idempotent
static async Task EnsureEntitlementTablesAsync(AppDbContext db)
{
    // UserEntitlements tablosu
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""UserEntitlements"" (
            ""Id"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ""UserId"" VARCHAR(450) NOT NULL,
            ""EntitlementType"" VARCHAR(50) NOT NULL,
            ""Source"" VARCHAR(50) NOT NULL,
            ""Status"" VARCHAR(50) NOT NULL,
            ""StartsAtUtc"" TIMESTAMP WITH TIME ZONE NOT NULL,
            ""EndsAtUtc"" TIMESTAMP WITH TIME ZONE,
            ""AutoRenews"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""CurrentPeriodStartUtc"" TIMESTAMP WITH TIME ZONE,
            ""CurrentPeriodEndUtc"" TIMESTAMP WITH TIME ZONE,
            ""CancelAtPeriodEnd"" BOOLEAN NOT NULL DEFAULT FALSE,
            ""CancelledAtUtc"" TIMESTAMP WITH TIME ZONE,
            ""ExternalProductId"" VARCHAR(255),
            ""ExternalSubscriptionId"" VARCHAR(255),
            ""Notes"" TEXT,
            ""PromoCodeId"" UUID,
            ""CreatedAtUtc"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ""UpdatedAtUtc"" TIMESTAMP WITH TIME ZONE,
            ""GrantedByUserId"" VARCHAR(450)
        );
    ");
    
    // UserEntitlements indexleri
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_UserId"" ON ""UserEntitlements"" (""UserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_Status"" ON ""UserEntitlements"" (""Status"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_EntitlementType"" ON ""UserEntitlements"" (""EntitlementType"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_Source"" ON ""UserEntitlements"" (""Source"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_UserId_EntitlementType_Status"" ON ""UserEntitlements"" (""UserId"", ""EntitlementType"", ""Status"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_EndsAtUtc"" ON ""UserEntitlements"" (""EndsAtUtc"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserEntitlements_ExternalSubscriptionId"" ON ""UserEntitlements"" (""ExternalSubscriptionId"");");
    
    // EntitlementEvents tablosu (audit log)
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""EntitlementEvents"" (
            ""Id"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ""EntitlementId"" UUID NOT NULL,
            ""EventType"" VARCHAR(50) NOT NULL,
            ""EventTimeUtc"" TIMESTAMP WITH TIME ZONE NOT NULL,
            ""ExternalEventId"" VARCHAR(255),
            ""RawPayloadJson"" TEXT,
            ""ProcessedAtUtc"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ""ProcessedByUserId"" VARCHAR(450),
            ""Notes"" TEXT,
            CONSTRAINT ""FK_EntitlementEvents_UserEntitlements_EntitlementId"" FOREIGN KEY (""EntitlementId"") REFERENCES ""UserEntitlements"" (""Id"") ON DELETE CASCADE
        );
    ");
    
    // EntitlementEvents indexleri
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_EntitlementEvents_EntitlementId"" ON ""EntitlementEvents"" (""EntitlementId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_EntitlementEvents_EventType"" ON ""EntitlementEvents"" (""EventType"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_EntitlementEvents_ExternalEventId"" ON ""EntitlementEvents"" (""ExternalEventId"");");
    
    // ContentReports tablosu (Şikayetler)
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""ContentReports"" (
            ""Id"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ""ReporterUserId"" VARCHAR(450) NOT NULL,
            ""ContentType"" VARCHAR(50) NOT NULL,
            ""ContentId"" VARCHAR(450) NOT NULL,
            ""Reason"" VARCHAR(50) NOT NULL,
            ""Description"" TEXT,
            ""Status"" VARCHAR(50) NOT NULL DEFAULT 'pending',
            ""AdminNote"" TEXT,
            ""ReviewedByUserId"" VARCHAR(450),
            ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ""ReviewedAt"" TIMESTAMP WITH TIME ZONE
        );
    ");
    
    // ContentReports indexleri
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_ReporterUserId"" ON ""ContentReports"" (""ReporterUserId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_ContentType"" ON ""ContentReports"" (""ContentType"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_ContentId"" ON ""ContentReports"" (""ContentId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_Status"" ON ""ContentReports"" (""Status"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_CreatedAt"" ON ""ContentReports"" (""CreatedAt"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_ContentType_ContentId"" ON ""ContentReports"" (""ContentType"", ""ContentId"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ContentReports_Status_CreatedAt"" ON ""ContentReports"" (""Status"", ""CreatedAt"");");
    
    // Unique constraint: Aynı kullanıcı aynı içeriği birden fazla kez şikayet edemez
    await db.Database.ExecuteSqlRawAsync(@"
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'IX_ContentReports_ReporterUserId_ContentType_ContentId'
            ) THEN
                CREATE UNIQUE INDEX ""IX_ContentReports_ReporterUserId_ContentType_ContentId"" 
                ON ""ContentReports"" (""ReporterUserId"", ""ContentType"", ""ContentId"");
            END IF;
        END $$;
    ");
}

// App Versions Tablosu - Idempotent
static async Task EnsureAppVersionsTableAsync(AppDbContext db)
{
    // AppVersions tablosu
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""AppVersions"" (
            ""Id"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ""Version"" VARCHAR(50) NOT NULL,
            ""IsValid"" BOOLEAN NOT NULL DEFAULT TRUE,
            ""CreatedAtUtc"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ""UpdatedAtUtc"" TIMESTAMP WITH TIME ZONE
        );
    ");
    
    // AppVersions indexleri
    await db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_AppVersions_Version"" ON ""AppVersions"" (""Version"");");
    await db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AppVersions_IsValid"" ON ""AppVersions"" (""IsValid"");");
}
