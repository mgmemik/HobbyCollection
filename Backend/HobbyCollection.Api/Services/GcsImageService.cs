using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using Microsoft.Extensions.Hosting;

namespace HobbyCollection.Api.Services;

// Deprecated: use HobbyCollection.Domain.Abstractions.IImageStorageService via Infrastructure implementation
public class GcsImageService
{
    private readonly StorageClient _storage;
    private readonly ILogger<GcsImageService> _logger;
    private readonly GoogleCredential _credential;
    private readonly IHostEnvironment _environment;

    public GcsImageService(StorageClient storage, GoogleCredential credential, ILogger<GcsImageService> logger, IHostEnvironment environment)
    {
        _storage = storage;
        _credential = credential;
        _logger = logger;
        _environment = environment;
    }

    public async Task<(string blobName, string publicUrl, long sizeBytes)> UploadSquareAsync(Stream original, string fileName, string contentType, string bucket)
    {
        // 1) ImageSharp ile kareye kırp + yeniden boyutlandır (max 1080x1080)
        original.Position = 0;
        using var image = Image.Load(original);
        int minSide = Math.Min(image.Width, image.Height);
        var rect = new Rectangle((image.Width - minSide) / 2, (image.Height - minSide) / 2, minSide, minSide);
        image.Mutate(ctx => ctx.Crop(rect).Resize(new Size(1080, 1080)));

        // 2) JPEG olarak kalite 85 ile encode et
        using var outStream = new MemoryStream();
        image.Save(outStream, new JpegEncoder { Quality = 85 });
        outStream.Position = 0;

        // 3) GCS'ye yükle
        var blobName = $"uploads/{DateTime.UtcNow:yyyy/MM/dd}/{Guid.NewGuid()}_{Path.GetFileNameWithoutExtension(fileName)}.jpg";
        
        _logger.LogInformation("Uploading to GCS - Bucket: {Bucket}, BlobName: {BlobName}", bucket, blobName);
        
        var obj = await _storage.UploadObjectAsync(bucket, blobName, "image/jpeg", outStream);
        var publicUrl = $"https://storage.googleapis.com/{bucket}/{blobName}";
        long uploadedSize = obj.Size.HasValue ? unchecked((long)obj.Size.Value) : outStream.Length;
        
        _logger.LogInformation("GCS Upload successful - URL: {Url}, Size: {Size}", publicUrl, uploadedSize);
        
        return (blobName, publicUrl, uploadedSize);
    }

    public async Task DeleteAsync(string bucket, string blobName)
    {
        try
        {
            await _storage.DeleteObjectAsync(bucket, blobName);
        }
        catch (Exception ex)
        {
            // Log but don't throw - deletion failure shouldn't block product deletion
            Console.WriteLine($"Failed to delete GCS object {blobName}: {ex.Message}");
        }
    }

    public string GetSignedUrl(string bucket, string blobName, TimeSpan? expiration = null)
    {
        // Development modunda emülatörler için proxy kullan (iOS simulator ve Android emulator)
        // Production'da direkt GCS public URL'i kullan
        if (_environment.IsDevelopment())
        {
            // iOS simulator ve Android emulator için backend proxy URL kullan
            // Backend üzerinden serve edilecek, böylece emülatör network sorunları çözülür
            var proxyUrl = $"http://localhost:5015/api/imageproxy/{blobName}";
            _logger.LogInformation("Generated proxy URL for {BlobName}: {Url}", blobName, proxyUrl);
            return proxyUrl;
        }
        else
        {
            // Production'da direkt GCS public URL'i döndür
            var publicUrl = $"https://storage.googleapis.com/{bucket}/{blobName}";
            _logger.LogInformation("Generated public URL for {BlobName}: {Url}", blobName, publicUrl);
            return publicUrl;
        }
        
        // NOT: Signed URL kullanmak isterseniz aşağıdaki kodu kullanın:
        // try
        // {
        //     if (_credential.UnderlyingCredential is ServiceAccountCredential serviceAccountCredential)
        //     {
        //         var urlSigner = UrlSigner.FromCredential(serviceAccountCredential);
        //         var duration = expiration ?? TimeSpan.FromDays(7);
        //         var signedUrl = urlSigner.Sign(bucket, blobName, duration, HttpMethod.Get);
        //         _logger.LogInformation("Generated signed URL for {BlobName}, expires in {Duration}", blobName, duration);
        //         return signedUrl;
        //     }
        // }
        // catch (Exception ex)
        // {
        //     _logger.LogError(ex, "Failed to generate signed URL for {BlobName}", blobName);
        // }
        // return publicUrl;
    }
}


