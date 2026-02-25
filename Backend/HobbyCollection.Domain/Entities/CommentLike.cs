namespace HobbyCollection.Domain.Entities
{
    public class CommentLike
    {
        public Guid Id { get; set; }
        public Guid CommentId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Comment? Comment { get; set; }
    }
}

