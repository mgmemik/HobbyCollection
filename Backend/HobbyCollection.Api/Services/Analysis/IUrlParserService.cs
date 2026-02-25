namespace HobbyCollection.Api.Services.Analysis
{
    public interface IUrlParserService
    {
        bool IsMeaninglessTitle(string title);
        string? ExtractProductNameFromUrl(string url, string domain, string path);
        string ExtractProductNameFromText(string text);
    }
}

