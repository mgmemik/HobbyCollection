-- Migration: AddMessageSoftDelete
-- Date: 2025-01-23
-- Description: Adds soft delete columns to Messages table

-- Messages tablosuna soft delete kolonları ekle
ALTER TABLE "Messages" 
ADD COLUMN IF NOT EXISTS "IsDeletedBySender" boolean NOT NULL DEFAULT false;

ALTER TABLE "Messages" 
ADD COLUMN IF NOT EXISTS "IsDeletedByReceiver" boolean NOT NULL DEFAULT false;

-- Migration history'ye ekle
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250123000001_AddMessageSoftDelete', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

SELECT 'Migration completed successfully!' AS result;

