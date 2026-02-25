namespace HobbyCollection.Domain.Abstractions;

public sealed record EmailAttachment(
    string FileName,
    byte[] Content,
    string ContentType = "application/octet-stream");

