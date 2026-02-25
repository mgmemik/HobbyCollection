# Database Schema Karşılaştırma Raporu v2

**Tarih:** 2025-12-01 17:30  
**Karşılaştırılan Ortamlar:** Development (Local PostgreSQL) vs Production (Cloud SQL PostgreSQL)

## Özet

Dev ve Production database'lerin schema'ları arasında **kritik farklar** devam ediyor. Production database'de `Follows.CreatedAt` kolonu hala TEXT tipinde ve tip düzeltme işlemi başarısız olmuş.

## Development Database Schema ✅

### Follows Tablosu
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

### Diğer Kritik Tablolar
| Tablo | Kolon | Tip | Durum |
|-------|-------|-----|-------|
| Comments | CreatedAt | timestamp with time zone | ✅ |
| Comments | UpdatedAt | timestamp with time zone | ✅ |
| Comments | Id | uuid | ✅ |
| Notifications | CreatedAt | timestamp with time zone | ✅ |
| Notifications | Id | uuid | ✅ |
| Notifications | IsRead | boolean | ✅ |
| Products | CreatedAt | timestamp with time zone | ✅ |
| Products | Id | uuid | ✅ |
| ProductLikes | CreatedAt | timestamp with time zone | ✅ |
| ProductLikes | Id | uuid | ✅ |
| ProductSaves | CreatedAt | timestamp with time zone | ✅ |
| ProductSaves | Id | uuid | ✅ |

**Sonuç:** Development database'de tüm kolonlar doğru tiplerde ✅

## Production Database Schema ❌

### Follows Tablosu
**Sorun:** `CreatedAt` kolonu hala `text` tipinde!

**Hata Mesajı (Loglardan):**
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

## Tip Düzeltme İşlemi Durumu

### ❌ Başarısız
Loglardan görüldüğü üzere:
- Tip düzeltme işlemi çalıştırıldı
- Ancak `Follows.CreatedAt` dönüşümü başarısız oldu
- Hata mesajı: `Index (zero based) must be greater than or equal to zero and less than the size of the argument list`

**Sorun:** `format()` fonksiyonundaki placeholder sayısı ile argüman sayısı eşleşmiyor.

### Loglardan Tespit Edilen
- `🔄 Follows.CreatedAt TEXT'den TIMESTAMP'e dönüştürülüyor...` - İşlem başlatıldı
- `⚠️ Follows.CreatedAt DateTime dönüşümü sırasında hata` - İşlem başarısız oldu
- `✅ Follows.CreatedAt başarıyla TIMESTAMP'e dönüştürüldü` - **YOK** ❌

## Tespit Edilen Sorunlar

### 1. Follows.CreatedAt - TEXT → TIMESTAMP ❌ (Hala Devam Ediyor)
- **Sorun:** Production'da TEXT tipinde
- **Etki:** Follow işlemleri başarısız oluyor
- **Durum:** Tip düzeltme işlemi başarısız

### 2. Notifications.CreatedAt - TEXT → TIMESTAMP ❌ (Muhtemelen)
- **Sorun:** Benzer hata mesajı görüldü
- **Etki:** Notification işlemleri etkilenebilir

### 3. SQL Format Hatası ❌
- **Sorun:** `format()` fonksiyonunda placeholder/argüman uyumsuzluğu
- **Etki:** DateTime dönüşümleri başarısız oluyor

## Dev vs Production Karşılaştırması

| Özellik | Development | Production | Durum |
|---------|-------------|------------|-------|
| Follows.CreatedAt | timestamp with time zone | text | ❌ Farklı |
| Follows.Id | uuid | uuid | ✅ Aynı |
| Notifications.IsRead | boolean | boolean | ✅ Aynı (düzeltilmiş) |
| Products.CreatedAt | timestamp with time zone | ? | ⚠️ Kontrol edilmeli |
| Comments.CreatedAt | timestamp with time zone | ? | ⚠️ Kontrol edilmeli |

## Sonuç ve Öneriler

### 🔴 Kritik Durum
Production database'de `Follows.CreatedAt` kolonu hala TEXT tipinde ve tip düzeltme işlemi başarısız olmuş.

### Çözüm Önerileri

1. **SQL Format Hatasını Düzelt**
   - `format()` fonksiyonundaki placeholder sayısını kontrol et
   - Argüman sayısını doğrula
   - Test et ve deploy et

2. **Manuel SQL Script ile Düzelt**
   - Cloud SQL'e direkt bağlan
   - `ALTER TABLE` komutları ile manuel düzelt
   - Daha güvenilir ve hızlı

3. **Alternatif Yaklaşım**
   - `format()` yerine string concatenation kullan
   - Veya parametreli sorgu kullan

### Acil Aksiyon Gerekiyor
- ❌ Follow işlemleri çalışmıyor
- ❌ Production'da kullanıcılar takip edemiyor
- ⚠️ Tip düzeltme sistemi çalışmıyor

**Öncelik:** YÜKSEK 🔴

