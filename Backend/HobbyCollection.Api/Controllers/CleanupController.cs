using Microsoft.AspNetCore.Mvc;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CleanupController : ControllerBase
{
    private readonly AppDbContext _db;
    public CleanupController(AppDbContext db) { _db = db; }

    [HttpDelete("old-saatler")]
    public async Task<IActionResult> RemoveOldSaatler()
    {
        var oldSaatler = await _db.Categories.FirstOrDefaultAsync(c => c.Name == "Saatler" && c.ParentId == null);
        if (oldSaatler == null)
        {
            return Ok(new { message = "Saatler ana kategorisi yok" });
        }

        // descendants
        var descendants = await _db.CategoryClosures
            .Where(x => x.AncestorId == oldSaatler.Id && x.Distance > 0)
            .Select(x => x.DescendantId)
            .ToListAsync();

        var closures = await _db.CategoryClosures
            .Where(x => x.AncestorId == oldSaatler.Id || descendants.Contains(x.DescendantId))
            .ToListAsync();
        _db.CategoryClosures.RemoveRange(closures);

        var childCategories = await _db.Categories.Where(c => descendants.Contains(c.Id)).ToListAsync();
        _db.Categories.RemoveRange(childCategories);

        _db.Categories.Remove(oldSaatler);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Saatler ve {childCategories.Count} alt kategorisi silindi" });
    }
}
