using System.Security.Claims;
using HobbyCollection.Domain.Abstractions;
using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AvatarController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IImageStorageService _images;
    private readonly IConfiguration _cfg;
    private readonly ILogger<AvatarController> _logger;

    public AvatarController(AppDbContext db, IImageStorageService images, IConfiguration cfg, ILogger<AvatarController> logger)
    {
        _db = db;
        _images = images;
        _cfg = cfg;
        _logger = logger;
    }

    /// <summary>
    /// Avatar yükle veya güncelle
    /// </summary>
    [HttpPost("upload")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadAvatar()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound("Kullanıcı bulunamadı.");
        }

        try
        {
            var form = await Request.ReadFormAsync();
            var file = form.Files.FirstOrDefault();

            if (file == null || file.Length == 0)
            {
                return BadRequest("Dosya bulunamadı.");
            }

            // Dosya boyutu kontrolü (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest("Dosya boyutu 10MB'dan büyük olamaz.");
            }

            // Dosya tipi kontrolü
            var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
            {
                return BadRequest("Sadece JPEG, PNG veya WebP formatları desteklenir.");
            }

            var bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
            if (string.IsNullOrEmpty(bucket))
            {
                return StatusCode(500, "Storage bucket yapılandırması bulunamadı.");
            }

            // Eski avatar'ı sil (varsa)
            if (!string.IsNullOrEmpty(user.AvatarUrl))
            {
                try
                {
                    // AvatarUrl'den blob name'i çıkar
                    var oldBlobName = ExtractBlobNameFromUrl(user.AvatarUrl, bucket);
                    if (!string.IsNullOrEmpty(oldBlobName))
                    {
                        await _images.DeleteAsync(bucket, oldBlobName);
                        _logger.LogInformation("Old avatar deleted: {BlobName}", oldBlobName);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete old avatar");
                    // Eski avatar silinemese bile devam et
                }
            }

            // Yeni avatar'ı yükle
            using var stream = file.OpenReadStream();
            var (blobName, publicUrl, sizeBytes) = await _images.UploadSquareAsync(
                stream,
                file.FileName,
                file.ContentType,
                bucket
            );

            // Kullanıcının avatar URL'ini güncelle
            user.AvatarUrl = publicUrl;
            await _db.SaveChangesAsync();

            _logger.LogInformation("Avatar uploaded successfully for user {UserId}: {Url}", userId, publicUrl);

            return Ok(new
            {
                avatarUrl = publicUrl,
                message = "Avatar başarıyla yüklendi."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading avatar for user {UserId}", userId);
            return StatusCode(500, new { message = "Avatar yüklenirken bir hata oluştu.", error = ex.Message });
        }
    }

    /// <summary>
    /// Avatar'ı sil
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> DeleteAvatar()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _db.Users.OfType<ApplicationUser>().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return NotFound("Kullanıcı bulunamadı.");
        }

        if (string.IsNullOrEmpty(user.AvatarUrl))
        {
            return BadRequest("Avatar bulunamadı.");
        }

        try
        {
            var bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
            if (!string.IsNullOrEmpty(bucket))
            {
                var blobName = ExtractBlobNameFromUrl(user.AvatarUrl, bucket);
                if (!string.IsNullOrEmpty(blobName))
                {
                    await _images.DeleteAsync(bucket, blobName);
                    _logger.LogInformation("Avatar deleted: {BlobName}", blobName);
                }
            }

            user.AvatarUrl = null;
            await _db.SaveChangesAsync();

            return Ok(new { message = "Avatar başarıyla silindi." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting avatar for user {UserId}", userId);
            return StatusCode(500, new { message = "Avatar silinirken bir hata oluştu.", error = ex.Message });
        }
    }

    /// <summary>
    /// Avatar URL'inden blob name'i çıkar
    /// </summary>
    private string? ExtractBlobNameFromUrl(string url, string bucket)
    {
        try
        {
            // URL formatı: https://storage.googleapis.com/{bucket}/{blobName}
            var prefix = $"https://storage.googleapis.com/{bucket}/";
            if (url.StartsWith(prefix))
            {
                return url.Substring(prefix.Length);
            }
            return null;
        }
        catch
        {
            return null;
        }
    }
}

