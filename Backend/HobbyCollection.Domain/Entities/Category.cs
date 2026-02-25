using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace HobbyCollection.Domain.Entities;

public class Category
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(128)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(160)]
    public string? Slug { get; set; }
    
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Adjacency reference for convenience (optional, supports simple queries)
    public Guid? ParentId { get; set; }

    // Navigation property for translations
    [JsonIgnore] // Prevent circular reference in JSON serialization
    public List<CategoryTranslation> Translations { get; set; } = new();
}



