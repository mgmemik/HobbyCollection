# 🏅 Badge (Rozet) Sistemi - Özet Döküman

## 📋 Genel Bakış

Retro koleksiyoncu uygulamanıza ürünleri öne çıkaracak kapsamlı bir rozet sistemi eklenmiştir. Bu sistem hem otomatik hem de manuel rozet atama özelliklerine sahiptir.

## 🎯 Rozet Türleri

### Otomatik Rozetler (Sistem Tarafından Atanır)
1. **🔥 HOT** - Popüler ürünler (10+ beğeni)
2. **✨ NEW** - Yeni eklenen ürünler (7 gün içinde)
3. **📈 TRENDING** - Trend olan ürünler (son 3 günde 5+ beğeni) *

### Manuel Rozetler (Kullanıcı Tarafından Atanır)
4. **💎 RARE** - Nadir bulunan özel ürünler
5. **⭐ MINT** - Yeni gibi kondisyonda ürünler
6. **🎖️ GRADED** - Profesyonel olarak puanlanmış ürünler
7. **✍️ SIGNED** - İmzalı/otograflı ürünler
8. **🔖 LIMITED** - Sınırlı üretim ürünler
9. **👑 FEATURED** - Editör seçimi (admin tarafından) *
10. **💰 SALE** - İndirimli ürünler

\* _Gelecek güncellemede aktif edilecek_

---

## 🛠️ Backend İmplementasyonu

### 1. Database Değişiklikleri

#### Product Entity'ye Eklenen Alanlar:
```csharp
public bool IsRare { get; set; } = false;
public bool IsMint { get; set; } = false;
public bool IsGraded { get; set; } = false;
public bool IsSigned { get; set; } = false;
public bool IsLimited { get; set; } = false;
public bool IsFeatured { get; set; } = false;
public bool IsOnSale { get; set; } = false;
public decimal? OriginalPrice { get; set; }
```

#### Migration Dosyası:
- Konum: `/Backend/scripts/add-product-badges-migration.sql`
- PostgreSQL migration dosyası hazır
- Manuel olarak çalıştırılması gerekiyor:
  ```bash
  psql -h localhost -U your_user -d hobbycollection_dev -f scripts/add-product-badges-migration.sql
  ```

### 2. Badge Service
- Konum: `/Backend/HobbyCollection.Api/Services/BadgeService.cs`
- Otomatik rozet hesaplama
- Toplu rozet hesaplama (performance için)
- Zamana bağlı rozet yönetimi

### 3. Controller Güncellemeleri
- `ProductsController`: Update endpoint'ine rozet alanları eklendi
- Feed endpoint'ine rozet bilgileri eklendi
- Helper method: `CalculateBadges()` eklendi

---

## 📱 Frontend İmplementasyonu

### 1. Badge Component
- Konum: `/Mobile/src/components/ProductBadge.tsx`
- **ProductBadge**: Tek rozet gösterimi
- **ProductBadges**: Çoklu rozet gösterimi (öncelik sırasına göre)
- Gradient renkler ve emojiler
- Pozisyon seçenekleri (top-left, top-right, bottom-left, bottom-right)
- Boyut seçenekleri (small, medium, large)

### 2. Screen Güncellemeleri

#### HomeScreen
- Ürün fotoğrafları üzerinde rozetler görüntüleniyor
- En fazla 2 rozet gösteriliyor
- Küçük boyut ve text gösterimi

#### ProductDetailScreen
- Ürün fotoğrafı üzerinde rozetler
- En fazla 3 rozet gösteriliyor
- Orta boyut ve text gösterimi

#### ProductEditScreen
- Yeni "Rozetler" bölümü eklendi
- Manuel rozet seçimi için switch'ler
- İndirimli ürünler için orijinal fiyat alanı
- Otomatik rozetler hakkında bilgilendirme

### 3. API Types Güncellemeleri
- `FeedProduct`, `ProductDetail`, `UserProduct` type'larına `badges?: number[]` eklendi
- `UpdateProductRequest`'e rozet alanları eklendi

---

## 🎨 UI/UX Özellikleri

### Görsel Tasarım
- **Gradient renkler**: Her rozet için özel renk paleti
- **Emojiler**: Görsel tanınabilirlik için
- **Gölgeler**: Derinlik hissi
- **Position absolute**: Fotoğraf üzerinde köşe yerleşimi

### Öncelik Sıralaması
Birden fazla rozet olduğunda gösterim önceliği:
1. Featured (👑)
2. Sale (💰)
3. Hot (🔥)
4. Trending (📈)
5. New (✨)
6. Rare (💎)
7. Graded (🎖️)
8. Signed (✍️)
9. Limited (🔖)
10. Mint (⭐)

---

## 🚀 Kurulum ve Kullanım

### Backend Kurulumu
```bash
# 1. Migration'ı çalıştır
cd Backend
psql -h localhost -U your_user -d hobbycollection_dev -f scripts/add-product-badges-migration.sql

# 2. Backend'i yeniden başlat
cd HobbyCollection.Api
dotnet run
```

### Frontend Kullanımı
Kod zaten entegre edildi. Yeni özellikler:

1. **Ürün Ekleme/Düzenleme**: 
   - "Rozetler" bölümünden manuel rozet seçimi yapılabilir

2. **Ana Sayfa**: 
   - Ürünler üzerinde otomatik rozetler görünür

3. **Ürün Detayı**: 
   - Tüm rozetler görünür

---

## 📊 Performans Optimizasyonları

1. **Toplu Hesaplama**: `CalculateBatchBadgesAsync()` ile birden fazla ürün için tek sorguda rozet hesaplama
2. **Index'ler**: ProductBadges tablosunda performans için index'ler eklendi
3. **Caching Hazırlığı**: Badge service gelecekte cache desteği için hazırlandı

---

## 🔮 Gelecek Geliştirmeler

1. **Admin Panel**: Featured rozet yönetimi
2. **Trending Logic**: Son 3 günde beğeni analizi ile otomatik trending rozeti
3. **Badge İstatistikleri**: Kullanıcı profil sayfasında rozet istatistikleri
4. **Custom Badges**: Özel etkinlikler için özel rozetler
5. **Badge Gamification**: Rozet toplama sistemi

---

## 📝 Notlar

- **Veritabanı Uyumluluğu**: PostgreSQL için hazırlandı
- **Theme Uyumluluğu**: Tüm rozetler dark/light mode ile uyumlu
- **Çoklu Dil Desteği**: Rozet isimleri i18n için hazır (şimdilik sabit TR)
- **Mobil Uyumluluk**: Tüm ekran boyutlarında responsive

---

## 🎉 Sonuç

Artık uygulamanızda retro koleksiyoncuların severek kullanacağı, görsel olarak çekici ve işlevsel bir rozet sistemi var! Kullanıcılar ürünlerini özelleştirebilir, popüler ürünler öne çıkar ve topluluk daha aktif hale gelir.

**Version**: 1.5.0
**Date**: 2024-11-25
**Type**: Major Feature Addition

