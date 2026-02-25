namespace HobbyCollection.Domain.Abstractions;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);

    Task SendWithAttachmentsAsync(
        string to,
        string subject,
        string htmlBody,
        IReadOnlyCollection<EmailAttachment> attachments,
        CancellationToken ct = default);
}



