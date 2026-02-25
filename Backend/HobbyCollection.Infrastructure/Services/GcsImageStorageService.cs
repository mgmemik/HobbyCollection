using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;
using HobbyCollection.Domain.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;

namespace HobbyCollection.Infrastructure.Services;

public sealed class GcsImageStorageService : IImageStorageService
{
    private readonly StorageClient _storage;
    private readonly ILogger<GcsImageStorageService> _logger;
    private readonly GoogleCredential _credential;
    private readonly IHostEnvironment _environment;

    public GcsImageStorageService(StorageClient storage, GoogleCredential credential, ILogger<GcsImageStorageService> logger, IHostEnvironment environment)
    {
        _storage = storage;
        _credential = credential;
        _logger = logger;
        _environment = environment;
    }

    public async Task<(string blobName, string publicUrl, long sizeBytes)> UploadSquareAsync(Stream original, string fileName, string contentType, string bucket)
    {
        try
        {
            // Stream'i başa al ve okunabilir olduğundan emin ol
            if (original.CanSeek)
            {
        original.Position = 0;
            }
            
            // Stream'in okunabilir olduğundan emin ol
            if (!original.CanRead)
            {
                throw new InvalidOperationException($"Stream is not readable for file: {fileName}");
            }

            // Stream'in boş olmadığını kontrol et
            if (original.Length == 0)
            {
                throw new InvalidOperationException($"Stream is empty for file: {fileName}");
            }

            _logger.LogInformation("Loading image from stream - FileName: {FileName}, ContentType: {ContentType}, Length: {Length}", 
                fileName, contentType, original.Length);

            // HEIC/HEIF formatı kontrolü (iOS cihazlardan gelen fotoğraflar)
            var contentTypeLower = contentType?.ToLowerInvariant() ?? "";
            if (contentTypeLower.Contains("heic") || contentTypeLower.Contains("heif"))
            {
                _logger.LogWarning("HEIC/HEIF format detected - FileName: {FileName}, ContentType: {ContentType}", fileName, contentType);
                throw new InvalidOperationException(
                    $"iOS fotoğraflarınız HEIC formatında. Lütfen fotoğraflarınızı JPEG formatına dönüştürün. " +
                    $"Dosya: {fileName}. " +
                    "iOS Ayarlar > Kamera > Formatlar > En Uyumlu seçeneğini seçebilirsiniz.");
            }

            // ImageSharp ile yükle - hata durumunda daha açıklayıcı mesaj ver
            Image image;
            try
            {
                image = Image.Load(original);
            }
            catch (UnknownImageFormatException ex)
            {
                _logger.LogError(ex, "Unsupported image format - FileName: {FileName}, ContentType: {ContentType}", fileName, contentType);
                
                // HEIC formatı için özel mesaj
                if (contentTypeLower.Contains("heic") || contentTypeLower.Contains("heif"))
                {
                    throw new InvalidOperationException(
                        $"iOS fotoğraflarınız HEIC formatında. Lütfen fotoğraflarınızı JPEG formatına dönüştürün. " +
                        $"Dosya: {fileName}. " +
                        "iOS Ayarlar > Kamera > Formatlar > En Uyumlu seçeneğini seçebilirsiniz.", ex);
                }
                
                throw new InvalidOperationException(
                    $"Desteklenmeyen görüntü formatı: {contentType}. Dosya: {fileName}. " +
                    "Desteklenen formatlar: JPEG, PNG, GIF, WebP, TIFF, BMP, TGA, PBM, QOI. " +
                    "iOS kullanıcıları için: Ayarlar > Kamera > Formatlar > En Uyumlu seçeneğini seçin.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load image - FileName: {FileName}, ContentType: {ContentType}", fileName, contentType);
                throw new InvalidOperationException(
                    $"Görüntü yüklenemedi: {fileName}. Hata: {ex.Message}. " +
                    "Lütfen geçerli bir görüntü dosyası seçtiğinizden emin olun.", ex);
            }

            using (image)
            {
        int minSide = Math.Min(image.Width, image.Height);
        var rect = new Rectangle((image.Width - minSide) / 2, (image.Height - minSide) / 2, minSide, minSide);
        image.Mutate(ctx => ctx.Crop(rect).Resize(new Size(1080, 1080)));

        using var outStream = new MemoryStream();
        image.Save(outStream, new JpegEncoder { Quality = 85 });
        outStream.Position = 0;

        var blobName = $"uploads/{DateTime.UtcNow:yyyy/MM/dd}/{Guid.NewGuid()}_{Path.GetFileNameWithoutExtension(fileName)}.jpg";

        _logger.LogInformation("Uploading to GCS - Bucket: {Bucket}, BlobName: {BlobName}", bucket, blobName);

        var obj = await _storage.UploadObjectAsync(bucket, blobName, "image/jpeg", outStream);
        
        // Not: ACL işlemi şu anda çalışmıyor, bucket'ı public yapmak gerekiyor
        // Geçici çözüm: gsutil acl ch -u AllUsers:R gs://bucket/blobName komutu ile yapılabilir
        // Veya bucket'ı public yapmak için: gsutil iam ch allUsers:objectViewer gs://bucket
        _logger.LogInformation("Object uploaded: {BlobName}. Note: Bucket should be public for direct access.", blobName);
        
        var publicUrl = $"https://storage.googleapis.com/{bucket}/{blobName}";
        long uploadedSize = obj.Size.HasValue ? unchecked((long)obj.Size.Value) : outStream.Length;

        _logger.LogInformation("GCS Upload successful - URL: {Url}, Size: {Size}", publicUrl, uploadedSize);

        return (blobName, publicUrl, uploadedSize);
            }
        }
        catch (InvalidOperationException)
        {
            // Re-throw InvalidOperationException (bizim oluşturduğumuz açıklayıcı hatalar)
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during image upload - FileName: {FileName}, ContentType: {ContentType}", fileName, contentType);
            throw new InvalidOperationException(
                $"Görüntü yükleme sırasında beklenmeyen bir hata oluştu: {fileName}. Hata: {ex.Message}", ex);
        }
    }

    public async Task DeleteAsync(string bucket, string blobName)
    {
        try
        {
            await _storage.DeleteObjectAsync(bucket, blobName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete GCS object {BlobName}", blobName);
        }
    }

    public string GetSignedUrl(string bucket, string blobName, TimeSpan? expiration = null)
    {
        // Null veya boş blobName kontrolü
        if (string.IsNullOrWhiteSpace(blobName))
        {
            _logger.LogWarning("GetSignedUrl called with null or empty blobName. Bucket: {Bucket}", bucket);
            return string.Empty;
        }

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
    }
}


