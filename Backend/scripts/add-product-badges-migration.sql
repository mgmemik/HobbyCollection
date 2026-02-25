-- Migration: Add Product Badges System
-- Date: 2024-11-25
-- Description: Retro koleksiyoncular için badge sistemi - Hot, New, Rare, Mint, vb.

-- 1. Product tablosuna badge alanlarını ekle
ALTER TABLE "Products" 
ADD COLUMN IF NOT EXISTS "IsRare" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "IsMint" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "IsGraded" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "IsSigned" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "IsLimited" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "IsFeatured" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "IsOnSale" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "OriginalPrice" numeric(18,2) NULL;

-- 2. ProductBadgeInfo tablosunu oluştur
CREATE TABLE IF NOT EXISTS "ProductBadges" (
    "Id" uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "ProductId" uuid NOT NULL,
    "Badge" integer NOT NULL,
    "IsAutomatic" boolean NOT NULL DEFAULT true,
    "AssignedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    "ExpiresAt" timestamp with time zone NULL,
    CONSTRAINT "FK_ProductBadges_Products" FOREIGN KEY ("ProductId") 
        REFERENCES "Products" ("Id") ON DELETE CASCADE
);

-- 3. Index'leri oluştur (performance için)
CREATE INDEX IF NOT EXISTS "IX_ProductBadges_ProductId" ON "ProductBadges" ("ProductId");
CREATE INDEX IF NOT EXISTS "IX_ProductBadges_Badge" ON "ProductBadges" ("Badge");
CREATE INDEX IF NOT EXISTS "IX_ProductBadges_ExpiresAt" ON "ProductBadges" ("ExpiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_ProductBadges_ProductId_Badge" ON "ProductBadges" ("ProductId", "Badge");

-- 4. Mevcut ürünler için otomatik badge'leri hesapla ve ekle
-- NEW Badge: Son 7 günde eklenen ürünler
INSERT INTO "ProductBadges" ("ProductId", "Badge", "IsAutomatic", "AssignedAt", "ExpiresAt")
SELECT 
    "Id" as "ProductId",
    2 as "Badge", -- ProductBadge.New = 2
    true as "IsAutomatic",
    now() AT TIME ZONE 'utc' as "AssignedAt",
    "CreatedAt" + INTERVAL '7 days' as "ExpiresAt"
FROM "Products"
WHERE "CreatedAt" >= (now() AT TIME ZONE 'utc') - INTERVAL '7 days'
ON CONFLICT ("ProductId", "Badge") DO NOTHING;

-- HOT Badge: 10+ beğeni alan ürünler
INSERT INTO "ProductBadges" ("ProductId", "Badge", "IsAutomatic", "AssignedAt", "ExpiresAt")
SELECT 
    p."Id" as "ProductId",
    1 as "Badge", -- ProductBadge.Hot = 1
    true as "IsAutomatic",
    now() AT TIME ZONE 'utc' as "AssignedAt",
    NULL as "ExpiresAt"
FROM "Products" p
WHERE (
    SELECT COUNT(*) 
    FROM "ProductLikes" pl 
    WHERE pl."ProductId" = p."Id"
) >= 10
ON CONFLICT ("ProductId", "Badge") DO NOTHING;

-- TRENDING Badge: Son 3 günde 5+ beğeni alan ürünler
INSERT INTO "ProductBadges" ("ProductId", "Badge", "IsAutomatic", "AssignedAt", "ExpiresAt")
SELECT 
    p."Id" as "ProductId",
    9 as "Badge", -- ProductBadge.Trending = 9
    true as "IsAutomatic",
    now() AT TIME ZONE 'utc' as "AssignedAt",
    (now() AT TIME ZONE 'utc') + INTERVAL '3 days' as "ExpiresAt"
FROM "Products" p
WHERE (
    SELECT COUNT(*) 
    FROM "ProductLikes" pl 
    WHERE pl."ProductId" = p."Id" 
    AND pl."CreatedAt" >= (now() AT TIME ZONE 'utc') - INTERVAL '3 days'
) >= 5
ON CONFLICT ("ProductId", "Badge") DO NOTHING;

-- Migration tamamlandı
COMMENT ON TABLE "ProductBadges" IS 'Ürün rozetleri - Retro koleksiyoncular için özel badge sistemi';
COMMENT ON COLUMN "ProductBadges"."Badge" IS 'Badge türü: 1=Hot, 2=New, 3=Rare, 4=Mint, 5=Graded, 6=Signed, 7=Limited, 8=Featured, 9=Trending, 10=Sale';
COMMENT ON COLUMN "Products"."IsRare" IS 'Nadir ürün rozeti';
COMMENT ON COLUMN "Products"."IsMint" IS 'Mint kondisyon rozeti';
COMMENT ON COLUMN "Products"."IsGraded" IS 'Profesyonel puanlanmış rozeti';
COMMENT ON COLUMN "Products"."IsSigned" IS 'İmzalı/otograflı rozeti';
COMMENT ON COLUMN "Products"."IsLimited" IS 'Sınırlı üretim rozeti';
COMMENT ON COLUMN "Products"."IsFeatured" IS 'Editör seçimi rozeti';
COMMENT ON COLUMN "Products"."IsOnSale" IS 'İndirimli rozeti';
COMMENT ON COLUMN "Products"."OriginalPrice" IS 'İndirimli fiyat için orijinal fiyat';

-- Başarıyla tamamlandı!

