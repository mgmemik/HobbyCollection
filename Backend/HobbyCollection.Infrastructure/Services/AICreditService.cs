using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using HobbyCollection.Domain.Services;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Infrastructure.Services;

/// <summary>
/// AI Kredi Servis Implementation
/// </summary>
public class AICreditService : IAICreditService
{
    private readonly IAICreditRepository _repository;
    private readonly ILogger<AICreditService> _logger;

    public AICreditService(IAICreditRepository repository, ILogger<AICreditService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<UserAICredit> GetOrCreateUserCreditAsync(string userId)
    {
        var userCredit = await _repository.GetUserCreditAsync(userId);
        
        if (userCredit != null)
        {
            return userCredit;
        }

        // Yeni kullanıcı için kredi oluştur
        // Default package yoksa otomatik oluştur
        var defaultPackage = await _repository.EnsureDefaultPackageAsync();

        var now = DateTime.UtcNow;
        userCredit = new UserAICredit
        {
            UserId = userId,
            PackageId = defaultPackage.Id,
            CurrentBalance = defaultPackage.MonthlyCredits,
            TotalEarned = defaultPackage.MonthlyCredits,
            TotalSpent = 0,
            LastRechargeDate = now,
            NextRechargeDate = now.AddMonths(1),
            CreatedAt = now
        };

        userCredit = await _repository.CreateUserCreditAsync(userCredit);
        
        // Package'ı yükle (navigation property için)
        userCredit.Package = defaultPackage;

        // İlk kredi yükleme işlemini kaydet (atomic transaction ile)
        var initialTransaction = new AICreditTransaction
        {
            UserId = userId,
            TransactionType = TransactionType.Charge,
            Amount = defaultPackage.MonthlyCredits,
            BalanceBefore = 0,
            BalanceAfter = defaultPackage.MonthlyCredits,
            Description = "Hesap açılış kredisi",
            IsSuccessful = true,
            CreatedAt = now
        };
        
        // Not: CreateUserCreditAsync zaten SaveChanges yaptı, bu yüzden burada sadece transaction ekliyoruz
        // Ama yine de atomic olması için ChargeCreditsAtomicallyAsync kullanabiliriz
        // Ancak bu durumda userCredit zaten kaydedilmiş, bu yüzden sadece transaction ekliyoruz
        await _repository.CreateTransactionAsync(initialTransaction);

        _logger.LogInformation("Kullanıcı {UserId} için {Credits} kredi ile yeni AI kredi hesabı oluşturuldu.", 
            userId, defaultPackage.MonthlyCredits);

        return userCredit;
    }

    public async Task<int> GetUserBalanceAsync(string userId)
    {
        var userCredit = await GetOrCreateUserCreditAsync(userId);
        return userCredit.CurrentBalance;
    }

    public async Task<bool> HasSufficientCreditsAsync(string userId, string operationType)
    {
        var userCredit = await GetOrCreateUserCreditAsync(userId);
        var operationCost = await _repository.GetOperationCostAsync(operationType);
        
        if (operationCost == null)
        {
            _logger.LogWarning("İşlem tipi {OperationType} için maliyet bulunamadı.", operationType);
            return false;
        }

        return userCredit.CurrentBalance >= operationCost.CreditCost;
    }

    public async Task<AICreditTransaction> SpendCreditsAsync(string userId, string operationType, string? description = null, int? productId = null)
    {
        // Operation cost'u al (transaction dışında - değişmeyen veri)
        var operationCost = await _repository.GetOperationCostAsync(operationType);
        
        if (operationCost == null)
        {
            _logger.LogError("İşlem tipi '{OperationType}' için maliyet bulunamadı. UserId: {UserId}", operationType, userId);
            throw new InvalidOperationException($"İşlem tipi '{operationType}' için maliyet bulunamadı.");
        }

        try
        {
            // Atomic transaction: Transaction içinde SELECT FOR UPDATE ile krediyi al, kontrol et, harca
            // Bu, race condition'ı önler - aynı anda çalışan işlemler sırayla çalışır
            var savedTransaction = await _repository.SpendCreditsAtomicallyAsync(
                userId, 
                operationType, 
                operationCost.CreditCost, 
                description, 
                productId);
            
            _logger.LogInformation("Kullanıcı {UserId} için {Credits} kredi harcandı. Önceki: {Before}, Sonraki: {After}", 
                userId, operationCost.CreditCost, savedTransaction.BalanceBefore, savedTransaction.BalanceAfter);

            return savedTransaction;
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Yetersiz AI kredisi"))
        {
            // Yetersiz kredi hatası - logla ve fırlat
            _logger.LogWarning("Yetersiz AI kredisi. UserId: {UserId}, Gerekli: {Required}", 
                userId, operationCost.CreditCost);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kredi harcama işlemi başarısız oldu. UserId: {UserId}, OperationType: {OperationType}, Credits: {Credits}", 
                userId, operationType, operationCost.CreditCost);
            throw;
        }
    }

    public async Task<AICreditTransaction> RefundCreditsAsync(string userId, string operationType, string? description = null, int? productId = null)
    {
        // Operation cost'u al (transaction dışında - değişmeyen veri)
        var operationCost = await _repository.GetOperationCostAsync(operationType);
        
        if (operationCost == null)
        {
            _logger.LogError("İşlem tipi '{OperationType}' için maliyet bulunamadı (Refund). UserId: {UserId}", operationType, userId);
            throw new InvalidOperationException($"İşlem tipi '{operationType}' için maliyet bulunamadı.");
        }

        try
        {
            // Atomic transaction: Transaction içinde SELECT FOR UPDATE ile krediyi al ve iade et
            var savedTransaction = await _repository.RefundCreditsAtomicallyAsync(
                userId, 
                operationType, 
                operationCost.CreditCost, 
                description, 
                productId);
            
            _logger.LogInformation("Kullanıcı {UserId} için {Credits} kredi iade edildi. Önceki: {Before}, Sonraki: {After}", 
                userId, operationCost.CreditCost, savedTransaction.BalanceBefore, savedTransaction.BalanceAfter);

            return savedTransaction;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kredi iade işlemi başarısız oldu. UserId: {UserId}, OperationType: {OperationType}", userId, operationType);
            throw;
        }
    }

    public async Task<AICreditTransaction> RechargeMonthlyCreditsAsync(string userId)
    {
        var userCredit = await GetOrCreateUserCreditAsync(userId);
        var package = await _repository.GetPackageByIdAsync(userCredit.PackageId);
        var monthlyCredits = package?.MonthlyCredits ?? 50;
        var planType = string.Equals(package?.Name, "Premium", StringComparison.OrdinalIgnoreCase) ? "premium" : "standard";
        return await RechargeMonthlyCreditsResetAsync(userId, monthlyCredits, planType);
    }

    public async Task<AICreditTransaction> RechargeMonthlyCreditsResetAsync(string userId, int monthlyCredits, string planType)
    {
        var userCredit = await GetOrCreateUserCreditAsync(userId);
        var newBalance = monthlyCredits + userCredit.BonusBalance;
        var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
        var nextRecharge = now.AddMonths(1);
        var planName = string.Equals(planType, "premium", StringComparison.OrdinalIgnoreCase) ? "Premium" : "Standard";
        var description = $"Aylık kredi yüklemesi ({planName} plan) - bakiyeniz yenilendi";

        var tx = await _repository.ChargeCreditsResetAtomicallyAsync(
            userId, newBalance, now, nextRecharge, monthlyCredits, planType, monthlyCredits, description);

        var package = await _repository.GetPackageByMonthlyCreditsAsync(monthlyCredits);
        if (package != null)
        {
            var updated = await _repository.GetUserCreditAsync(userId);
            if (updated != null && updated.PackageId != package.Id)
            {
                updated.PackageId = package.Id;
                await _repository.UpdateUserCreditAsync(updated);
            }
        }

        _logger.LogInformation(
            "Kullanıcı {UserId} için aylık kredi sıfırlanıp {Credits} yüklendi ({Plan}). Önceki: {Before}, Sonraki: {After}",
            userId, monthlyCredits, planName, tx.BalanceBefore, tx.BalanceAfter);
        return tx;
    }

    public async Task<AICreditTransaction> ApplyPlanUpgradeAsync(string userId, int monthlyCredits, string description)
    {
        var userCredit = await GetOrCreateUserCreditAsync(userId);
        var newBalance = monthlyCredits + userCredit.BonusBalance;
        var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
        var nextRecharge = now.AddMonths(1);
        var planType = monthlyCredits >= 200 ? "premium" : "standard";

        var tx = await _repository.ChargeCreditsResetAtomicallyAsync(
            userId, newBalance, now, nextRecharge, monthlyCredits, planType, monthlyCredits, description);

        var package = await _repository.GetPackageByMonthlyCreditsAsync(monthlyCredits);
        if (package != null)
        {
            var updated = await _repository.GetUserCreditAsync(userId);
            if (updated != null && updated.PackageId != package.Id)
            {
                updated.PackageId = package.Id;
                await _repository.UpdateUserCreditAsync(updated);
            }
        }

        _logger.LogInformation(
            "Kullanıcı {UserId} plan yükseltmesi/yenilemesi: bakiye {Credits} olarak ayarlandı. Sonraki yenileme: {Next}",
            userId, newBalance, nextRecharge);
        return tx;
    }

    public async Task<AICreditTransaction> ChargeCreditsAsync(string userId, int amount, string? description = null)
    {
        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "Yüklenecek kredi 0'dan büyük olmalıdır.");
        }

