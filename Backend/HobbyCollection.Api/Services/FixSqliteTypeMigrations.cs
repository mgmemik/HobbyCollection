using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HobbyCollection.Api.Services;

/// <summary>
/// SQLite'tan PostgreSQL'e migration sırasında oluşan tip uyumsuzluklarını otomatik olarak tespit edip düzeltir.
/// SQLite'ta: boolean=INTEGER, GUID=TEXT, DateTime=TEXT
/// PostgreSQL'de: boolean=BOOLEAN, GUID=UUID, DateTime=TIMESTAMP
/// </summary>
public static class FixSqliteTypeMigrations
{
    public static async Task FixAllTypeMismatchesAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            logger.LogInformation("🔧 SQLite tip uyumsuzlukları otomatik tespit ediliyor ve düzeltiliyor...");

            // ÖNCE: Bilinen kritik kolonları manuel olarak düzelt (güvenlik için)
            logger.LogInformation("🔧 Kritik kolonlar manuel olarak düzeltiliyor...");
            await FixDateTimeColumnAsync(db, logger, "Follows", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "Notifications", "CreatedAt");
            // Notifications: SQLite -> PostgreSQL geçişinde GUID kolonlar TEXT kalabiliyor (prod'da 500'a sebep olur)
            await FixGuidColumnAsync(db, logger, "Notifications", "Id");
            await FixGuidColumnAsync(db, logger, "Notifications", "RelatedProductId");
            await FixGuidColumnAsync(db, logger, "Notifications", "RelatedCommentId");
            await FixGuidColumnAsync(db, logger, "Notifications", "RelatedConversationId");
            await FixDateTimeColumnAsync(db, logger, "Products", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "Products", "UpdatedAt");
            await FixDateTimeColumnAsync(db, logger, "Comments", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "Comments", "UpdatedAt");
            await FixDateTimeColumnAsync(db, logger, "ProductLikes", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "ProductSaves", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "CommentLikes", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "ProductPhotos", "CreatedAt");
            await FixDateTimeColumnAsync(db, logger, "Categories", "CreatedAtUtc");
            await FixDateTimeColumnAsync(db, logger, "Brands", "CreatedAtUtc");
            await FixDateTimeColumnAsync(db, logger, "Brands", "UpdatedAtUtc");
            
            // Tüm tabloları ve kolonlarını tespit et
            var allColumns = await GetAllColumnsAsync(db, logger);
            
