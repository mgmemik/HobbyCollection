-- Migration: AddRelatedFollowIdToNotification
-- Bu script hem dev hem production ortamında güvenle çalıştırılabilir
-- Veri kaybı olmaz, sadece yeni kolon eklenir

-- Notifications tablosuna RelatedFollowId kolonu ekle (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Notifications' 
        AND column_name = 'RelatedFollowId'
    ) THEN
        ALTER TABLE "Notifications" 
        ADD COLUMN "RelatedFollowId" TEXT;
        RAISE NOTICE 'RelatedFollowId kolonu eklendi';
    ELSE
        RAISE NOTICE 'RelatedFollowId kolonu zaten mevcut';
    END IF;
END $$;

-- Migration kaydını kontrol et ve ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM "__EFMigrationsHistory" 
        WHERE "MigrationId" = '20250122000001_AddRelatedFollowIdToNotification'
    ) THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20250122000001_AddRelatedFollowIdToNotification', '8.0.0');
        RAISE NOTICE 'Migration kaydı eklendi';
    ELSE
        RAISE NOTICE 'Migration kaydı zaten mevcut';
    END IF;
END $$;

-- Başarı mesajı
SELECT 'Migration başarıyla uygulandı!' AS result;