        try
        {
            // Atomic transaction: Transaction içinde SELECT FOR UPDATE ile krediyi al ve yükle
            // Bu, race condition'ı önler - aynı anda çalışan işlemler sırayla çalışır
            var savedTransaction = await _repository.ChargeCreditsAtomicallyAsync(userId, amount, description);
            
            _logger.LogInformation("Kullanıcı {UserId} için manuel {Credits} kredi yüklendi. Önceki: {Before}, Sonraki: {After}",
                userId, amount, savedTransaction.BalanceBefore, savedTransaction.BalanceAfter);
            
            return savedTransaction;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manuel kredi yükleme işlemi başarısız oldu. UserId: {UserId}, Credits: {Credits}", userId, amount);
            throw;
        }
    }

    public async Task<(List<AICreditTransaction> Transactions, int TotalCount)> GetUserTransactionHistoryAsync(string userId, int page = 1, int pageSize = 50)
    {
        var skip = (page - 1) * pageSize;
        var transactions = await _repository.GetUserTransactionsAsync(userId, skip, pageSize);
        var totalCount = await _repository.GetUserTransactionCountAsync(userId);
        
        return (transactions, totalCount);
    }

    public async Task<UserCreditSummary> GetUserCreditSummaryAsync(string userId)
    {
        var userCredit = await GetOrCreateUserCreditAsync(userId);
        
        var daysUntilRecharge = (userCredit.NextRechargeDate - DateTime.UtcNow).Days;
        if (daysUntilRecharge < 0) daysUntilRecharge = 0;

        return new UserCreditSummary
        {
            CurrentBalance = userCredit.CurrentBalance,
            TotalEarned = userCredit.TotalEarned,
            TotalSpent = userCredit.TotalSpent,
            LastRechargeDate = userCredit.LastRechargeDate,
            NextRechargeDate = userCredit.NextRechargeDate,
            PackageName = userCredit.Package?.Name ?? "Unknown",
            MonthlyCredits = userCredit.Package?.MonthlyCredits ?? 0,
            DaysUntilNextRecharge = daysUntilRecharge
        };
    }

    public async Task<List<AIOperationCost>> GetOperationCostsAsync()
    {
        return await _repository.GetAllOperationCostsAsync();
    }

    public async Task<AIOperationCost?> GetOperationCostAsync(string operationType)
    {
        return await _repository.GetOperationCostAsync(operationType);
    }

    public async Task ProcessMonthlyRechargesAsync()
    {
        var usersNeedingRecharge = await _repository.GetUsersNeedingRechargeAsync();
        
        _logger.LogInformation("Aylık kredi yüklemesi için {Count} kullanıcı bulundu.", usersNeedingRecharge.Count);

        foreach (var userCredit in usersNeedingRecharge)
        {
            try
            {
                await RechargeMonthlyCreditsAsync(userCredit.UserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kullanıcı {UserId} için kredi yüklemesi başarısız oldu.", userCredit.UserId);
            }
        }
    }
}

