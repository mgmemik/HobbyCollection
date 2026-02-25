using System.ComponentModel.DataAnnotations;

namespace HobbyCollection.Domain.Entities;

public class Brand
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(128)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? NormalizedName { get; set; } // Normalize edilmiş isim (büyük harf, boşluksuz vb.)

    [MaxLength(64)]
    public string? Category { get; set; } // Elektronik, Oyuncak, Kamera, vb.

    [MaxLength(64)]
    public string? Country { get; set; } // Ülke bilgisi

    public int? FoundedYear { get; set; } // Kuruluş yılı

    public bool IsActive { get; set; } = true;

    public int PopularityScore { get; set; } = 0; // Popülerlik skoru (0-100)

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}

