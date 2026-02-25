-- Follows.CreatedAt kolonunu TEXT'den TIMESTAMP'e dönüştür
-- Idempotent: Birden fazla kez çalıştırılabilir

DO $$ 
DECLARE
    is_nullable_val TEXT;
    col_exists BOOLEAN;
BEGIN
    -- Kolonun TEXT tipinde olup olmadığını kontrol et
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'Follows' 
        AND column_name = 'CreatedAt'
        AND (data_type = 'text' OR data_type = 'character varying')
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE 'Follows.CreatedAt kolonu TEXT tipinde, TIMESTAMP''e dönüştürülüyor...';
        
        -- NOT NULL kontrolü
        SELECT is_nullable INTO is_nullable_val
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'Follows' 
        AND column_name = 'CreatedAt';
        
        -- Yeni TIMESTAMP kolonu ekle
        ALTER TABLE "Follows" 
        ADD COLUMN "CreatedAtNew" TIMESTAMP;
        
        -- Mevcut text değerleri TIMESTAMP'e çevir
        UPDATE "Follows" 
        SET "CreatedAtNew" = 
            CASE 
                WHEN "CreatedAt" ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}' THEN
                    "CreatedAt"::timestamp
                WHEN "CreatedAt" ~ '^\d{4}-\d{2}-\d{2}$' THEN
                    "CreatedAt"::date::timestamp
                WHEN "CreatedAt" ~ '^\d+\.?\d*$' THEN
                    to_timestamp("CreatedAt"::numeric)
                ELSE NULL
            END
        WHERE "CreatedAt" IS NOT NULL;
        
        -- NOT NULL constraint varsa ekle
        IF is_nullable_val = 'NO' THEN
            -- NULL değerleri default NOW() yap
            UPDATE "Follows" 
            SET "CreatedAtNew" = NOW() 
            WHERE "CreatedAtNew" IS NULL;
            
            ALTER TABLE "Follows" 
            ALTER COLUMN "CreatedAtNew" SET NOT NULL;
        END IF;
        
        -- Eski kolonu sil
        ALTER TABLE "Follows" 
        DROP COLUMN "CreatedAt";
        
        -- Yeni kolonu eski isimle yeniden adlandır
        ALTER TABLE "Follows" 
        RENAME COLUMN "CreatedAtNew" TO "CreatedAt";
        
        RAISE NOTICE 'Follows.CreatedAt kolonu başarıyla TIMESTAMP''e dönüştürüldü!';
    ELSE
        RAISE NOTICE 'Follows.CreatedAt kolonu zaten TIMESTAMP tipinde veya mevcut değil.';
    END IF;
END $$;

-- Notifications.CreatedAt kolonunu da kontrol et ve düzelt
DO $$ 
DECLARE
    is_nullable_val TEXT;
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'Notifications' 
        AND column_name = 'CreatedAt'
        AND (data_type = 'text' OR data_type = 'character varying')
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE 'Notifications.CreatedAt kolonu TEXT tipinde, TIMESTAMP''e dönüştürülüyor...';
        
        SELECT is_nullable INTO is_nullable_val
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'Notifications' 
        AND column_name = 'CreatedAt';
        
        ALTER TABLE "Notifications" 
        ADD COLUMN "CreatedAtNew" TIMESTAMP;
        
        UPDATE "Notifications" 
        SET "CreatedAtNew" = 
            CASE 
                WHEN "CreatedAt" ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}' THEN
                    "CreatedAt"::timestamp
                WHEN "CreatedAt" ~ '^\d{4}-\d{2}-\d{2}$' THEN
                    "CreatedAt"::date::timestamp
                WHEN "CreatedAt" ~ '^\d+\.?\d*$' THEN
                    to_timestamp("CreatedAt"::numeric)
                ELSE NULL
            END
        WHERE "CreatedAt" IS NOT NULL;
        
        IF is_nullable_val = 'NO' THEN
            UPDATE "Notifications" 
            SET "CreatedAtNew" = NOW() 
            WHERE "CreatedAtNew" IS NULL;
            
            ALTER TABLE "Notifications" 
            ALTER COLUMN "CreatedAtNew" SET NOT NULL;
        END IF;
        
        ALTER TABLE "Notifications" 
        DROP COLUMN "CreatedAt";
        
        ALTER TABLE "Notifications" 
        RENAME COLUMN "CreatedAtNew" TO "CreatedAt";
        
        RAISE NOTICE 'Notifications.CreatedAt kolonu başarıyla TIMESTAMP''e dönüştürüldü!';
    ELSE
        RAISE NOTICE 'Notifications.CreatedAt kolonu zaten TIMESTAMP tipinde veya mevcut değil.';
    END IF;
END $$;

