using HobbyCollection.Infrastructure;
using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using HobbyCollection.Api.Services.Analysis;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICategoryService _categories;
    private readonly IGeminiAnalysisService _gemini;
    private readonly IAICreditService _aiCreditService;
    private readonly ILogger<CategoriesController> _logger;

    public CategoriesController(
        AppDbContext db,
        ICategoryService categories,
        IGeminiAnalysisService gemini,
        IAICreditService aiCreditService,
        ILogger<CategoriesController> logger)
    {
        _db = db;
        _categories = categories;
        _gemini = gemini;
        _aiCreditService = aiCreditService;
        _logger = logger;
    }

    public record UpsertCategory(string Name, Guid? ParentId, string? Description);

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(UpsertCategory req)
    {
        var cat = await _categories.CreateAsync(req.Name, req.ParentId, req.Description);
        return Ok(cat);
    }

    [HttpGet("tree/{id}")]
    public async Task<IActionResult> GetDescendants(Guid id)
    {
        var ids = await _db.CategoryClosures
            .Where(x => x.AncestorId == id && x.Distance > 0)
            .Select(x => x.DescendantId)
            .ToListAsync();
        var items = await _db.Categories
            .Where(c => ids.Contains(c.Id))
            .OrderBy(c => c.Name)
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("children/{id}")]
    public async Task<IActionResult> GetChildren(Guid id, [FromQuery] string? language = null)
    {
        if (!string.IsNullOrEmpty(language) && (language == "en" || language == "tr"))
        {
            var translatedItems = await _categories.GetChildrenWithTranslationAsync(id, language);
            return Ok(translatedItems);
        }
        var items = await _categories.GetChildrenAsync(id);
        return Ok(items);
    }

    [HttpGet("roots")]
    public async Task<IActionResult> Roots([FromQuery] string? language = null)
    {
        if (!string.IsNullOrEmpty(language) && (language == "en" || language == "tr"))
        {
            var translatedRoots = await _categories.GetRootsWithTranslationAsync(language);
            return Ok(translatedRoots);
        }
        var roots = await _categories.GetRootsAsync();
        return Ok(roots);
    }

    /// <summary>
    /// Kullanıcının ürünlerindeki kategorilerin ana kategorilerini döner (optimize edilmiş)
    /// </summary>
    [HttpGet("roots-with-products")]
    [Authorize]
    public async Task<IActionResult> GetRootsWithProducts([FromQuery] string? language = null)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        // Kullanıcının ürünlerindeki kategori ID'lerini al
        var userProductCategoryIds = await _db.Products
            .Where(p => p.UserId == userId && p.CategoryId.HasValue)
            .Select(p => p.CategoryId!.Value)
            .Distinct()
            .ToListAsync();

        if (!userProductCategoryIds.Any())
        {
            // Ürün yoksa boş liste döndür
            return Ok(new List<Category>());
        }

        // Bu kategorilerin tüm ana kategorilerini bul (CategoryClosure kullanarak)
        var rootCategoryIds = await _db.CategoryClosures
            .Where(cc => userProductCategoryIds.Contains(cc.DescendantId) && cc.Distance > 0)
            .Select(cc => cc.AncestorId)
            .Distinct()
            .ToListAsync();

        // Ana kategorileri (ParentId == null) filtrele
        var rootCategories = await _db.Categories
            .Where(c => rootCategoryIds.Contains(c.Id) && c.ParentId == null)
            .OrderBy(c => c.Name)
            .ToListAsync();

        // Ayrıca direkt ana kategori olan ürün kategorilerini de ekle
        var directRootCategoryIds = await _db.Categories
            .Where(c => userProductCategoryIds.Contains(c.Id) && c.ParentId == null)
            .Select(c => c.Id)
            .ToListAsync();

        var directRootCategories = await _db.Categories
            .Where(c => directRootCategoryIds.Contains(c.Id))
            .OrderBy(c => c.Name)
            .ToListAsync();

        // Birleştir ve duplicate'leri kaldır
        var allRootCategories = rootCategories
            .Concat(directRootCategories)
            .GroupBy(c => c.Id)
            .Select(g => g.First())
            .OrderBy(c => c.Name)
            .ToList();

        if (!string.IsNullOrEmpty(language) && (language == "en" || language == "tr"))
        {
            // Translation'ları yükle
            var categoryIds = allRootCategories.Select(c => c.Id).ToList();
            var translations = await _db.CategoryTranslations
                .Where(t => categoryIds.Contains(t.CategoryId) && t.LanguageCode == language)
                .ToListAsync();

            var translatedCategories = allRootCategories.Select(c =>
            {
                var translation = translations.FirstOrDefault(t => t.CategoryId == c.Id);
                return new Category
                {
                    Id = c.Id,
                    Name = translation?.Name ?? c.Name,
                    Slug = c.Slug,
                    Description = translation?.Description ?? c.Description,
                    IsActive = c.IsActive,
                    CreatedAtUtc = c.CreatedAtUtc,
                    ParentId = c.ParentId
                };
            }).ToList();

            return Ok(translatedCategories);
        }

        return Ok(allRootCategories);
    }

    /// <summary>
    /// Belirli bir ana kategorinin alt kategorilerinden sadece ürün olanları döner
    /// </summary>
    [HttpGet("children-with-products/{parentId}")]
    [Authorize]
    public async Task<IActionResult> GetChildrenWithProducts(Guid parentId, [FromQuery] string? language = null)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        // Kullanıcının ürünlerindeki kategori ID'lerini al
        var userProductCategoryIds = await _db.Products
            .Where(p => p.UserId == userId && p.CategoryId.HasValue)
            .Select(p => p.CategoryId!.Value)
            .Distinct()
            .ToListAsync();

        if (!userProductCategoryIds.Any())
        {
            return Ok(new List<Category>());
        }

        // Bu parent'ın direkt çocuklarını al
        var directChildren = await _db.Categories
            .Where(c => c.ParentId == parentId)
            .ToListAsync();

        // Sadece ürün olan çocukları filtrele
        var childrenWithProducts = directChildren
            .Where(c => userProductCategoryIds.Contains(c.Id))
            .OrderBy(c => c.Name)
            .ToList();

        // Ayrıca bu parent'ın alt kategorilerinde (torunlarında ve daha derin seviyelerde) ürün olanları da kontrol et
        // Eğer bir alt kategoride (2. veya 3. seviye) ürün varsa, o alt kategorinin parent'ı (direkt çocuk) da gösterilmeli
        var descendantCategoryIds = await _db.CategoryClosures
            .Where(cc => cc.AncestorId == parentId && cc.Distance > 0)
            .Select(cc => cc.DescendantId)
            .Distinct()
            .ToListAsync();

        var descendantCategoriesWithProducts = await _db.Categories
            .Where(c => descendantCategoryIds.Contains(c.Id) && userProductCategoryIds.Contains(c.Id))
            .ToListAsync();

        // Bu alt kategorilerin parent'larını bul (direkt çocuklar olmalı)
        // Her descendant için, CategoryClosure kullanarak direkt çocuk olan ancestor'ları bul
        var parentIdsToInclude = new HashSet<Guid>();
        
        foreach (var descendant in descendantCategoriesWithProducts)
        {
            // Bu kategorinin tüm ancestor'larını bul (parent hariç)
            var ancestors = await _db.CategoryClosures
                .Where(cc => cc.DescendantId == descendant.Id && cc.Distance > 0)
                .Select(cc => cc.AncestorId)
                .Distinct()
                .ToListAsync();
            
            // Bu ancestor'ların içinden direkt çocuk olanları (ParentId == parentId) bul
            var directChildrenAncestors = await _db.Categories
                .Where(c => ancestors.Contains(c.Id) && c.ParentId == parentId)
                .Select(c => c.Id)
                .ToListAsync();
            
            foreach (var ancestorId in directChildrenAncestors)
            {
                parentIdsToInclude.Add(ancestorId);
            }
        }

        var parentCategories = await _db.Categories
            .Where(c => parentIdsToInclude.Contains(c.Id))
            .ToListAsync();

        // Birleştir ve duplicate'leri kaldır
        var allChildrenWithProducts = childrenWithProducts
            .Concat(parentCategories)
            .GroupBy(c => c.Id)
            .Select(g => g.First())
            .OrderBy(c => c.Name)
            .ToList();

        if (!string.IsNullOrEmpty(language) && (language == "en" || language == "tr"))
        {
            var categoryIds = allChildrenWithProducts.Select(c => c.Id).ToList();
            var translations = await _db.CategoryTranslations
                .Where(t => categoryIds.Contains(t.CategoryId) && t.LanguageCode == language)
                .ToListAsync();

            var translatedCategories = allChildrenWithProducts.Select(c =>
            {
                var translation = translations.FirstOrDefault(t => t.CategoryId == c.Id);
                return new Category
                {
                    Id = c.Id,
                    Name = translation?.Name ?? c.Name,
                    Slug = c.Slug,
                    Description = translation?.Description ?? c.Description,
                    IsActive = c.IsActive,
                    CreatedAtUtc = c.CreatedAtUtc,
                    ParentId = c.ParentId
                };
            }).ToList();

            return Ok(translatedCategories);
        }

        return Ok(allChildrenWithProducts);
    }

    /// <summary>
    /// Belirli bir kategorinin root'tan başlayarak tüm path'ini döner (çeviri desteği ile)
    /// </summary>
    [HttpGet("path/{categoryId}")]
    public async Task<IActionResult> GetCategoryPath(Guid categoryId, [FromQuery] string? language = null)
    {
        var category = await _db.Categories.FindAsync(categoryId);
        if (category == null) return NotFound();

        // CategoryClosure kullanarak tüm ancestor'ları bul (distance'a göre sırala)
        var ancestors = await _db.CategoryClosures
            .Where(cc => cc.DescendantId == categoryId && cc.Distance > 0)
            .OrderBy(cc => cc.Distance)
            .Select(cc => cc.AncestorId)
            .ToListAsync();

        // Kendisini de ekle
        var allCategoryIds = ancestors.Concat(new[] { categoryId }).ToList();

        // Kategorileri yükle
        var categories = await _db.Categories
            .Where(c => allCategoryIds.Contains(c.Id))
            .ToListAsync();

        // Distance'a göre sırala
        var path = ancestors
            .Select(id => categories.First(c => c.Id == id))
            .Concat(new[] { category })
            .ToList();

        // Çeviri desteği
        if (!string.IsNullOrEmpty(language) && (language == "en" || language == "tr"))
        {
            var categoryIds = path.Select(c => c.Id).ToList();
            var translations = await _db.CategoryTranslations
                .Where(t => categoryIds.Contains(t.CategoryId) && t.LanguageCode == language)
                .ToListAsync();

            var translatedPath = path.Select(c =>
            {
                var translation = translations.FirstOrDefault(t => t.CategoryId == c.Id);
                return new Category
                {
                    Id = c.Id,
                    Name = translation?.Name ?? c.Name,
                    Slug = c.Slug,
                    Description = translation?.Description ?? c.Description,
                    IsActive = c.IsActive,
                    CreatedAtUtc = c.CreatedAtUtc,
                    ParentId = c.ParentId
                };
            }).ToList();

            return Ok(translatedPath);
        }

        return Ok(path);
    }

    /// <summary>
    /// Eksik kategori çevirilerini tamamlar (migration endpoint)
    /// Bu endpoint production'da bir kez çalıştırılmalı
    /// </summary>
    [HttpPost("fix-translations")]
    public async Task<IActionResult> FixMissingTranslations()
    {
        var translations = HobbyCollection.Api.Seeders.CategoryTranslationMap.Translations;
        
        // Tüm kategorileri al
        var categories = await _db.Categories.ToListAsync();
        
        // Mevcut çevirileri al
        var existingTranslations = await _db.CategoryTranslations.ToListAsync();
        var translationDict = existingTranslations
            .GroupBy(t => t.CategoryId)
            .ToDictionary(g => g.Key, g => g.ToList());
        
        var newTranslations = new List<HobbyCollection.Domain.Entities.CategoryTranslation>();
        var updatedCount = 0;
        
        foreach (var cat in categories)
        {
            var hasTr = translationDict.ContainsKey(cat.Id) && translationDict[cat.Id].Any(t => t.LanguageCode == "tr");
            var hasEn = translationDict.ContainsKey(cat.Id) && translationDict[cat.Id].Any(t => t.LanguageCode == "en");
            
            // Türkçe çeviri eksikse ekle (orijinal isim Türkçe)
            if (!hasTr)
            {
                newTranslations.Add(new HobbyCollection.Domain.Entities.CategoryTranslation
                {
                    CategoryId = cat.Id,
                    LanguageCode = "tr",
                    Name = cat.Name
                });
                updatedCount++;
            }
            
            // İngilizce çeviri eksikse ekle
            if (!hasEn)
            {
                var englishName = translations.TryGetValue(cat.Name, out var enName) 
                    ? enName 
                    : cat.Name; // Çeviri yoksa orijinali kullan
                
                newTranslations.Add(new HobbyCollection.Domain.Entities.CategoryTranslation
                {
                    CategoryId = cat.Id,
                    LanguageCode = "en",
                    Name = englishName
                });
                updatedCount++;
            }
            else if (hasEn)
            {
                // Mevcut İngilizce çeviriyi güncelle (eğer Türkçe ise İngilizce'ye çevir)
                var currentEnTranslation = translationDict[cat.Id].First(t => t.LanguageCode == "en");
                if (translations.TryGetValue(currentEnTranslation.Name, out var correctEnName))
                {
                    // Mevcut çeviri aslında Türkçe, güncelle
                    currentEnTranslation.Name = correctEnName;
                    updatedCount++;
                }
                else if (translations.TryGetValue(cat.Name, out var enFromOriginal) && currentEnTranslation.Name != enFromOriginal)
                {
                    // Orijinal isimden çeviri var ve farklı
                    currentEnTranslation.Name = enFromOriginal;
                    updatedCount++;
                }
            }
        }
        
        if (newTranslations.Any())
        {
            _db.CategoryTranslations.AddRange(newTranslations);
        }
        
        await _db.SaveChangesAsync();
        
        return Ok(new { 
            message = "Çeviri düzeltmeleri tamamlandı", 
            newTranslationsAdded = newTranslations.Count,
            totalUpdated = updatedCount
        });
    }

    /// <summary>
    /// Duplicate kategorileri temizler (aynı isim ve parentId'ye sahip olanlar)
    /// </summary>
    [HttpPost("fix-duplicates")]
    public async Task<IActionResult> FixDuplicateCategories()
    {
        // Aynı Name ve ParentId'ye sahip duplicate kategorileri bul
        var allCategories = await _db.Categories.ToListAsync();
        
        var duplicates = allCategories
            .GroupBy(c => new { c.Name, c.ParentId })
            .Where(g => g.Count() > 1)
            .SelectMany(g => g.Skip(1)) // İlkini tut, diğerlerini sil
            .ToList();
        
        if (!duplicates.Any())
        {
            return Ok(new { message = "Duplicate kategori bulunamadı", deletedCount = 0 });
        }
        
        var deletedIds = duplicates.Select(d => d.Id).ToList();
        
        // Önce bu kategorilere ait çevirileri sil
        var translationsToDelete = await _db.CategoryTranslations
            .Where(t => deletedIds.Contains(t.CategoryId))
            .ToListAsync();
        _db.CategoryTranslations.RemoveRange(translationsToDelete);
        
        // CategoryClosures'ları sil
        var closuresToDelete = await _db.CategoryClosures
            .Where(cc => deletedIds.Contains(cc.AncestorId) || deletedIds.Contains(cc.DescendantId))
            .ToListAsync();
        _db.CategoryClosures.RemoveRange(closuresToDelete);
        
        // Ürünlerin categoryId'lerini güncelle (duplicate'ten orijinale)
        foreach (var duplicate in duplicates)
        {
            var original = allCategories.First(c => c.Name == duplicate.Name && c.ParentId == duplicate.ParentId && c.Id != duplicate.Id);
            await _db.Products
                .Where(p => p.CategoryId == duplicate.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.CategoryId, original.Id));
        }
        
        // Duplicate kategorileri sil
        _db.Categories.RemoveRange(duplicates);
        
        await _db.SaveChangesAsync();
        
        return Ok(new { 
            message = "Duplicate kategoriler silindi", 
            deletedCount = duplicates.Count,
            deletedTranslations = translationsToDelete.Count,
            deletedClosures = closuresToDelete.Count
        });
    }

    /// <summary>
    /// Tüm kategorilerin çeviri durumunu gösterir (debug endpoint)
    /// </summary>
    [HttpGet("translation-status")]
    public async Task<IActionResult> GetTranslationStatus()
    {
        var categories = await _db.Categories.ToListAsync();
        var translations = await _db.CategoryTranslations.ToListAsync();
        
        var result = categories.Select(c => new
        {
            c.Id,
            c.Name,
            TrTranslation = translations.FirstOrDefault(t => t.CategoryId == c.Id && t.LanguageCode == "tr")?.Name,
            EnTranslation = translations.FirstOrDefault(t => t.CategoryId == c.Id && t.LanguageCode == "en")?.Name,
            HasTr = translations.Any(t => t.CategoryId == c.Id && t.LanguageCode == "tr"),
            HasEn = translations.Any(t => t.CategoryId == c.Id && t.LanguageCode == "en")
        }).OrderBy(c => c.Name).ToList();
        
        var missingTr = result.Count(r => !r.HasTr);
        var missingEn = result.Count(r => !r.HasEn);
        var wrongEn = result.Count(r => r.HasEn && r.EnTranslation == r.Name && HobbyCollection.Api.Seeders.CategoryTranslationMap.Translations.ContainsKey(r.Name));
        
        return Ok(new
        {
            TotalCategories = result.Count,
            MissingTurkish = missingTr,
            MissingEnglish = missingEn,
            PotentiallyWrongEnglish = wrongEn,
            Categories = result.Take(50) // İlk 50 kategori
        });
    }

    public sealed record SuggestCategoryRequest(string ProductText, string? Language = null);

    public sealed record SuggestedCategoryNode(Guid Id, string Name);

    [HttpPost("ai-suggest")]
    [Authorize]
    public async Task<IActionResult> SuggestCategoryByAI([FromBody] SuggestCategoryRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var lang = string.IsNullOrWhiteSpace(request.Language) ? "en" : request.Language!.Trim().ToLowerInvariant();
        if (lang != "en" && lang != "tr") lang = "en";

        if (string.IsNullOrWhiteSpace(request.ProductText))
        {
            return BadRequest(new { success = false, error = "ProductText gerekli" });
        }

        // AI kredi kontrolü (1 kredi)
        var hasSufficientCredits = await _aiCreditService.HasSufficientCreditsAsync(userId, AIOperationType.CategoryDetection);
        if (!hasSufficientCredits)
        {
            var balance = await _aiCreditService.GetUserBalanceAsync(userId);
            var operationCost = await _aiCreditService.GetOperationCostAsync(AIOperationType.CategoryDetection);
            var requiredCredits = operationCost?.CreditCost ?? 1;
            return StatusCode(402, new
            {
                success = false,
                error = $"Yetersiz AI kredisi. Bu işlem için {requiredCredits} kredi gereklidir.",
                balance
            });
        }

        // Kategori listesi (leaf'ler)
        var categories = await _db.Categories.AsNoTracking().ToListAsync();
        var hasChildrenSet = categories
            .Where(c => c.ParentId.HasValue)
            .Select(c => c.ParentId!.Value)
            .ToHashSet();

        var leafCategories = categories.Where(c => !hasChildrenSet.Contains(c.Id)).ToList();
        if (leafCategories.Count == 0)
        {
            return Ok(new { success = false, error = "Leaf kategori bulunamadı" });
        }

        // Çeviriler (opsiyonel)
        var translationMap = await _db.CategoryTranslations
            .AsNoTracking()
            .Where(t => t.LanguageCode == lang)
            .ToDictionaryAsync(t => t.CategoryId, t => t.Name);

        string GetName(Guid id)
        {
            if (translationMap.TryGetValue(id, out var translated)) return translated;
            var cat = categories.FirstOrDefault(c => c.Id == id);
            return cat?.Name ?? id.ToString();
        }

        // Closure ile path üret
        var leafIds = leafCategories.Select(c => c.Id).ToList();
        var closureRows = await _db.CategoryClosures
            .AsNoTracking()
            .Where(cc => leafIds.Contains(cc.DescendantId) && cc.Distance >= 0)
            .Select(cc => new { cc.DescendantId, cc.AncestorId, cc.Distance })
            .ToListAsync();

        var candidates = leafCategories.Select(leaf =>
        {
            var ancestors = closureRows
                .Where(x => x.DescendantId == leaf.Id)
                .OrderByDescending(x => x.Distance)
                .Select(x => x.AncestorId)
                .ToList();
            if (!ancestors.Contains(leaf.Id)) ancestors.Add(leaf.Id);
            var path = string.Join(" / ", ancestors.Select(GetName));
            return new CategoryCandidate { Id = leaf.Id.ToString(), Path = path };
        }).ToList();

        // Eğer liste çok büyükse fallback (roots -> leaf under root)
        const int maxCandidatesPerPrompt = 500;
        var selectedResult = default(CategorySuggestionResult);
        if (candidates.Count <= maxCandidatesPerPrompt)
        {
            selectedResult = await _gemini.SuggestCategoryAsync(request.ProductText, candidates, lang);
        }
        else
        {
            // Step 1: Root seç
            var roots = categories.Where(c => c.ParentId == null).ToList();
            var rootCandidates = roots.Select(r => new CategoryCandidate { Id = r.Id.ToString(), Path = GetName(r.Id) }).ToList();
            var rootPick = await _gemini.SuggestCategoryAsync(request.ProductText, rootCandidates, lang);

            if (!Guid.TryParse(rootPick.CategoryId, out var rootId))
            {
                selectedResult = rootPick;
            }
            else
            {
                // Step 2: Seçilen root altındaki leaf'ler
                var leafUnderRootIds = closureRows
                    .Where(x => x.AncestorId == rootId && x.Distance > 0)
                    .Select(x => x.DescendantId)
                    .Distinct()
                    .Intersect(leafIds)
                    .ToList();

                var leafUnderRootCandidates = candidates
                    .Where(c => Guid.TryParse(c.Id, out var cid) && leafUnderRootIds.Contains(cid))
                    .Take(maxCandidatesPerPrompt)
                    .ToList();

                selectedResult = await _gemini.SuggestCategoryAsync(request.ProductText, leafUnderRootCandidates, lang);
            }
        }

        if (selectedResult == null || string.IsNullOrWhiteSpace(selectedResult.CategoryId))
        {
            return Ok(new
            {
                success = false,
                error = selectedResult?.Error ?? "Kategori önerilemedi",
                reasoning = selectedResult?.Reasoning,
                confidence = selectedResult?.Confidence
            });
        }

        if (!Guid.TryParse(selectedResult.CategoryId, out var selectedCategoryId))
        {
            return Ok(new
            {
                success = false,
                error = "Geçersiz kategori id döndü",
                reasoning = selectedResult.Reasoning
            });
        }

        // Path'i döndür (mobile direkt set edebilsin)
        var pathIds = closureRows
            .Where(x => x.DescendantId == selectedCategoryId)
            .OrderByDescending(x => x.Distance)
            .Select(x => x.AncestorId)
            .ToList();
        if (!pathIds.Contains(selectedCategoryId)) pathIds.Add(selectedCategoryId);

        var path = pathIds.Select(id => new SuggestedCategoryNode(id, GetName(id))).ToList();

        // Kredi harca (sadece başarılı öneride)
        try
        {
            await _aiCreditService.SpendCreditsAsync(
                userId,
                AIOperationType.CategoryDetection,
                $"Kategori tespiti: {path.LastOrDefault()?.Name ?? selectedCategoryId.ToString()}",
                productId: null
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI kredi harcama hatası (CategoryDetection). UserId={UserId}", userId);
            // Kredi hatası öneriyi bozmamalı
        }

        return Ok(new
        {
            success = true,
            categoryId = selectedCategoryId,
            categoryPath = path,
            confidence = selectedResult.Confidence,
            reasoning = selectedResult.Reasoning
        });
    }
}


