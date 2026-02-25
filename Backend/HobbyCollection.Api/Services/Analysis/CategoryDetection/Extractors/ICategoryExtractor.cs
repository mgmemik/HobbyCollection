using HobbyCollection.Api.Models;

namespace HobbyCollection.Api.Services.Analysis.CategoryDetection.Extractors;

/// <summary>
/// Kategori bazlı bilgi çıkarma interface'i
/// </summary>
public interface ICategoryExtractor
{
    /// <summary>
    /// Bu extractor hangi kategori için?
    /// </summary>
    ProductCategory SupportedCategory { get; }
    
    /// <summary>
    /// Kategori bazlı bilgileri çıkar ve ProductIdentificationResult'a ekle
    /// </summary>
    void EnrichResult(ProductIdentificationResult result, AnalysisDataCollection data);
}

/// <summary>
/// Kategori bazlı ekstra bilgiler için model
/// </summary>
public class CategorySpecificData
{
    // BOOK
    public string? Author { get; set; }
    public string? Title { get; set; }
    public string? ISBN { get; set; }
    public string? Publisher { get; set; }
    public int? PublicationYear { get; set; }
    
    // COIN / STAMP
    public string? Country { get; set; }
    public int? Year { get; set; }
    public string? Denomination { get; set; }
    public string? Theme { get; set; }
    
    // RECORD
    public string? Artist { get; set; }
    public string? Album { get; set; }
    public string? RecordLabel { get; set; }
    
    // VIDEO GAME
    public string? Platform { get; set; }
    public string? GameTitle { get; set; }
    
    // CARD
    public string? PlayerName { get; set; }
    public string? CardNumber { get; set; }
    public string? CardSet { get; set; }
    
    // COMIC BOOK
    public string? IssueNumber { get; set; }
    
    // SHOE
    public string? Color { get; set; }
    public string? Size { get; set; }
    
    // ANTIQUE
    public string? Material { get; set; }
    public string? Period { get; set; }
    public string? Style { get; set; }
}

