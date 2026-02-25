namespace HobbyCollection.Domain.Entities
{
    public class Product
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Hashtags { get; set; }
        public Guid? CategoryId { get; set; }
        public decimal? Price { get; set; }
        public bool IsPublic { get; set; } = true;
        public bool CommentsEnabled { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Badge özellikleri - Manuel olarak atanabilir
        public bool IsRare { get; set; } = false;
        public bool IsMint { get; set; } = false;
        public bool IsGraded { get; set; } = false;
        public bool IsSigned { get; set; } = false;
        public bool IsLimited { get; set; } = false;
        public bool IsFeatured { get; set; } = false;

        public List<ProductPhoto> Photos { get; set; } = new();
        public List<ProductBadgeInfo> Badges { get; set; } = new();

        public Category? Category { get; set; }
        // Navigation to user intentionally omitted to avoid new FK migration; we will join when needed
    }
}



