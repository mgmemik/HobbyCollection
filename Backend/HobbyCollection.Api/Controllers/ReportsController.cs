using System.Security.Claims;
using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(AppDbContext db, ILogger<ReportsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Şikayet sebeplerini getirir
    /// </summary>
    [HttpGet("reasons")]
    [AllowAnonymous]
    public IActionResult GetReportReasons()
    {
        var reasons = new[]
        {
            new { value = "spam", label = new { en = "Spam", tr = "Spam" } },
            new { value = "inappropriate", label = new { en = "Inappropriate Content", tr = "Uygunsuz İçerik" } },
            new { value = "hate_speech", label = new { en = "Hate Speech", tr = "Nefret Söylemi" } },
            new { value = "copyright", label = new { en = "Copyright Violation", tr = "Telif Hakkı İhlali" } },
            new { value = "fake_account", label = new { en = "Fake Account", tr = "Sahte Hesap" } },
            new { value = "other", label = new { en = "Other", tr = "Diğer" } }
        };

        return Ok(reasons);
    }

    /// <summary>
    /// Yeni şikayet oluşturur
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        if (request == null || string.IsNullOrWhiteSpace(request.ContentType) || string.IsNullOrWhiteSpace(request.ContentId) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "ContentType, ContentId ve Reason zorunludur." });
        }

        // Geçerli content type kontrolü
        var validContentTypes = new[] { "product", "user", "comment" };
        if (!validContentTypes.Contains(request.ContentType.ToLower()))
        {
            return BadRequest(new { message = "Geçersiz ContentType. 'product', 'user' veya 'comment' olmalıdır." });
        }

        // Geçerli reason kontrolü
        var validReasons = new[] { "spam", "inappropriate", "hate_speech", "copyright", "fake_account", "other" };
        if (!validReasons.Contains(request.Reason.ToLower()))
        {
            return BadRequest(new { message = "Geçersiz Reason." });
        }

        // Aynı kullanıcının aynı içeriği daha önce şikayet edip etmediğini kontrol et
        var existingReport = await _db.ContentReports
            .FirstOrDefaultAsync(r => 
                r.ReporterUserId == userId && 
                r.ContentType == request.ContentType.ToLower() && 
                r.ContentId == request.ContentId);

        if (existingReport != null)
        {
            return Conflict(new { message = "Bu içeriği daha önce şikayet ettiniz." });
        }

        // İçeriğin var olup olmadığını kontrol et
        var contentExists = request.ContentType.ToLower() switch
        {
            "product" => await _db.Products.AnyAsync(p => p.Id.ToString() == request.ContentId),
            "user" => await _db.Users.OfType<ApplicationUser>().AnyAsync(u => u.Id == request.ContentId),
            "comment" => await _db.Comments.AnyAsync(c => c.Id.ToString() == request.ContentId),
            _ => false
        };

        if (!contentExists)
        {
            return NotFound(new { message = "Şikayet edilen içerik bulunamadı." });
        }

        // Kendi içeriğini şikayet edemez
        if (request.ContentType.ToLower() == "user" && request.ContentId == userId)
        {
            return BadRequest(new { message = "Kendi profilinizi şikayet edemezsiniz." });
        }

        // Şikayet oluştur
        var report = new ContentReport
        {
            Id = Guid.NewGuid(),
            ReporterUserId = userId,
            ContentType = request.ContentType.ToLower(),
            ContentId = request.ContentId,
            Reason = request.Reason.ToLower(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _db.ContentReports.Add(report);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Yeni şikayet oluşturuldu: {ReportId}, Tip: {ContentType}, İçerik: {ContentId}, Sebep: {Reason}", 
            report.Id, report.ContentType, report.ContentId, report.Reason);

        return Ok(new { 
            id = report.Id, 
            message = "Şikayetiniz alındı. İnceleme sürecine alınacaktır." 
        });
    }

    public record CreateReportRequest(
        string ContentType, // "product", "user", "comment"
        string ContentId,   // ProductId, UserId, CommentId
        string Reason,      // "spam", "inappropriate", "hate_speech", "copyright", "fake_account", "other"
        string? Description = null
    );
}
