using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Services;

/// <summary>
/// Otomatik migration servisi - Uygulama başlatıldığında migration'ları kontrol eder ve uygular
/// </summary>
public static class MigrationService
{
    /// <summary>
    /// UserDeviceInfos tablosuna NotificationsEnabled kolonu ekler (idempotent).
    /// Uygulama içi bildirim ayarı için kullanılır.
    /// </summary>
    public static async Task ApplyUserDeviceNotificationsEnabledAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            logger.LogInformation("🔔 UserDeviceInfos.NotificationsEnabled migration kontrol ediliyor...");

            await db.Database.ExecuteSqlRawAsync(@"
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'UserDeviceInfos' AND column_name = 'NotificationsEnabled'
                    ) THEN
                        ALTER TABLE ""UserDeviceInfos""
                        ADD COLUMN ""NotificationsEnabled"" boolean NOT NULL DEFAULT true;
                        RAISE NOTICE 'UserDeviceInfos.NotificationsEnabled kolonu eklendi';
                    END IF;
                END $$;
            ");

            logger.LogInformation("✅ UserDeviceInfos.NotificationsEnabled migration tamam.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ NotificationsEnabled migration uygulanırken hata oluştu!");
            throw;
        }
    }

    /// <summary>
    /// Badge sistemi migration'ını uygular (idempotent - güvenli bir şekilde birden fazla kez çalıştırılabilir)
    /// </summary>
    public static async Task ApplyBadgeMigrationAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            logger.LogInformation("🏅 Badge sistemi migration kontrol ediliyor...");

            // Önce Products tablosunda IsRare kolonu var mı kontrol et
            var columnExists = await db.Database.ExecuteSqlRawAsync(@"
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'Products' AND column_name = 'IsRare'
                    ) THEN
                        -- Products tablosuna badge alanlarını ekle
                        ALTER TABLE ""Products"" 
                        ADD COLUMN ""IsRare"" boolean NOT NULL DEFAULT false,
                        ADD COLUMN ""IsMint"" boolean NOT NULL DEFAULT false,
                        ADD COLUMN ""IsGraded"" boolean NOT NULL DEFAULT false,
                        ADD COLUMN ""IsSigned"" boolean NOT NULL DEFAULT false,
                        ADD COLUMN ""IsLimited"" boolean NOT NULL DEFAULT false,
                        ADD COLUMN ""IsFeatured"" boolean NOT NULL DEFAULT false;
                        
                        RAISE NOTICE 'Products tablosuna badge alanları eklendi';
                    END IF;
                END $$;
            ");

            // ProductBadges tablosunu oluştur (eğer yoksa)
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ProductBadges"" (
                    ""Id"" uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                    ""ProductId"" uuid NOT NULL,
                    ""Badge"" integer NOT NULL,
                    ""IsAutomatic"" boolean NOT NULL DEFAULT true,
                    ""AssignedAt"" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
                    ""ExpiresAt"" timestamp with time zone NULL,
                    CONSTRAINT ""FK_ProductBadges_Products"" FOREIGN KEY (""ProductId"") 
                        REFERENCES ""Products"" (""Id"") ON DELETE CASCADE
                );
            ");

            // Index'leri oluştur
            await db.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_ProductBadges_ProductId"" ON ""ProductBadges"" (""ProductId"");
                CREATE INDEX IF NOT EXISTS ""IX_ProductBadges_Badge"" ON ""ProductBadges"" (""Badge"");
                CREATE INDEX IF NOT EXISTS ""IX_ProductBadges_ExpiresAt"" ON ""ProductBadges"" (""ExpiresAt"");
                
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes 
                        WHERE indexname = 'IX_ProductBadges_ProductId_Badge'
                    ) THEN
                        CREATE UNIQUE INDEX ""IX_ProductBadges_ProductId_Badge"" 
                        ON ""ProductBadges"" (""ProductId"", ""Badge"");
                    END IF;
                END $$;
            ");

            // Comments ekle (varsa hata vermesin)
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$
                BEGIN
                    COMMENT ON TABLE ""ProductBadges"" IS 'Ürün rozetleri - Retro koleksiyoncular için özel badge sistemi';
                    COMMENT ON COLUMN ""ProductBadges"".""Badge"" IS 'Badge türü: 1=Hot, 2=New, 3=Rare, 4=Mint, 5=Graded, 6=Signed, 7=Limited, 8=Featured, 9=Trending, 10=Sale';
                    COMMENT ON COLUMN ""Products"".""IsRare"" IS 'Nadir ürün rozeti';
                    COMMENT ON COLUMN ""Products"".""IsMint"" IS 'Mint kondisyon rozeti';
                    COMMENT ON COLUMN ""Products"".""IsGraded"" IS 'Profesyonel puanlanmış rozeti';
                    COMMENT ON COLUMN ""Products"".""IsSigned"" IS 'İmzalı/otograflı rozeti';
                    COMMENT ON COLUMN ""Products"".""IsLimited"" IS 'Sınırlı üretim rozeti';
                    COMMENT ON COLUMN ""Products"".""IsFeatured"" IS 'Editör seçimi rozeti';
                EXCEPTION
                    WHEN OTHERS THEN NULL; -- Comments eklerken hata olursa devam et
                END $$;
            ");

            // Mevcut ürünler için otomatik badge'leri hesapla (sadece bir kez)
            await db.Database.ExecuteSqlRawAsync(@"
                -- NEW Badge: Son 7 günde eklenen ürünler
                INSERT INTO ""ProductBadges"" (""ProductId"", ""Badge"", ""IsAutomatic"", ""AssignedAt"", ""ExpiresAt"")
                SELECT 
                    ""Id"" as ""ProductId"",
                    2 as ""Badge"",
                    true as ""IsAutomatic"",
                    now() AT TIME ZONE 'utc' as ""AssignedAt"",
                    ""CreatedAt"" + INTERVAL '7 days' as ""ExpiresAt""
                FROM ""Products""
                WHERE ""CreatedAt"" >= (now() AT TIME ZONE 'utc') - INTERVAL '7 days'
                ON CONFLICT (""ProductId"", ""Badge"") DO NOTHING;

                -- HOT Badge: 10+ beğeni alan ürünler
                INSERT INTO ""ProductBadges"" (""ProductId"", ""Badge"", ""IsAutomatic"", ""AssignedAt"", ""ExpiresAt"")
                SELECT 
                    p.""Id"" as ""ProductId"",
                    1 as ""Badge"",
                    true as ""IsAutomatic"",
                    now() AT TIME ZONE 'utc' as ""AssignedAt"",
                    NULL as ""ExpiresAt""
                FROM ""Products"" p
                WHERE (
                    SELECT COUNT(*) 
                    FROM ""ProductLikes"" pl 
                    WHERE pl.""ProductId"" = p.""Id""
                ) >= 10
                ON CONFLICT (""ProductId"", ""Badge"") DO NOTHING;
            ");

            logger.LogInformation("✅ Badge sistemi migration başarıyla uygulandı!");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Badge migration uygulanırken hata oluştu!");
            throw;
        }
    }

    /// <summary>
    /// IsPrivateAccount migration'ını uygular (idempotent - güvenli bir şekilde birden fazla kez çalıştırılabilir)
    /// </summary>
    public static async Task ApplyPrivateAccountMigrationAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            logger.LogInformation("🔒 IsPrivateAccount migration kontrol ediliyor...");

            // AspNetUsers tablosuna IsPrivateAccount kolonu ekle (eğer yoksa)
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'AspNetUsers' 
                        AND column_name = 'IsPrivateAccount'
                    ) THEN
                        ALTER TABLE ""AspNetUsers"" 
                        ADD COLUMN ""IsPrivateAccount"" boolean NOT NULL DEFAULT false;
                        RAISE NOTICE 'IsPrivateAccount kolonu eklendi';
                    ELSE
                        RAISE NOTICE 'IsPrivateAccount kolonu zaten mevcut';
                    END IF;
                END $$;
            ");

            // Follows tablosuna Status kolonu ekle (eğer yoksa)
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
                        ADD COLUMN ""Status"" integer NOT NULL DEFAULT 1;
                        RAISE NOTICE 'Status kolonu eklendi';
                    ELSE
                        RAISE NOTICE 'Status kolonu zaten mevcut';
                    END IF;
                END $$;
            ");

            // Migration kaydını kontrol et ve ekle (eğer yoksa)
            // __EFMigrationsHistory tablosu yoksa atla (EF Core otomatik oluşturur)
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$
                BEGIN
                    -- Önce tablonun var olup olmadığını kontrol et
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '__EFMigrationsHistory'
                    ) THEN
                        IF NOT EXISTS (
                            SELECT 1 
                            FROM ""__EFMigrationsHistory"" 
                            WHERE ""MigrationId"" = '20250122000000_AddPrivateAccountAndFollowStatus'
                        ) THEN
                            INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                            VALUES ('20250122000000_AddPrivateAccountAndFollowStatus', '8.0.0');
                            RAISE NOTICE 'Migration kaydı eklendi';
                        ELSE
                            RAISE NOTICE 'Migration kaydı zaten mevcut';
                        END IF;
                    ELSE
                        RAISE NOTICE '__EFMigrationsHistory tablosu yok, migration kaydı atlanıyor';
                    END IF;
                END $$;
            ");

            logger.LogInformation("✅ IsPrivateAccount migration başarıyla uygulandı!");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ IsPrivateAccount migration uygulanırken hata oluştu!");
            throw;
        }
    }

    /// <summary>
    /// IsWebProfilePublic migration'ını uygular (idempotent - güvenli bir şekilde birden fazla kez çalıştırılabilir)
    /// </summary>
    public static async Task ApplyWebProfilePublicMigrationAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            logger.LogInformation("🌐 IsWebProfilePublic migration başlatılıyor...");

            // AspNetUsers tablosuna IsWebProfilePublic kolonu ekle (IF NOT EXISTS ile güvenli)
            // Bu yöntem idempotent - birden fazla kez çalıştırılabilir
            logger.LogInformation("📝 IsWebProfilePublic kolonu kontrol ediliyor ve ekleniyor...");
            
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'AspNetUsers' 
                        AND column_name = 'IsWebProfilePublic'
                    ) THEN
                        -- NULL olarak ekle (standart kullanıcılar için null, premium kullanıcılar true/false set edebilir)
                        ALTER TABLE ""AspNetUsers"" 
                        ADD COLUMN ""IsWebProfilePublic"" boolean;
                        RAISE NOTICE 'IsWebProfilePublic kolonu eklendi (NULL olarak)';
                    ELSE
                        RAISE NOTICE 'IsWebProfilePublic kolonu zaten mevcut';
                    END IF;
                END $$;
            ");
            
            logger.LogInformation("✅ IsWebProfilePublic kolonu ekleme komutu çalıştırıldı!");

            // Mevcut false değerlerini null yap (standart kullanıcılar için)
            // NOT NULL kolonu varsa, önce NULL yapılabilir hale getir
            logger.LogInformation("📝 Mevcut IsWebProfilePublic değerleri güncelleniyor (standart kullanıcılar için null)...");
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$
                BEGIN
                    -- Eğer kolon NOT NULL ise, önce NULL yapılabilir hale getir
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'AspNetUsers' 
                        AND column_name = 'IsWebProfilePublic'
                        AND is_nullable = 'NO'
                    ) THEN
                        -- NOT NULL kolonu NULL yapılabilir hale getir
                        ALTER TABLE ""AspNetUsers"" 
                        ALTER COLUMN ""IsWebProfilePublic"" DROP NOT NULL;
                        RAISE NOTICE 'IsWebProfilePublic kolonu NULL yapılabilir hale getirildi';
                    END IF;
                    
                    -- Tüm false değerlerini null yap (standart kullanıcılar için)
                    -- Premium kullanıcılar daha sonra true/false set edebilir
                    UPDATE ""AspNetUsers""
                    SET ""IsWebProfilePublic"" = NULL
                    WHERE ""IsWebProfilePublic"" = false;
                    RAISE NOTICE 'Mevcut false değerleri null yapıldı';
                END $$;
            ");
            logger.LogInformation("✅ IsWebProfilePublic değerleri güncellendi!");

            // Doğrulama: Kolonun gerçekten eklendiğini kontrol et (SQL ile - null değerleri handle eder)
            logger.LogInformation("📝 Kolon doğrulaması yapılıyor...");
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$
                DECLARE
                    col_exists INTEGER;
                BEGIN
                    SELECT COUNT(*) INTO col_exists
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'AspNetUsers' 
                    AND column_name = 'IsWebProfilePublic';
                    
                    IF col_exists = 0 THEN
                        RAISE EXCEPTION 'IsWebProfilePublic kolonu bulunamadı!';
                    END IF;
                END $$;
            ");
            logger.LogInformation("✅ IsWebProfilePublic kolonu başarıyla doğrulandı!");

            // Migration kaydını kontrol et ve ekle (eğer yoksa)
            // __EFMigrationsHistory tablosu yoksa atla (EF Core otomatik oluşturur)
            logger.LogInformation("📝 Migration kaydı kontrol ediliyor...");
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$
                BEGIN
                    -- Önce tablonun var olup olmadığını kontrol et
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '__EFMigrationsHistory'
                    ) THEN
                        IF NOT EXISTS (
                            SELECT 1 
                            FROM ""__EFMigrationsHistory"" 
                            WHERE ""MigrationId"" = '20260110000000_AddWebProfilePublic'
                        ) THEN
                            INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                            VALUES ('20260110000000_AddWebProfilePublic', '8.0.0');
                            RAISE NOTICE 'Migration kaydı eklendi';
                        ELSE
                            RAISE NOTICE 'Migration kaydı zaten mevcut';
                        END IF;
                    ELSE
                        RAISE NOTICE '__EFMigrationsHistory tablosu yok, migration kaydı atlanıyor';
                    END IF;
                END $$;
            ");
            logger.LogInformation("✅ Migration kaydı kontrol edildi!");

            logger.LogInformation("✅✅ IsWebProfilePublic migration başarıyla tamamlandı ve doğrulandı!");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌❌ IsWebProfilePublic migration uygulanırken KRİTİK HATA oluştu!");
            logger.LogError("❌ Hata mesajı: {Message}", ex.Message);
            if (ex.InnerException != null)
            {
                logger.LogError("❌ Inner exception: {InnerMessage}", ex.InnerException.Message);
            }
            logger.LogError("❌ Stack trace: {StackTrace}", ex.StackTrace);
            throw; // Exception'ı tekrar fırlat - Program.cs'de yakalanacak
        }
    }

    /// <summary>
    /// Mevcut kullanıcılara email'den unique username atar (idempotent)
    /// </summary>
    public static async Task ApplyUsernameGenerationMigrationAsync(
        AppDbContext db, 
        ILogger logger, 
        UsernameService usernameService)
    {
        try
        {
            logger.LogInformation("👤 Username generation migration başlatılıyor...");

            // Email ile aynı olan veya boş olan username'lere bak
            var usersNeedingUsername = await db.Users
                .OfType<ApplicationUser>()
                .Where(u => u.UserName == null || u.UserName == u.Email || u.UserName == "")
                .ToListAsync();

            if (!usersNeedingUsername.Any())
            {
                logger.LogInformation("✅ Tüm kullanıcıların zaten unique username'i var.");
                return;
            }

            logger.LogInformation($"📝 {usersNeedingUsername.Count} kullanıcıya username atanacak...");

            foreach (var user in usersNeedingUsername)
            {
                try
                {
                    if (string.IsNullOrEmpty(user.Email))
                    {
                        logger.LogWarning($"⚠️ User {user.Id} has no email, skipping...");
                        continue;
                    }

                    var username = await usernameService.GenerateUsernameFromEmailAsync(user.Email);
                    user.UserName = username;
                    
                    logger.LogInformation($"✅ User {user.Email} -> username: {username}");
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, $"❌ Error generating username for user {user.Id}");
                }
            }

            await db.SaveChangesAsync();
            
            logger.LogInformation($"✅ Username generation migration tamamlandı! {usersNeedingUsername.Count} kullanıcı güncellendi.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Username generation migration uygulanırken hata oluştu!");
            throw;
        }
    }

    /// <summary>
    /// DisplayName kolonunu kaldırır (idempotent - güvenli bir şekilde birden fazla kez çalıştırılabilir)
    /// DisplayName kaldırıldı, artık sadece UserName kullanılıyor
    /// </summary>
    public static async Task RemoveDisplayNameColumnAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            logger.LogInformation("🗑️ DisplayName kolonu kaldırma migration başlatılıyor...");

            // DisplayName kolonu varsa kaldır
            await db.Database.ExecuteSqlRawAsync(@"
                DO $$ 
                BEGIN
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'AspNetUsers' 
                        AND column_name = 'DisplayName'
                    ) THEN
                        ALTER TABLE ""AspNetUsers"" 
                        DROP COLUMN ""DisplayName"";
                        RAISE NOTICE 'DisplayName kolonu kaldırıldı';
                    ELSE
                        RAISE NOTICE 'DisplayName kolonu zaten mevcut değil';
                    END IF;
                END $$;
            ");
            
            logger.LogInformation("✅ DisplayName kolonu kaldırma migration tamamlandı!");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ DisplayName kolonu kaldırma migration uygulanırken hata oluştu!");
            // Kritik değil, sadece log et (kolon zaten kullanılmıyor)
            logger.LogWarning("⚠️ DisplayName kolonu kaldırılamadı, ancak kod zaten DisplayName kullanmıyor. Devam ediliyor...");
        }
    }
}

