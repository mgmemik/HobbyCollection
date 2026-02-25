namespace HobbyCollection.Domain.Abstractions;

public interface IImageStorageService
{
    Task<(string blobName, string publicUrl, long sizeBytes)> UploadSquareAsync(Stream original, string fileName, string contentType, string bucket);
    Task DeleteAsync(string bucket, string blobName);
    string GetSignedUrl(string bucket, string blobName, TimeSpan? expiration = null);
}



