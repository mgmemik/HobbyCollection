using Google.Cloud.Vision.V1;
using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis
{
    public class VisionApiService : IVisionApiService
    {
        private readonly ImageAnnotatorClient _visionClient;
        private readonly ILogger<VisionApiService> _logger;
        private readonly IUrlParserService _urlParser;

        public VisionApiService(
            ILogger<VisionApiService> logger,
            IUrlParserService urlParser)
        {
            _logger = logger;
            _urlParser = urlParser;
            _visionClient = ImageAnnotatorClient.Create();
        }

        public async Task<VisionAnalysisData> AnalyzePhotoAsync(IFormFile photo)
        {
            try
            {
                _logger.LogInformation($"[VISION API] Analiz başlatılıyor: {photo.FileName}");

                // Fotoğrafı byte array'e dönüştür
                byte[] imageBytes;
                using (var memoryStream = new MemoryStream())
                {
                    await photo.CopyToAsync(memoryStream);
                    imageBytes = memoryStream.ToArray();
                }
                _logger.LogInformation($"[VISION API] Görüntü byte array'e dönüştürüldü: {imageBytes.Length} bytes");

                var image = Google.Cloud.Vision.V1.Image.FromBytes(imageBytes);
                _logger.LogInformation($"[VISION API] Vision API Image objesi oluşturuldu");

                // Gelişmiş analiz - daha fazla özellik
                _logger.LogInformation($"[VISION API] Vision API istekleri hazırlanıyor...");
                var requests = new List<AnnotateImageRequest>
                {
                    new AnnotateImageRequest
                    {
                        Image = image,
                        Features =
                        {
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.LabelDetection, MaxResults = 50 },
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.WebDetection, MaxResults = 50 },
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.ObjectLocalization, MaxResults = 20 },
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.TextDetection, MaxResults = 20 },
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.LogoDetection, MaxResults = 10 }, // LOGO - Marka tespiti için çok önemli!
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.ImageProperties, MaxResults = 1 }, // Dominant colors
                            new Google.Cloud.Vision.V1.Feature { Type = Google.Cloud.Vision.V1.Feature.Types.Type.SafeSearchDetection, MaxResults = 1 }
                        },
                        // Çoklu dil desteği için OCR dil ipuçları
                        ImageContext = new ImageContext
                        {
                            LanguageHints = { "en", "tr", "de", "fr", "es", "it", "ja" } // İngilizce, Türkçe, Almanca, Fransızca, İspanyolca, İtalyanca, Japonca
                        }
                    }
                };

                _logger.LogInformation($"[VISION API] Google Cloud Vision API çağrısı yapılıyor...");
                var response = await _visionClient.BatchAnnotateImagesAsync(requests);

                if (response.Responses.Count == 0)
                {
                    _logger.LogWarning("[VISION API] Vision API'den yanıt alınamadı");
                    return new VisionAnalysisData();
                }

                var annotation = response.Responses[0];

                // Vision API error kontrolü
                if (annotation.Error != null)
                {
                    _logger.LogWarning($"[VISION API] Vision API hatası: {annotation.Error.Code} - {annotation.Error.Message}");
                    if (annotation.Error.Code == 3) // BAD_IMAGE_DATA
                    {
                        _logger.LogWarning($"[VISION API] Küçük veya bozuk fotoğraf algılandı, boş sonuç döndürülüyor");
                    }
                    return new VisionAnalysisData();
                }

                _logger.LogInformation($"[VISION API] Vision API yanıtı alındı. Response count: {response.Responses.Count}");
                _logger.LogInformation($"[VISION API] Annotation sonuçları - Labels: {annotation.LabelAnnotations?.Count ?? 0}, WebEntities: {annotation.WebDetection?.WebEntities?.Count ?? 0}, Objects: {annotation.LocalizedObjectAnnotations?.Count ?? 0}, Texts: {annotation.TextAnnotations?.Count ?? 0}, Logos: {annotation.LogoAnnotations?.Count ?? 0}");

                if (annotation.TextAnnotations?.Count > 0)
                {
                    var firstText = annotation.TextAnnotations[0];
                    _logger.LogInformation($"[VISION API] İlk OCR metni: '{firstText.Description?.Substring(0, Math.Min(100, firstText.Description?.Length ?? 0)) ?? "null"}'");
                }

                // Logo detection - Marka tespiti için çok güvenilir!
                if (annotation.LogoAnnotations?.Count > 0)
                {
                    var topLogos = annotation.LogoAnnotations.Take(3);
                    _logger.LogInformation($"[VISION API] 🏷️ LOGO TESPİT EDİLDİ: {string.Join(", ", topLogos.Select(l => $"'{l.Description}'({l.Score:F3})"))}");
                }

                // En iyi 5 label'ı log'la
                if (annotation.LabelAnnotations?.Count > 0)
                {
                    var topLabels = annotation.LabelAnnotations.Take(5);
                    _logger.LogInformation($"[VISION API] En iyi 5 label: {string.Join(", ", topLabels.Select(l => $"'{l.Description}'({l.Score:F3})"))}");
                }

                // Gelişmiş veri çıkarma
                var visionData = new VisionAnalysisData
                {
                    Labels = annotation.LabelAnnotations?.Select(l => new LabelInfo
                    {
                        Description = l.Description,
                        Score = l.Score
                    }).ToList() ?? new List<LabelInfo>(),

                    WebEntities = annotation.WebDetection?.WebEntities?.Select(w => new WebEntity
                    {
                        EntityId = w.EntityId ?? "",
                        Description = w.Description ?? "",
                        Score = w.Score
                    }).ToList() ?? new List<WebEntity>(),

                    WebPages = (annotation.WebDetection?.PagesWithMatchingImages?.Select(p => new WebPage
                    {
                        Url = p.Url ?? "",
                        PageTitle = p.PageTitle ?? "",
                        Score = (p.PartialMatchingImages?.Count ?? 0) + (p.FullMatchingImages?.Count ?? 0)
                    }).ToList() ?? new List<WebPage>())
                    .Concat(annotation.WebDetection?.FullMatchingImages?.Select(img => 
                    {
                        var url = img.Url ?? "";
                        var title = _urlParser.ExtractProductNameFromUrl(url, url.Contains("://") ? new Uri(url).Host : "", url);
                        return new WebPage
                        {
                            Url = url,
                            PageTitle = title ?? "",
                            Score = 1.0f
                        };
                    }).ToList() ?? new List<WebPage>())
                    .Concat(annotation.WebDetection?.PartialMatchingImages?.Select(img => 
                    {
                        var url = img.Url ?? "";
                        var title = _urlParser.ExtractProductNameFromUrl(url, url.Contains("://") ? new Uri(url).Host : "", url);
                        return new WebPage
                        {
                            Url = url,
                            PageTitle = title ?? "",
                            Score = 0.5f
                        };
                    }).ToList() ?? new List<WebPage>())
                    .ToList(),

                    VisuallySimilarImages = annotation.WebDetection?.VisuallySimilarImages?.Select(i => new WebImage
                    {
                        Url = i.Url ?? "",
                        Score = 1.0f
                    }).ToList() ?? new List<WebImage>(),

                    BestGuessLabel = annotation.WebDetection?.BestGuessLabels?.FirstOrDefault()?.Label ?? "",

                    Objects = annotation.LocalizedObjectAnnotations?.Select(o => new ObjectInfo
                    {
                        Name = o.Name,
                        Score = o.Score,
                        BoundingBox = new BoundingBox
                        {
                            Vertices = o.BoundingPoly?.NormalizedVertices?.Select(v => new HobbyCollection.Api.Models.Vertex
                            {
                                X = (int)v.X,
                                Y = (int)v.Y
                            }).ToList() ?? new List<HobbyCollection.Api.Models.Vertex>()
                        }
                    }).ToList() ?? new List<ObjectInfo>(),

                    // LOGO DETECTION - Marka tespiti için çok güvenilir kaynak!
                    Logos = annotation.LogoAnnotations?.Select(l => new LogoInfo
                    {
                        Description = l.Description ?? "",
                        Score = l.Score,
                        BoundingBox = new BoundingBox
                        {
                            Vertices = l.BoundingPoly?.Vertices?.Select(v => new HobbyCollection.Api.Models.Vertex
                            {
                                X = v.X,
                                Y = v.Y
                            }).ToList() ?? new List<HobbyCollection.Api.Models.Vertex>()
                        }
                    }).ToList() ?? new List<LogoInfo>(),

                    // DOMINANT COLORS - Ürün özellikleri için
                    DominantColors = annotation.ImagePropertiesAnnotation?.DominantColors?.Colors?
                        .OrderByDescending(c => c.Score)
                        .Take(5)
                        .Select(c => 
                        {
                            try
                            {
                                var color = c.Color;
                                // RGB değerleri float (0-1 arası) olarak gelir, 255 ile çarpıp int'e çevir
                                int red = (int)(color.Red * 255);
                                int green = (int)(color.Green * 255);
                                int blue = (int)(color.Blue * 255);
                                
                                // 0-255 aralığına sınırla
                                red = Math.Clamp(red, 0, 255);
                                green = Math.Clamp(green, 0, 255);
                                blue = Math.Clamp(blue, 0, 255);
                                
                                return $"#{red:X2}{green:X2}{blue:X2}";
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "[VISION API] Dominant color format hatası, atlanıyor");
                                return null;
                            }
                        })
                        .Where(c => c != null)
                        .Cast<string>()
                        .ToList() ?? new List<string>(),

                    ExtractedText = annotation.TextAnnotations?.Count > 0 ?
                        string.Join(" ", annotation.TextAnnotations.Select(t => t.Description)) : ""
                };

                _logger.LogInformation($"[VISION API] Vision API veri çıkarma tamamlandı");
                _logger.LogInformation($"[VISION API] Labels: {visionData.Labels.Count}, WebEntities: {visionData.WebEntities.Count}, WebPages: {visionData.WebPages.Count}, VisuallySimilarImages: {visionData.VisuallySimilarImages.Count}, Objects: {visionData.Objects.Count}, Logos: {visionData.Logos.Count}, Colors: {visionData.DominantColors.Count}, ExtractedText: {visionData.ExtractedText.Length} karakter");
                _logger.LogInformation($"[VISION API] BestGuessLabel: '{visionData.BestGuessLabel}'");
                
                if (visionData.WebPages.Count > 0)
                {
                    _logger.LogInformation($"[VISION API] Web sayfaları bulundu: {string.Join(", ", visionData.WebPages.Take(3).Select(p => $"{p.PageTitle}"))}");
                }

                return visionData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[VISION API] Vision API analizi hatası: {photo.FileName}");
                return new VisionAnalysisData();
            }
        }
    }
}

