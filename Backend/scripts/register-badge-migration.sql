-- Migration history'ye yeni migration'ı kaydet
-- Bu sadece bir kez çalıştırılmalı (manuel)

-- Migration kayıtlarını kontrol et
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId" DESC LIMIT 5;

-- Yeni migration'ı history'ye ekle (eğer yoksa)
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20241125_AddProductBadges', '8.0.0')
ON CONFLICT DO NOTHING;

-- Başarıyla kaydedildi!
SELECT '✅ Badge migration history''ye kaydedildi!' as status;

