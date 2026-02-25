using System.ComponentModel.DataAnnotations;

namespace HobbyCollection.Domain.Entities;

// Closure table to support fast recursive queries (ancestor/descendant)
public class CategoryClosure
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AncestorId { get; set; }
    public Guid DescendantId { get; set; }

    // distance = 0 for self, 1 for direct child, etc.
    public int Distance { get; set; }
}



