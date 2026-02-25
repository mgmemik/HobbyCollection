-- Migration: AddPrivateAccountAndFollowStatus
-- Bu script hem dev hem production ortamında güvenle çalıştırılabilir
-- Veri kaybı olmaz, sadece yeni kolonlar eklenir

-- 1. AspNetUsers tablosuna IsPrivateAccount kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AspNetUsers' 
        AND column_name = 'IsPrivateAccount'
    ) THEN
        ALTER TABLE "AspNetUsers" 
        ADD COLUMN "IsPrivateAccount" boolean NOT NULL DEFAULT false;
        RAISE NOTICE 'IsPrivateAccount kolonu eklendi';
    ELSE
        RAISE NOTICE 'IsPrivateAccount kolonu zaten mevcut';
    END IF;
END $$;

-- 2. Follows tablosuna Status kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Follows' 
        AND column_name = 'Status'
    ) THEN
        ALTER TABLE "Follows" 
        ADD COLUMN "Status" integer NOT NULL DEFAULT 1;
        RAISE NOTICE 'Status kolonu eklendi';
    ELSE
        RAISE NOTICE 'Status kolonu zaten mevcut';
    END IF;
END $$;

-- 3. Migration kaydını kontrol et ve ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM "__EFMigrationsHistory" 
        WHERE "MigrationId" = '20250122000000_AddPrivateAccountAndFollowStatus'
    ) THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20250122000000_AddPrivateAccountAndFollowStatus', '8.0.0');
        RAISE NOTICE 'Migration kaydı eklendi';
    ELSE
        RAISE NOTICE 'Migration kaydı zaten mevcut';
    END IF;
END $$;

-- Başarı mesajı
SELECT 'Migration başarıyla uygulandı!' AS result;

