using Microsoft.AspNetCore.Mvc;
using Google.Cloud.Storage.V1;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ImageProxyController : ControllerBase
{
    private readonly StorageClient _storage;
    private readonly IConfiguration _cfg;
    private readonly ILogger<ImageProxyController> _logger;

    public ImageProxyController(StorageClient storage, IConfiguration cfg, ILogger<ImageProxyController> logger)
    {
        _storage = storage;
        _cfg = cfg;
        _logger = logger;
    }

    [HttpGet("{*blobPath}")]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetImage(string blobPath)
    {
        try
        {
            string bucket = _cfg["GoogleCloud:Bucket"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(bucket))
            {
                return StatusCode(500, "Bucket not configured");
            }

            _logger.LogInformation("Proxying image request: {BlobPath}", blobPath);

            // GCS'den fotoğrafı indir
            using var stream = new MemoryStream();
            await _storage.DownloadObjectAsync(bucket, blobPath, stream);
            stream.Position = 0;

            // Content-Type'ı belirle
            var contentType = "image/jpeg";
            if (blobPath.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                contentType = "image/png";
            else if (blobPath.EndsWith(".gif", StringComparison.OrdinalIgnoreCase))
                contentType = "image/gif";
            else if (blobPath.EndsWith(".webp", StringComparison.OrdinalIgnoreCase))
                contentType = "image/webp";

            return File(stream.ToArray(), contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to proxy image: {BlobPath}", blobPath);
            return NotFound();
        }
    }
}

