using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

using HobbyCollection.Domain.Abstractions;

namespace HobbyCollection.Api.Services;

public sealed class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
}

public sealed class EmailSender : IEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(IOptions<SmtpOptions> options, ILogger<EmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.From));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        try
        {
            _logger.LogInformation("SMTP connecting to {Host}:{Port}", _options.Host, _options.Port);
            client.CheckCertificateRevocation = false;
            await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, ct);
            if (!string.IsNullOrEmpty(_options.Username))
            {
                _logger.LogInformation("SMTP authenticating as {User}", _options.Username);
                await client.AuthenticateAsync(_options.Username, _options.Password, ct);
            }
            await client.SendAsync(message, ct);
            _logger.LogInformation("SMTP sent message to {To}", to);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send failed to {To}", to);
            throw;
        }
        finally
        {
            try { await client.DisconnectAsync(true, ct); } catch { /* ignore */ }
        }
    }

    public async Task SendWithAttachmentsAsync(
        string to,
        string subject,
        string htmlBody,
        IReadOnlyCollection<EmailAttachment> attachments,
        CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.From));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
        foreach (var a in attachments)
        {
            if (a.Content is null || a.Content.Length == 0) continue;
            var contentType = !string.IsNullOrWhiteSpace(a.ContentType)
                ? ContentType.Parse(a.ContentType)
                : new ContentType("application", "octet-stream");
            bodyBuilder.Attachments.Add(a.FileName, a.Content, contentType);
        }
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        try
        {
            _logger.LogInformation("SMTP connecting to {Host}:{Port}", _options.Host, _options.Port);
            client.CheckCertificateRevocation = false;
            await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, ct);
            if (!string.IsNullOrEmpty(_options.Username))
            {
                _logger.LogInformation("SMTP authenticating as {User}", _options.Username);
                await client.AuthenticateAsync(_options.Username, _options.Password, ct);
            }
            await client.SendAsync(message, ct);
            _logger.LogInformation("SMTP sent message with attachments to {To}", to);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send with attachments failed to {To}", to);
            throw;
        }
        finally
        {
            try { await client.DisconnectAsync(true, ct); } catch { /* ignore */ }
        }
    }
}


