using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Google.Cloud.Storage.V1;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("")]
public class AccountDeletionController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly StorageClient _storage;
    private readonly ILogger<AccountDeletionController> _logger;

    public AccountDeletionController(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        StorageClient storage,
        ILogger<AccountDeletionController> logger)
    {
        _db = db;
        _userManager = userManager;
        _configuration = configuration;
        _storage = storage;
        _logger = logger;
    }

    [HttpGet("child-safety")]
    public IActionResult GetChildSafetyPage()
    {
        return Redirect("https://save-all.com/child-safety");
    }

    [HttpGet("privacy")]
    public IActionResult GetPrivacyPolicyPage()
    {
        return Redirect("https://save-all.com/privacy");
    }

    [HttpGet("terms")]
    public IActionResult GetTermsOfServicePage()
    {
        return Redirect("https://save-all.com/terms");
    }

    [HttpGet("account-deletion")]
    [Produces("text/html")]
    public IActionResult GetAccountDeletionPage()
    {
        // Redirect to main support page which includes account deletion info
        return Redirect("https://save-all.com/support");
    }

    [HttpPost("api/account/delete")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized("Kullanıcı kimliği bulunamadı.");
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
        {
            return NotFound("Kullanıcı bulunamadı.");
        }

        try
        {
            _logger.LogInformation("Hesap silme işlemi başlatıldı: {UserId}, {Email}", userId, user.Email);

            // 1. Kullanıcının tüm ürünlerini ve fotoğraflarını sil
            var products = await _db.Products
                .Include(p => p.Photos)
                .Where(p => p.UserId == userId)
                .ToListAsync();

            string bucket = _configuration["GoogleCloud:Bucket"] ?? string.Empty;
            foreach (var product in products)
            {
                // Fotoğrafları GCS'den sil
                if (!string.IsNullOrWhiteSpace(bucket))
                {
                    foreach (var photo in product.Photos)
                    {
                        try
                        {
                            await _storage.DeleteObjectAsync(bucket, photo.BlobName);
                            _logger.LogInformation("Fotoğraf silindi: {BlobName}", photo.BlobName);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Fotoğraf silinemedi: {BlobName}", photo.BlobName);
                        }
                    }
                }
            }

            // 2. İlişkili verileri sil
            // Follows (takipçi/takip edilen)
            var follows = await _db.Follows
                .Where(f => f.FollowerId == userId || f.FollowingId == userId)
                .ToListAsync();
            _db.Follows.RemoveRange(follows);

            // Product Likes
            var productLikes = await _db.ProductLikes
                .Where(pl => pl.UserId == userId)
                .ToListAsync();
            _db.ProductLikes.RemoveRange(productLikes);

            // Product Saves
            var productSaves = await _db.ProductSaves
                .Where(ps => ps.UserId == userId)
                .ToListAsync();
            _db.ProductSaves.RemoveRange(productSaves);

            // Comments
            var comments = await _db.Comments
                .Where(c => c.UserId == userId)
                .ToListAsync();
            _db.Comments.RemoveRange(comments);

            // Comment Likes
            var commentLikes = await _db.CommentLikes
                .Where(cl => comments.Select(c => c.Id).Contains(cl.CommentId))
                .ToListAsync();
            _db.CommentLikes.RemoveRange(commentLikes);

            // Notifications
            var notifications = await _db.Notifications
                .Where(n => n.UserId == userId)
                .ToListAsync();
            _db.Notifications.RemoveRange(notifications);

            // Analysis Logs
            var analysisLogs = await _db.AnalysisLogs
                .Where(al => al.UserId == userId)
                .ToListAsync();
            _db.AnalysisLogs.RemoveRange(analysisLogs);

            // AI Credits
            var aiCredits = await _db.UserAICredits
                .Where(ac => ac.UserId == userId)
                .ToListAsync();
            _db.UserAICredits.RemoveRange(aiCredits);

            // AI Credit Transactions
            var aiTransactions = await _db.AICreditTransactions
                .Where(act => act.UserId == userId)
                .ToListAsync();
            _db.AICreditTransactions.RemoveRange(aiTransactions);

            // 3. Ürünleri sil
            _db.Products.RemoveRange(products);

            // 4. Değişiklikleri kaydet
            await _db.SaveChangesAsync();

            // 5. Kullanıcıyı sil
            var deleteResult = await _userManager.DeleteAsync(user);
            if (!deleteResult.Succeeded)
            {
                _logger.LogError("Kullanıcı silinemedi: {Errors}", string.Join(", ", deleteResult.Errors.Select(e => e.Description)));
                return BadRequest(new { message = "Hesap silinirken bir hata oluştu.", errors = deleteResult.Errors });
            }

            _logger.LogInformation("Hesap başarıyla silindi: {UserId}, {Email}", userId, user.Email);

            return Ok(new { message = "Hesabınız başarıyla silindi. Tüm verileriniz 30 gün içinde kalıcı olarak silinecektir." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Hesap silme işlemi sırasında hata oluştu: {UserId}", userId);
            return StatusCode(500, new { message = "Hesap silinirken bir hata oluştu. Lütfen daha sonra tekrar deneyin veya support@thebarnapp.com adresine email gönderin." });
        }
    }
}

