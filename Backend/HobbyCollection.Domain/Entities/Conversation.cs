namespace HobbyCollection.Domain.Entities;

public class Conversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string User1Id { get; set; } = string.Empty; // İlk kullanıcı ID
    public string User2Id { get; set; } = string.Empty; // İkinci kullanıcı ID
    
    // Son mesaj bilgileri (performans için)
    public string? LastMessageText { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public string? LastMessageSenderId { get; set; } // Son mesajı gönderen kullanıcı ID
    
    // Okunmamış mesaj sayıları (her kullanıcı için ayrı)
    public int UnreadCountUser1 { get; set; } = 0; // User1 için okunmamış mesaj sayısı
    public int UnreadCountUser2 { get; set; } = 0; // User2 için okunmamış mesaj sayısı
    
    // Kullanıcı 1 tarafından silinmiş mi?
    public bool IsDeletedByUser1 { get; set; } = false;
    // Kullanıcı 2 tarafından silinmiş mi?
    public bool IsDeletedByUser2 { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