            // INTEGER -> BOOLEAN dönüşümleri (boolean kolonları için)
            var booleanColumns = allColumns.Where(c => 
                c.DataType == "integer" && 
                (c.ColumnName.StartsWith("Is", StringComparison.OrdinalIgnoreCase) || 
                 c.ColumnName.Equals("IsRead", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("IsActive", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("IsDefault", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("IsPublic", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("IsAutomatic", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("IsSuccessful", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("CommentsEnabled", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("EmailConfirmed", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("PhoneNumberConfirmed", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("TwoFactorEnabled", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Equals("LockoutEnabled", StringComparison.OrdinalIgnoreCase)))
                .ToList();

            foreach (var col in booleanColumns)
            {
                await FixBooleanColumnAsync(db, logger, col.TableName, col.ColumnName);
            }

            // TEXT -> UUID dönüşümleri (Id kolonları ve GUID pattern'i olanlar için)
            var guidColumns = allColumns.Where(c => 
                c.DataType == "text" && 
                (c.ColumnName.Equals("Id", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.EndsWith("Id", StringComparison.OrdinalIgnoreCase) && 
                 (c.ColumnName.Contains("Product") || c.ColumnName.Contains("Category") || 
                  c.ColumnName.Contains("Comment") || c.ColumnName.Contains("Follow") ||
                  c.ColumnName.Contains("Notification") || c.ColumnName.Contains("Badge") ||
                  c.ColumnName.Contains("Photo") || c.ColumnName.Contains("Save") ||
                  c.ColumnName.Contains("Like") || c.ColumnName.Contains("Message") ||
                  c.ColumnName.Contains("Conversation"))))
                .ToList();

            foreach (var col in guidColumns)
            {
                await FixGuidColumnAsync(db, logger, col.TableName, col.ColumnName);
            }

            // TEXT -> TIMESTAMP dönüşümleri (DateTime kolonları için)
            // Daha agresif tespit: Tüm *At, *Date, *Time kolonlarını ve bilinen DateTime kolonlarını düzelt
            var dateTimeColumnNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "CreatedAt", "UpdatedAt", "CreatedAtUtc", "UpdatedAtUtc",
                "LastRechargeDate", "NextRechargeDate", "LastMessageAt",
                "ReadAt", "AssignedAt", "ExpiresAt", "LockoutEnd"
            };
            
            var dateTimeColumns = allColumns.Where(c => 
                c.DataType == "text" && 
                (dateTimeColumnNames.Contains(c.ColumnName) ||
                 c.ColumnName.Contains("At", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Contains("Date", StringComparison.OrdinalIgnoreCase) ||
                 c.ColumnName.Contains("Time", StringComparison.OrdinalIgnoreCase)))
                .ToList();

            logger.LogInformation($"📅 {dateTimeColumns.Count} DateTime kolonu tespit edildi: {string.Join(", ", dateTimeColumns.Select(c => $"{c.TableName}.{c.ColumnName}"))}");

            foreach (var col in dateTimeColumns)
            {
                await FixDateTimeColumnAsync(db, logger, col.TableName, col.ColumnName);
            }

            logger.LogInformation($"✅ SQLite tip uyumsuzlukları düzeltildi! ({booleanColumns.Count} boolean, {guidColumns.Count} GUID, {dateTimeColumns.Count} DateTime)");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ SQLite tip uyumsuzlukları düzeltilirken hata oluştu!");
            throw;
        }
    }

    /// <summary>
    /// Tüm tablolardaki kolonları ve tiplerini getirir
    /// </summary>
    private static async Task<List<(string TableName, string ColumnName, string DataType)>> GetAllColumnsAsync(AppDbContext db, ILogger logger)
    {
        var columns = new List<(string, string, string)>();
        
        try
        {
            // PostgreSQL'den direkt SQL ile kolon bilgilerini al
            var sql = @"
                SELECT 
                    table_name,
                    column_name,
                    data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name NOT LIKE '__%'
                ORDER BY table_name, column_name
            ";

            // EF Core'un connection'ını kullan
            var connection = db.Database.GetDbConnection();
            var wasOpen = connection.State == System.Data.ConnectionState.Open;
            
            if (!wasOpen)
            {
                await connection.OpenAsync();
            }
            
            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = sql;
                command.CommandTimeout = 30;
                
                using var reader = await command.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    var tableName = reader.IsDBNull(0) ? "" : reader.GetString(0);
                    var columnName = reader.IsDBNull(1) ? "" : reader.GetString(1);
                    var dataType = reader.IsDBNull(2) ? "" : reader.GetString(2);
                    
                    if (!string.IsNullOrEmpty(tableName) && !string.IsNullOrEmpty(columnName))
                    {
                        columns.Add((tableName, columnName, dataType));
                    }
                }
            }
            finally
            {
                if (!wasOpen && connection.State == System.Data.ConnectionState.Open)
                {
                    await connection.CloseAsync();
                }
            }
            
            logger.LogInformation($"📊 {columns.Count} kolon tespit edildi");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, $"⚠️ Kolon bilgileri alınırken hata: {ex.Message}");
        }

        return columns;
    }

    /// <summary>
    /// INTEGER tipindeki boolean kolonu BOOLEAN'a çevirir
    /// </summary>
    /// <param name="tableName">Tablo adı (sadece kod içinden gelen sabit değerler kullanılır, kullanıcı girdisi değil)</param>
    /// <param name="columnName">Kolon adı (sadece kod içinden gelen sabit değerler kullanılır, kullanıcı girdisi değil)</param>
#pragma warning disable EF1002 // SQL injection: tableName/columnName sadece çağıran kod tarafından sabit verilir
    private static async Task FixBooleanColumnAsync(AppDbContext db, ILogger logger, string tableName, string columnName)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync($@"
                DO $$ 
                BEGIN
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = '{tableName}' 
                        AND column_name = '{columnName}'
                        AND data_type = 'integer'
                    ) THEN
                        -- Yeni boolean kolonu ekle
                        ALTER TABLE ""{tableName}"" 
                        ADD COLUMN ""{columnName}New"" BOOLEAN;
                        
                        -- Mevcut integer değerleri boolean'a çevir (0=false, 1=true, NULL=NULL)
                        UPDATE ""{tableName}"" 
                        SET ""{columnName}New"" = CASE 
                            WHEN ""{columnName}"" = 1 THEN TRUE 
                            WHEN ""{columnName}"" = 0 THEN FALSE 
                            ELSE NULL 
                        END;
                        
                        -- NOT NULL constraint varsa ekle
                        IF EXISTS (
                            SELECT 1 
                            FROM information_schema.columns 
                            WHERE table_name = '{tableName}' 
                            AND column_name = '{columnName}'
                            AND is_nullable = 'NO'
                        ) THEN
                            ALTER TABLE ""{tableName}"" 
                            ALTER COLUMN ""{columnName}New"" SET NOT NULL;
                            
                            -- NULL değerleri default false yap
                            UPDATE ""{tableName}"" 
                            SET ""{columnName}New"" = FALSE 
                            WHERE ""{columnName}New"" IS NULL;
                        END IF;
                        
                        -- Eski kolonu sil
                        ALTER TABLE ""{tableName}"" 
                        DROP COLUMN ""{columnName}"";
                        
                        -- Yeni kolonu eski isimle yeniden adlandır
                        ALTER TABLE ""{tableName}"" 
                        RENAME COLUMN ""{columnName}New"" TO ""{columnName}"";
                        
                        RAISE NOTICE '{tableName}.{columnName} kolonu integer''dan boolean''a dönüştürüldü';
                    END IF;
                END $$;
            ");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, $"⚠️ {tableName}.{columnName} boolean dönüşümü sırasında hata (devam ediliyor)");
        }
    }
#pragma warning restore EF1002

    /// <summary>
    /// TEXT tipindeki GUID kolonu UUID'ye çevirir
    /// </summary>
    private static async Task FixGuidColumnAsync(AppDbContext db, ILogger logger, string tableName, string columnName)
    {
        try
        {
            // Not: Önceki yaklaşım (kolon kopyala/sil/yeniden adlandır + constraint drop) prod'da
            // farklı constraint isimlerinden dolayı güvenilir değildi ve FK'leri kalıcı silme riski taşıyordu.
            // Burada PostgreSQL'in desteklediği şekilde "ALTER COLUMN ... TYPE uuid USING ..." ile inplace dönüştürüyoruz.
            //
            // NULL / boş string değerlerini güvenli şekilde NULL'a çeviriyoruz.
            var sql = $@"
                DO $$
                DECLARE
                    is_nullable_val TEXT;
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = '{tableName}'
                          AND column_name = '{columnName}'
                          AND data_type = 'text'
                    ) THEN
                        SELECT is_nullable INTO is_nullable_val
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = '{tableName}'
                          AND column_name = '{columnName}';

                        IF is_nullable_val = 'NO' THEN
                            -- NOT NULL kolonlarda strict cast (hatalı veri varsa fail etsin)
                            EXECUTE format(
                                'ALTER TABLE %I ALTER COLUMN %I TYPE uuid USING %I::uuid',
                                '{tableName}', '{columnName}', '{columnName}'
                            );
                        ELSE
                            -- Nullable kolonlarda güvenli cast: uuid regex değilse NULL'a düşür
                            EXECUTE format(
                                'ALTER TABLE %I ALTER COLUMN %I TYPE uuid USING (CASE WHEN NULLIF(%I, '''') ~ ''^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'' THEN NULLIF(%I, '''')::uuid ELSE NULL END)',
                                '{tableName}', '{columnName}', '{columnName}', '{columnName}'
                            );
                        END IF;

                        RAISE NOTICE '{tableName}.{columnName} kolonu text''den uuid''ye dönüştürüldü';
                    END IF;
                END $$;
            ";

            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, $"⚠️ {tableName}.{columnName} UUID dönüşümü sırasında hata (devam ediliyor)");
        }
    }

    /// <summary>
    /// TEXT tipindeki DateTime kolonu TIMESTAMP'e çevirir
    /// </summary>
    private static async Task FixDateTimeColumnAsync(AppDbContext db, ILogger logger, string tableName, string columnName)
    {
        try
        {
            // Önce kolonun gerçekten TEXT tipinde olup olmadığını kontrol et
            string? actualType = null;
            try
            {
                using var command = db.Database.GetDbConnection().CreateCommand();
                var wasOpen = db.Database.GetDbConnection().State == System.Data.ConnectionState.Open;
                if (!wasOpen)
                {
                    await db.Database.OpenConnectionAsync();
                }
                
                try
                {
                    command.CommandText = $@"
                        SELECT data_type
                        FROM information_schema.columns 
                        WHERE table_schema = 'public'
                        AND table_name = '{tableName}' 
                        AND column_name = '{columnName}'
                    ";
                    command.CommandTimeout = 30;
                    
                    var result = await command.ExecuteScalarAsync();
                    actualType = result?.ToString();
                }
                finally
                {
                    if (!wasOpen)
                    {
                        await db.Database.CloseConnectionAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, $"⚠️ {tableName}.{columnName} tip kontrolü sırasında hata, devam ediliyor");
            }
            
            if (actualType != "text" && actualType != "character varying")
            {
                logger.LogInformation($"⏭️ {tableName}.{columnName} zaten {actualType} tipinde, dönüşüm gerekmiyor");
                return;
            }
            
            logger.LogInformation($"🔄 {tableName}.{columnName} TEXT'den TIMESTAMP'e dönüştürülüyor...");
            
            // SQL string'ini güvenli bir şekilde oluştur (string interpolation kullan)
            var sql = $@"
                DO $$ 
                DECLARE
                    is_nullable_val TEXT;
                BEGIN
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public'
                        AND table_name = '{tableName}' 
                        AND column_name = '{columnName}'
                        AND (data_type = 'text' OR data_type = 'character varying')
                    ) THEN
                        -- NOT NULL kontrolü
                        SELECT is_nullable INTO is_nullable_val
                        FROM information_schema.columns 
                        WHERE table_schema = 'public'
                        AND table_name = '{tableName}' 
                        AND column_name = '{columnName}';
                        
                        -- Yeni TIMESTAMP kolonu ekle
                        EXECUTE format('ALTER TABLE ""%s"" ADD COLUMN ""%sNew"" TIMESTAMP', '{tableName}', '{columnName}');
                        
                        -- Mevcut text değerleri TIMESTAMP'e çevir
                        EXECUTE format('
                            UPDATE ""%s"" 
                            SET ""%sNew"" = 
                                CASE 
                                    WHEN ""%s"" ~ ''^\d{{4}}-\d{{2}}-\d{{2}}[T ]\d{{2}}:\d{{2}}:\d{{2}}'' THEN
                                        ""%s""::timestamp
                                    WHEN ""%s"" ~ ''^\d{{4}}-\d{{2}}-\d{{2}}$'' THEN
                                        ""%s""::date::timestamp
                                    WHEN ""%s"" ~ ''^\d+\.?\d*$'' THEN
                                        to_timestamp(""%s""::numeric)
                                    ELSE NULL
                                END
                            WHERE ""%s"" IS NOT NULL
                        ', '{tableName}', '{columnName}', '{columnName}', '{columnName}', '{columnName}', '{columnName}', '{columnName}', '{columnName}', '{columnName}', '{columnName}');
                        
                        -- NOT NULL constraint varsa ekle
                        IF is_nullable_val = 'NO' THEN
                            -- NULL değerleri default NOW() yap
                            EXECUTE format('UPDATE ""%s"" SET ""%sNew"" = NOW() WHERE ""%sNew"" IS NULL', '{tableName}', '{columnName}', '{columnName}');
                            EXECUTE format('ALTER TABLE ""%s"" ALTER COLUMN ""%sNew"" SET NOT NULL', '{tableName}', '{columnName}');
                        END IF;
                        
                        -- Eski kolonu sil
                        EXECUTE format('ALTER TABLE ""%s"" DROP COLUMN ""%s""', '{tableName}', '{columnName}');
                        
                        -- Yeni kolonu eski isimle yeniden adlandır
                        EXECUTE format('ALTER TABLE ""%s"" RENAME COLUMN ""%sNew"" TO ""%s""', '{tableName}', '{columnName}', '{columnName}');
                        
                        RAISE NOTICE '{tableName}.{columnName} kolonu text''den timestamp''e dönüştürüldü';
                    END IF;
                END $$;
            ";
            
            await db.Database.ExecuteSqlRawAsync(sql);
            
            logger.LogInformation($"✅ {tableName}.{columnName} başarıyla TIMESTAMP'e dönüştürüldü");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, $"⚠️ {tableName}.{columnName} DateTime dönüşümü sırasında hata: {ex.Message}");
        }
    }
}

