using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Repositories;

/// <summary>
/// AI Kredi Repository Interface
/// </summary>
public interface IAICreditRepository
{
    // Package İşlemleri
    Task<AICreditPackage?> GetDefaultPackageAsync();
    Task<AICreditPackage> EnsureDefaultPackageAsync();
    Task<AICreditPackage?> GetPackageByIdAsync(int id);
    /// <summary>
    /// Aylık kredi miktarına göre paket getirir (örn. 50 = Standard, 300 = Premium).
    /// </summary>
    Task<AICreditPackage?> GetPackageByMonthlyCreditsAsync(int monthlyCredits);
    Task<List<AICreditPackage>> GetActivePackagesAsync();
    
    // User Credit İşlemleri
    Task<UserAICredit?> GetUserCreditAsync(string userId);
    Task<UserAICredit> CreateUserCreditAsync(UserAICredit userCredit);
    Task UpdateUserCreditAsync(UserAICredit userCredit);
    
    // Operation Cost İşlemleri
    Task<AIOperationCost?> GetOperationCostAsync(string operationType);
    Task<List<AIOperationCost>> GetAllOperationCostsAsync();
    
    // Transaction İşlemleri
    Task<AICreditTransaction> CreateTransactionAsync(AICreditTransaction transaction);
    Task<List<AICreditTransaction>> GetUserTransactionsAsync(string userId, int skip = 0, int take = 50);
    Task<int> GetUserTransactionCountAsync(string userId);
    
    // Atomic Transaction İşlemleri (Kredi güncelleme + Transaction kaydı tek işlemde)
    // NOT: Bu metodlar transaction içinde SELECT FOR UPDATE ile krediyi alır (race condition önleme)
    Task<AICreditTransaction> SpendCreditsAtomicallyAsync(string userId, string operationType, int creditCost, string? description = null, int? productId = null);
    Task<AICreditTransaction> RefundCreditsAtomicallyAsync(string userId, string operationType, int creditCost, string? description = null, int? productId = null);
    Task<AICreditTransaction> ChargeCreditsAtomicallyAsync(string userId, int amount, string? description = null, DateTime? lastRechargeDate = null, DateTime? nextRechargeDate = null);
    
    /// <summary>
    /// Aylık yenilemede bakiyeyi sıfırlayıp yeni dönem kredisi yükler (kullanılmayan puanlar biriktirilmez).
    /// </summary>
    Task<AICreditTransaction> ChargeCreditsResetAtomicallyAsync(string userId, int newBalance, DateTime lastRechargeDate, DateTime nextRechargeDate, int totalEarnedAdd, string planType, int refreshAmount, string description);
    
    // Recharge İşlemleri
    Task<List<UserAICredit>> GetUsersNeedingRechargeAsync();
    
    /// <summary>
    /// Kullanıcının sonraki recharge tarihini güncelle
    /// </summary>
    Task UpdateNextRechargeDateAsync(string userId, DateTime nextRechargeDate);
    
    /// <summary>
    /// Aylık yenileme sonrası kullanıcı kredi bilgilerini güncelle
    /// </summary>
    Task UpdateAfterMonthlyRechargeAsync(string userId, string planType, int refreshAmount, DateTime nextRechargeDate);
}

