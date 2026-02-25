using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection;

/// <summary>
/// Kategori özel bilgi çıkarıcı interface
/// </summary>
public interface ICategorySpecificExtractor
{
    /// <summary>
    /// Bu extractor hangi kategori için kullanılır?
    /// </summary>
    ProductCategory Category { get; }
    
    /// <summary>
    /// Kategori özel bilgileri çıkar
    /// </summary>
    Models.CategorySpecificData ExtractCategoryData(AnalysisDataCollection data, ProductIdentificationResult baseResult);
}

