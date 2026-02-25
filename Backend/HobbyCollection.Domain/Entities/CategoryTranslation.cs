using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HobbyCollection.Domain.Entities;

public class CategoryTranslation
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CategoryId { get; set; }

    [Required]
    [MaxLength(8)]
    public string LanguageCode { get; set; } = string.Empty; // 'en', 'tr', etc.

    [Required]
    [MaxLength(128)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    // Navigation property
    [ForeignKey(nameof(CategoryId))]
    public Category? Category { get; set; }
}

