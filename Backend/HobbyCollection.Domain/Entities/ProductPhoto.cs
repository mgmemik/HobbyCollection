namespace HobbyCollection.Domain.Entities
{
    public class ProductPhoto
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string BlobUrl { get; set; } = string.Empty; // GCS public URL
        public string BlobName { get; set; } = string.Empty; // bucket/key
        public string ContentType { get; set; } = "image/jpeg";
        public long SizeBytes { get; set; }
        public int Order { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Product? Product { get; set; }
    }
}



