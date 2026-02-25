using Google.Cloud.Storage.V1;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Infrastructure.Services;

public class DatabaseBackupService
{
    private readonly StorageClient _storageClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DatabaseBackupService> _logger;
    private readonly string _bucketName;
    private readonly string _objectName;
    private DateTime _lastBackupTime = DateTime.MinValue;
    private readonly TimeSpan _backupInterval = TimeSpan.FromMinutes(1); // Minimum 1 dakika aralıkla backup
    private readonly SemaphoreSlim _backupLock = new SemaphoreSlim(1, 1);

    public DatabaseBackupService(
        StorageClient storageClient,
        IConfiguration configuration,
        ILogger<DatabaseBackupService> logger)
    {
        _storageClient = storageClient;
        _configuration = configuration;
        _logger = logger;
        _bucketName = _configuration["GoogleCloud:Bucket"] ?? "hc-uploads-557805993095";
        _objectName = "database/app.db";
    }

    /// <summary>
    /// Database'i Cloud Storage'a yedekler (throttled - minimum 1 dakika aralıkla)
    /// </summary>
    public async Task BackupDatabaseAsync(string dbPath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(dbPath))
        {
            _logger.LogWarning("Database file not found: {DbPath}", dbPath);
            return;
        }

        // Throttle: Son backup'tan bu yana yeterli zaman geçmediyse skip et
        if (DateTime.UtcNow - _lastBackupTime < _backupInterval)
        {
            return;
        }

        // Lock: Aynı anda birden fazla backup işlemi olmasın
        if (!await _backupLock.WaitAsync(0, cancellationToken))
        {
            return; // Başka bir backup işlemi devam ediyor
        }

        try
        {
            _lastBackupTime = DateTime.UtcNow;

            // Database dosyasını oku ve Cloud Storage'a yükle
            using (var fileStream = File.OpenRead(dbPath))
            {
                await _storageClient.UploadObjectAsync(
                    _bucketName,
                    _objectName,
                    "application/octet-stream",
                    fileStream,
                    cancellationToken: cancellationToken);
            }

            _logger.LogInformation("Database backed up to Cloud Storage: {ObjectName}", _objectName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to backup database to Cloud Storage");
            // Hata olsa bile devam et, uygulama çalışmaya devam etsin
        }
        finally
        {
            _backupLock.Release();
        }
    }

    /// <summary>
    /// Database'i Cloud Storage'a yedekler (throttle olmadan - acil durumlar için)
    /// </summary>
    public async Task ForceBackupDatabaseAsync(string dbPath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(dbPath))
        {
            _logger.LogWarning("Database file not found: {DbPath}", dbPath);
            return;
        }

        await _backupLock.WaitAsync(cancellationToken);
        try
        {
            _lastBackupTime = DateTime.UtcNow;

            using (var fileStream = File.OpenRead(dbPath))
            {
                await _storageClient.UploadObjectAsync(
                    _bucketName,
                    _objectName,
                    "application/octet-stream",
                    fileStream,
                    cancellationToken: cancellationToken);
            }

            _logger.LogInformation("Database force backed up to Cloud Storage: {ObjectName}", _objectName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to force backup database to Cloud Storage");
            throw;
        }
        finally
        {
            _backupLock.Release();
        }
    }
}

