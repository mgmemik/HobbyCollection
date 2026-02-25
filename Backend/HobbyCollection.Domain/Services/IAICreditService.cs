using HobbyCollection.Domain.Entities;

namespace HobbyCollection.Domain.Services;

/// <summary>
/// AI Kredi Servis Interface
/// </summary>
public interface IAICreditService
{
    /// <summary>
    /// Kullanıcının AI kredi bilgisini getirir. Yoksa oluşturur.
    /// </summary>
    Task<UserAICredit> GetOrCreateUserCreditAsync(string userId);
    
    /// <summary>
    /// Kullanıcının kredi bakiyesini getirir
    /// </summary>
    Task<int> GetUserBalanceAsync(string userId);
    
    /// <summary>
    /// Kullanıcının yeterli kredisi olup olmadığını kontrol eder
    /// </summary>
    Task<bool> HasSufficientCreditsAsync(string userId, string operationType);
    
    /// <summary>
    /// AI işlemi için kredi harcar. Başarısız olursa exception fırlatır.
    /// </summary>
    Task<AICreditTransaction> SpendCreditsAsync(string userId, string operationType, string? description = null, int? productId = null);
    
    /// <summary>
    /// Başarısız işlem için kredi iadesi yapar
    /// </summary>
    Task<AICreditTransaction> RefundCreditsAsync(string userId, string operationType, string? description = null, int? productId = null);
    
    /// <summary>
    /// Kullanıcıya aylık kredi yükler
    /// </summary>
    Task<AICreditTransaction> RechargeMonthlyCreditsAsync(string userId);

    /// <summary>
    /// Aylık yenilemede önceki dönem bakiyesini sıfırlayıp yeni dönem kredisi yükler (kullanılmayan puanlar biriktirilmez).
    /// </summary>
    Task<AICreditTransaction> RechargeMonthlyCreditsResetAsync(string userId, int monthlyCredits, string planType);

    /// <summary>
    /// Plan yükseltmesi veya yenilemede (ay ortası Premium vb.) bakiyeyi yeni plan kotasıyla değiştirir, sonraki yenileme tarihini 1 ay sonraya ayarlar.
    /// </summary>
    Task<AICreditTransaction> ApplyPlanUpgradeAsync(string userId, int monthlyCredits, string description);

    /// <summary>
    /// Kullanıcıya manuel kredi yükler (admin vb. için)
    /// </summary>
    Task<AICreditTransaction> ChargeCreditsAsync(string userId, int amount, string? description = null);
    
    /// <summary>
    /// Kullanıcının işlem geçmişini getirir
    /// </summary>
    Task<(List<AICreditTransaction> Transactions, int TotalCount)> GetUserTransactionHistoryAsync(string userId, int page = 1, int pageSize = 50);
    
    /// <summary>
    /// Kullanıcının kredi özetini getirir
    /// </summary>
    Task<UserCreditSummary> GetUserCreditSummaryAsync(string userId);
    
    /// <summary>
    /// İşlem maliyetlerini getirir
    /// </summary>
    Task<List<AIOperationCost>> GetOperationCostsAsync();
    
    /// <summary>
    /// Belirli bir işlem tipinin maliyetini getirir
    /// </summary>
    Task<AIOperationCost?> GetOperationCostAsync(string operationType);
    
    /// <summary>
    /// Aylık kredi yüklemesi gereken kullanıcıları işler
    /// </summary>
    Task ProcessMonthlyRechargesAsync();
}

/// <summary>
/// Kullanıcı kredi özeti
/// </summary>
public class UserCreditSummary
{
    public int CurrentBalance { get; set; }
    public int TotalEarned { get; set; }
    public int TotalSpent { get; set; }
    public DateTime LastRechargeDate { get; set; }
    public DateTime NextRechargeDate { get; set; }
    public string PackageName { get; set; } = string.Empty;
    public int MonthlyCredits { get; set; }
    public int DaysUntilNextRecharge { get; set; }
}

