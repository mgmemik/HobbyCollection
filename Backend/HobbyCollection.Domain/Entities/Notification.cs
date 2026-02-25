namespace HobbyCollection.Domain.Entities
{
    public class Notification
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = string.Empty; // Bildirimi alan kullanıcı
        public string Type { get; set; } = string.Empty; // "comment", "comment_like", vb.
        public string Title { get; set; } = string.Empty;
        public string? Message { get; set; }
        public Guid? RelatedProductId { get; set; }
        public Guid? RelatedCommentId { get; set; }
        public Guid? RelatedConversationId { get; set; }
        public string? RelatedUserId { get; set; } // Bildirimi tetikleyen kullanıcı
        public string? RelatedFollowId { get; set; } // Takip talebi için Follow ID (onay/reddetme için) - Guid string olarak saklanır
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

