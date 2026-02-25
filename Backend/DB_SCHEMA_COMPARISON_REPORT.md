# Database Schema Karşılaştırma Raporu

**Tarih:** 2025-12-01  
**Karşılaştırılan Ortamlar:** Development (Local PostgreSQL) vs Production (Cloud SQL PostgreSQL)

## Özet

Dev ve Production database'lerin schema'ları arasında **kritik farklar** tespit edildi. Production database'de SQLite'tan PostgreSQL'e migration sırasında oluşan tip uyumsuzlukları mevcut.

## Development Database Schema

### Follows Tablosu ✅
```
column_name | data_type                  | is_nullable | column_default
------------+----------------------------+-------------+----------------
Id          | uuid                       | NO          | 
FollowerId  | text                       | NO          | 
FollowingId | text                       | NO          | 
CreatedAt   | timestamp with time zone   | NO          | 
Status      | integer                    | NO          | 1
```

**Durum:** ✅ Tüm kolonlar doğru tiplerde

### Diğer Tablolar (Örnek)
- `Comments.CreatedAt`: `timestamp with time zone` ✅
- `Comments.UpdatedAt`: `timestamp with time zone` ✅
- `Notifications.CreatedAt`: `timestamp with time zone` ✅
- `Notifications.IsRead`: `boolean` ✅
- `Products.CreatedAt`: `timestamp with time zone` ✅
- `Products.Id`: `uuid` ✅

## Production Database Schema (Loglardan Tespit Edilen)

### Follows Tablosu ❌
**Sorun:** `CreatedAt` kolonu `text` tipinde, `timestamp` olmalı!

**Hata Mesajı:**
```
System.InvalidCastException: Reading as 'System.DateTime' is not supported for fields having DataTypeName 'text'
```

**SQL Sorgusu:**
```sql
SELECT f."Id", f."CreatedAt", f."FollowerId", f."FollowingId", f."Status" 
FROM "Follows" AS f 
WHERE f."FollowerId" = @__followerId_0 AND f."FollowingId" = @__followingId_1 LIMIT 1
```

**Beklenen Tip:** `timestamp with time zone`  
**Mevcut Tip:** `text` ❌

## Tespit Edilen Sorunlar

### 1. Follows.CreatedAt - TEXT → TIMESTAMP ❌
- **Sorun:** Production'da TEXT tipinde
- **Etki:** Follow işlemleri başarısız oluyor
- **Çözüm:** Otomatik tip düzeltme sistemi çalışıyor ama henüz uygulanmamış olabilir

### 2. Potansiyel Diğer Sorunlar
Aşağıdaki kolonlar da benzer sorunlara sahip olabilir:
- `Notifications.CreatedAt` (eğer TEXT ise)
- `Products.CreatedAt` (eğer TEXT ise)
- `Comments.CreatedAt` (eğer TEXT ise)
- Diğer `*At` kolonları

## Çözüm Durumu

### ✅ Yapılan İyileştirmeler
1. **Otomatik Tip Düzeltme Sistemi:** `FixSqliteTypeMigrations.cs` servisi eklendi
2. **Kritik Kolonlar için Manuel Düzeltme:** `Follows.CreatedAt` ve diğer kritik kolonlar manuel olarak düzeltiliyor
3. **DateTime Dönüşümü İyileştirildi:** ISO 8601 ve Unix timestamp desteği eklendi

### ⚠️ Beklenen Sonuç
Uygulama bir sonraki başlatıldığında:
- `Follows.CreatedAt` TEXT'den TIMESTAMP'e dönüştürülecek
- Tüm diğer DateTime kolonları düzeltilecek
- Follow işlemleri çalışmaya başlayacak

## Öneriler

### 1. Hemen Yapılması Gerekenler
- ✅ Otomatik tip düzeltme sistemi deploy edildi
- ⏳ Uygulama restart edildiğinde otomatik düzeltme çalışacak
- ⏳ Follow işlemini test et

### 2. İzleme
- Uygulama loglarında tip düzeltme mesajlarını kontrol et
- `🔧 SQLite tip uyumsuzlukları düzeltiliyor...` mesajını ara
- `✅ Follows.CreatedAt başarıyla TIMESTAMP'e dönüştürüldü` mesajını doğrula

### 3. Gelecek İçin
- Dev ve Production database'lerin schema'larını düzenli olarak karşılaştır
- Migration'ları her iki ortamda da test et
- Schema değişikliklerini version control'de takip et

## Ek Sorunlar (Loglardan Tespit Edilen)

### 1. FixDateTimeColumnAsync SQL Hatası ❌
**Hata:**
```
42703: column s.Value does not exist
```

**Sorun:** `SqlQueryRaw<string>` kullanımı hatalı. PostgreSQL'de subquery'den değer alınırken alias kullanılmalı.

**Etki:** DateTime kolonları düzeltilemiyor.

**Çözüm:** `FixDateTimeColumnAsync` metodundaki SQL sorgusu düzeltilmeli.

### 2. __EFMigrationsHistory Tablosu Yok ❌
**Hata:**
```
42P01: relation "__EFMigrationsHistory" does not exist
```

**Sorun:** Production database'de EF Core migration history tablosu yok.

**Etki:** Migration kayıtları tutulamıyor.

**Çözüm:** `__EFMigrationsHistory` tablosu oluşturulmalı.

## Sonuç

**Ana Sorun:** Production database'de `Follows.CreatedAt` kolonu TEXT tipinde, TIMESTAMP olmalı.

**Ek Sorunlar:**
1. `FixDateTimeColumnAsync` metodunda SQL hatası var
2. `__EFMigrationsHistory` tablosu production'da yok

**Çözüm:** 
- ✅ Otomatik tip düzeltme sistemi deploy edildi
- ❌ Ancak SQL hatası nedeniyle çalışmıyor
- ⚠️ SQL hatası düzeltilmeli ve yeniden deploy edilmeli

**Durum:** 🔴 Kritik - SQL hatası düzeltilmeli

