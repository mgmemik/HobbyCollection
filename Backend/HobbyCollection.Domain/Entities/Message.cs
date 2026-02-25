namespace HobbyCollection.Domain.Entities;

public enum MessageType
{
    Text = 0,
    Image = 1,
    Video = 2
}

public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Conversation? Conversation { get; set; } // Navigation property
    public string SenderId { get; set; } = string.Empty; // Mesajı gönderen kullanıcı ID
    public string ReceiverId { get; set; } = string.Empty; // Mesajı alan kullanıcı ID
    
    public MessageType Type { get; set; } = MessageType.Text;
    public string Content { get; set; } = string.Empty; // Mesaj içeriği (text veya media URL)
    
    public bool IsRead { get; set; } = false; // Alıcı tarafından okundu mu?
    public DateTime? ReadAt { get; set; } // Okunma zamanı
    
    // Soft delete - Her kullanıcı kendi tarafından silebilir
    public bool IsDeletedBySender { get; set; } = false; // Gönderen tarafından silindi mi?
    public bool IsDeletedByReceiver { get; set; } = false; // Alıcı tarafından silindi mi?
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

