namespace HobbyCollection.Domain.Entities;

public enum FollowStatus
{
    Pending = 0,   // Beklemede
    Accepted = 1   // Kabul edildi
}

public class Follow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FollowerId { get; set; } = string.Empty; // Takip eden kullanıcı
    public string FollowingId { get; set; } = string.Empty; // Takip edilen kullanıcı
    public FollowStatus Status { get; set; } = FollowStatus.Accepted; // Varsayılan olarak Accepted (açık hesaplar için)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

