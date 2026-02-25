using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Formats.Jpeg;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services
{
    public interface IPhotoPreprocessingService
    {
        Task<byte[]> PreprocessPhotoAsync(byte[] originalImageBytes, string fileName);
    }

    public class PhotoPreprocessingService : IPhotoPreprocessingService
    {
        private readonly ILogger<PhotoPreprocessingService> _logger;

        public PhotoPreprocessingService(ILogger<PhotoPreprocessingService> logger)
        {
            _logger = logger;
        }

        public async Task<byte[]> PreprocessPhotoAsync(byte[] originalImageBytes, string fileName)
        {
            try
            {
                _logger.LogInformation($"[PREPROCESSING] Fotoğraf ön işleme başlatılıyor: {fileName}, Boyut: {originalImageBytes.Length} bytes");

                using var image = Image.Load<Rgba32>(originalImageBytes);
                _logger.LogInformation($"[PREPROCESSING] Orijinal boyutlar: {image.Width}x{image.Height}");

                // 1. Arka planı beyazlaştır/sadeleştir
                _logger.LogInformation("[PREPROCESSING] Arka plan beyazlaştırma işlemi başlatılıyor...");
                image.Mutate(ctx => ProcessBackground(ctx));

                // 2. Işık, kontrast ve renk dengesi normalizasyonu
                _logger.LogInformation("[PREPROCESSING] Renk normalizasyonu işlemi başlatılıyor...");
                image.Mutate(ctx => NormalizeColors(ctx));

                // 3. İşlenmiş görüntüyü byte array'e dönüştür
                using var outputStream = new MemoryStream();
                await image.SaveAsync(outputStream, new JpegEncoder { Quality = 95 });
                var processedBytes = outputStream.ToArray();

                _logger.LogInformation($"[PREPROCESSING] Ön işleme tamamlandı. İşlenmiş boyut: {processedBytes.Length} bytes");
                _logger.LogInformation($"[PREPROCESSING] Boyut değişimi: {originalImageBytes.Length} → {processedBytes.Length} bytes ({(processedBytes.Length / (double)originalImageBytes.Length * 100):F1}%)");
                return processedBytes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PREPROCESSING] Fotoğraf ön işleme hatası");
                // Hata durumunda orijinal fotoğrafı döndür
                return originalImageBytes;
            }
        }

        private void ProcessBackground(IImageProcessingContext ctx)
        {
            // Çok hafif arka plan sadeleştirme - detayları koruma
            ctx
                .GaussianBlur(0.5f) // Çok hafif bulanıklaştırma
                .Brightness(0.02f) // Minimal parlaklık artırma
                .Contrast(0.02f); // Minimal kontrast artırma
        }

        private void NormalizeColors(IImageProcessingContext ctx)
        {
            // Minimal renk normalizasyonu - detayları koruma
            ctx
                .Brightness(0.01f) // Minimal parlaklık ayarı
                .Contrast(0.01f) // Minimal kontrast ayarı
                .Saturate(0.02f); // Minimal doygunluk artırma
        }

        private void ProcessBackgroundAdvanced(IImageProcessingContext ctx)
        {
            // Gelişmiş arka plan işleme (opsiyonel)
            // Kenar algılama ve arka plan maskeleme
            ctx
                .DetectEdges()
                .GaussianBlur(1.5f)
                .Brightness(0.15f)
                .Contrast(0.1f);
        }

        private void NormalizeColorsAdvanced(IImageProcessingContext ctx)
        {
            // Gelişmiş renk normalizasyonu
            ctx
                .Brightness(0.08f)
                .Contrast(0.08f)
                .Saturate(0.12f)
                .Vignette(); // Hafif vignette efekti
        }
    }
}
