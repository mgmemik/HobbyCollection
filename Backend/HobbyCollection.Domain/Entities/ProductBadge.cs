namespace HobbyCollection.Domain.Entities
{
    /// <summary>
    /// Ürün rozetleri - Retro koleksiyoncular için özel badge'ler
    /// </summary>
    public enum ProductBadge
    {
        None = 0,
        Hot = 1,        // 🔥 Popüler (10+ beğeni)
        New = 2,        // ✨ Yeni (7 gün içinde)
        Rare = 3,       // 💎 Nadir
        Mint = 4,       // ⭐ Mint kondisyon
        Graded = 5,     // 🎖️ Profesyonel puanlanmış
        Signed = 6,     // ✍️ İmzalı
        Limited = 7,    // 🔖 Sınırlı üretim
        Featured = 8,   // 👑 Editör seçimi
        Trending = 9    // 📈 Trend (son 3 günde 5+ beğeni)
    }

    /// <summary>
    /// Ürün rozet bilgileri
    /// </summary>
    public class ProductBadgeInfo
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public ProductBadge Badge { get; set; }
        public bool IsAutomatic { get; set; } = true; // Otomatik mi yoksa manuel mi atandı
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiresAt { get; set; } // Bazı badge'ler zamana bağlı (HOT, NEW, TRENDING)
        
        public Product? Product { get; set; }
    }
}

