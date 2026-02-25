using HobbyCollection.Domain.Entities;
using HobbyCollection.Domain.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace HobbyCollection.Infrastructure.Repositories;

/// <summary>
/// AI Kredi Repository Implementation
/// </summary>
public class AICreditRepository : IAICreditRepository
{
    private readonly AppDbContext _context;

    public AICreditRepository(AppDbContext context)
    {
        _context = context;
    }

    // Package İşlemleri
    public async Task<AICreditPackage?> GetDefaultPackageAsync()
    {
        return await _context.AICreditPackages
            .FirstOrDefaultAsync(p => p.IsDefault && p.IsActive);
    }

    public async Task<AICreditPackage> EnsureDefaultPackageAsync()
    {
        var defaultPackage = await GetDefaultPackageAsync();
        if (defaultPackage != null)
        {
            return defaultPackage;
        }

        // Default package yoksa oluştur
        var now = DateTime.UtcNow;
        defaultPackage = new AICreditPackage
        {
            Name = "Standard",
            Description = "Aylık 50 AI kredisi içeren standart paket",
            MonthlyCredits = 50,
            Price = 0,
            IsActive = true,
            IsDefault = true,
            CreatedAt = now
        };

        _context.AICreditPackages.Add(defaultPackage);
        await _context.SaveChangesAsync();

        return defaultPackage;
    }

    public async Task<AICreditPackage?> GetPackageByIdAsync(int id)
    {
        return await _context.AICreditPackages
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<AICreditPackage?> GetPackageByMonthlyCreditsAsync(int monthlyCredits)
    {
        return await _context.AICreditPackages
            .FirstOrDefaultAsync(p => p.IsActive && p.MonthlyCredits == monthlyCredits);
    }

    public async Task<List<AICreditPackage>> GetActivePackagesAsync()
    {
        return await _context.AICreditPackages
            .Where(p => p.IsActive)
            .OrderBy(p => p.MonthlyCredits)
            .ToListAsync();
    }

    // User Credit İşlemleri
    public async Task<UserAICredit?> GetUserCreditAsync(string userId)
    {
        return await _context.UserAICredits
            .Include(u => u.Package)
            .FirstOrDefaultAsync(u => u.UserId == userId);
    }

    public async Task<UserAICredit> CreateUserCreditAsync(UserAICredit userCredit)
    {
        _context.UserAICredits.Add(userCredit);
        await _context.SaveChangesAsync();
        
        // Package'ı yükle (navigation property için)
        await _context.Entry(userCredit)
            .Reference(u => u.Package)
            .LoadAsync();
        
        return userCredit;
    }

    public async Task UpdateUserCreditAsync(UserAICredit userCredit)
    {
        userCredit.UpdatedAt = DateTime.UtcNow;
        _context.UserAICredits.Update(userCredit);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Atomic transaction: Kredi güncelleme ve transaction kaydını tek bir database transaction içinde yapar
    /// Transaction içinde SELECT FOR UPDATE ile pessimistic locking kullanır (race condition önleme)
    /// Retry strategy ile uyumlu olması için CreateExecutionStrategy kullanıyoruz
    /// </summary>
    public async Task<AICreditTransaction> SpendCreditsAtomicallyAsync(string userId, string operationType, int creditCost, string? description = null, int? productId = null)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
            try
            {
                // TRANSACTION İÇİNDE SELECT FOR UPDATE ile krediyi al (pessimistic locking)
                // Bu, aynı anda çalışan diğer işlemlerin bekletilmesini sağlar
                // FromSqlRaw ile Include kullanılamaz, bu yüzden Package'ı ayrı yükleyeceğiz
                var userCredit = await _context.UserAICredits
                    .FromSqlRaw(@"SELECT * FROM ""UserAICredits"" WHERE ""UserId"" = {0} FOR UPDATE", userId)
                    .FirstOrDefaultAsync();
                
                // Package'ı ayrı yükle (navigation property için)
                if (userCredit != null)
                {
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                // Kredi yoksa oluştur (transaction içinde)
                if (userCredit == null)
                {
                    var defaultPackage = await EnsureDefaultPackageAsync();
                    var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
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
                    _context.UserAICredits.Add(userCredit);
                    await _context.SaveChangesAsync();
                    // Package'ı yükle
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                // Yetersiz kredi kontrolü
                if (userCredit.CurrentBalance < creditCost)
                {
                    throw new InvalidOperationException($"Yetersiz AI kredisi. Gerekli: {creditCost}, Mevcut: {userCredit.CurrentBalance}");
                }

                // Güncel bakiyeyi kullanarak hesapla
                var balanceBefore = userCredit.CurrentBalance;
                var newBalance = balanceBefore - creditCost;

                // Kredi güncelleme
                userCredit.CurrentBalance = newBalance;
                userCredit.TotalSpent += creditCost;
                userCredit.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);

                // Transaction kaydı oluştur
                var transaction = new AICreditTransaction
                {
                    UserId = userId,
                    TransactionType = TransactionType.Spend,
                    Amount = -creditCost,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = newBalance,
                    OperationType = operationType,
                    Description = description ?? $"{operationType} işlemi",
                    ProductId = productId,
                    IsSuccessful = true,
                    CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc)
                };

                _context.UserAICredits.Update(userCredit);
                _context.AICreditTransactions.Add(transaction);

                // Tek bir SaveChanges ile her ikisini de kaydet
                await _context.SaveChangesAsync();

                // Transaction'ı commit et
                await dbTransaction.CommitAsync();

                return transaction;
            }
            catch
            {
                // Hata durumunda rollback
                try
                {
                    await dbTransaction.RollbackAsync();
                }
                catch
                {
                    // Rollback hatası - ana exception'ı fırlatmaya devam et
                }
                throw;
            }
        });
    }

    /// <summary>
    /// Atomic transaction: Kredi güncelleme ve transaction kaydını tek bir database transaction içinde yapar (Refund için)
    /// Transaction içinde SELECT FOR UPDATE ile pessimistic locking kullanır (race condition önleme)
    /// Retry strategy ile uyumlu olması için CreateExecutionStrategy kullanıyoruz
    /// </summary>
    public async Task<AICreditTransaction> RefundCreditsAtomicallyAsync(string userId, string operationType, int creditCost, string? description = null, int? productId = null)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
            try
            {
                // TRANSACTION İÇİNDE SELECT FOR UPDATE ile krediyi al (pessimistic locking)
                // FromSqlRaw ile Include kullanılamaz, bu yüzden Package'ı ayrı yükleyeceğiz
                var userCredit = await _context.UserAICredits
                    .FromSqlRaw(@"SELECT * FROM ""UserAICredits"" WHERE ""UserId"" = {0} FOR UPDATE", userId)
                    .FirstOrDefaultAsync();
                
                // Package'ı ayrı yükle (navigation property için)
                if (userCredit != null)
                {
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                if (userCredit == null)
                {
                    throw new InvalidOperationException($"Kullanıcı kredi hesabı bulunamadı: {userId}");
                }

                // Güncel bakiyeyi kullanarak hesapla
                var balanceBefore = userCredit.CurrentBalance;
                var newBalance = balanceBefore + creditCost;

                // Kredi güncelleme
                userCredit.CurrentBalance = newBalance;
                userCredit.TotalSpent = Math.Max(0, userCredit.TotalSpent - creditCost); // Negatif olmasın
                userCredit.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);

                // Transaction kaydı oluştur
                var transaction = new AICreditTransaction
                {
                    UserId = userId,
                    TransactionType = TransactionType.Refund,
                    Amount = creditCost,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = newBalance,
                    OperationType = operationType,
                    Description = description ?? $"{operationType} işlemi iadesi",
                    ProductId = productId,
                    IsSuccessful = true,
                    CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc)
                };

                _context.UserAICredits.Update(userCredit);
                _context.AICreditTransactions.Add(transaction);
                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();
                return transaction;
            }
            catch
            {
                try
                {
                    await dbTransaction.RollbackAsync();
                }
                catch { }
                throw;
            }
        });
    }

    /// <summary>
    /// Atomic transaction: Kredi güncelleme ve transaction kaydını tek bir database transaction içinde yapar (Charge için)
    /// Transaction içinde SELECT FOR UPDATE ile pessimistic locking kullanır (race condition önleme)
    /// Retry strategy ile uyumlu olması için CreateExecutionStrategy kullanıyoruz
    /// </summary>
    public async Task<AICreditTransaction> ChargeCreditsAtomicallyAsync(string userId, int amount, string? description = null, DateTime? lastRechargeDate = null, DateTime? nextRechargeDate = null)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
            try
            {
                // TRANSACTION İÇİNDE SELECT FOR UPDATE ile krediyi al (pessimistic locking)
                // FromSqlRaw ile Include kullanılamaz, bu yüzden Package'ı ayrı yükleyeceğiz
                var userCredit = await _context.UserAICredits
                    .FromSqlRaw(@"SELECT * FROM ""UserAICredits"" WHERE ""UserId"" = {0} FOR UPDATE", userId)
                    .FirstOrDefaultAsync();
                
                // Package'ı ayrı yükle (navigation property için)
                if (userCredit != null)
                {
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                // Kredi yoksa oluştur (transaction içinde)
                if (userCredit == null)
                {
                    var defaultPackage = await EnsureDefaultPackageAsync();
                    var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
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
                    _context.UserAICredits.Add(userCredit);
                    await _context.SaveChangesAsync();
                    // Package'ı yükle
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                // Güncel bakiyeyi kullanarak hesapla
                var balanceBefore = userCredit.CurrentBalance;
                var newBalance = balanceBefore + amount;

                // Kredi güncelleme
                userCredit.CurrentBalance = newBalance;
                userCredit.TotalEarned += amount;
                userCredit.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
                
                // Aylık yükleme için tarih güncellemeleri (opsiyonel)
                if (lastRechargeDate.HasValue)
                {
                    userCredit.LastRechargeDate = DateTime.SpecifyKind(lastRechargeDate.Value, DateTimeKind.Utc);
                }
                if (nextRechargeDate.HasValue)
                {
                    userCredit.NextRechargeDate = DateTime.SpecifyKind(nextRechargeDate.Value, DateTimeKind.Utc);
                }

                // Transaction kaydı oluştur
                var transaction = new AICreditTransaction
                {
                    UserId = userId,
                    TransactionType = TransactionType.Charge,
                    Amount = amount,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = newBalance,
                    Description = string.IsNullOrWhiteSpace(description) ? "Manuel kredi yüklemesi" : description.Trim(),
                    IsSuccessful = true,
                    CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc)
                };

                _context.UserAICredits.Update(userCredit);
                _context.AICreditTransactions.Add(transaction);
                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();
                return transaction;
            }
            catch
            {
                try
                {
                    await dbTransaction.RollbackAsync();
                }
                catch { }
                throw;
            }
        });
    }

    /// <summary>
    /// Aylık yenilemede bakiyeyi sıfırlayıp yeni dönem kredisi yükler (replace). Önceki dönem puanları silinir, yeni puan 1 aylık geçerlidir.
    /// </summary>
    public async Task<AICreditTransaction> ChargeCreditsResetAtomicallyAsync(string userId, int newBalance, DateTime lastRechargeDate, DateTime nextRechargeDate, int totalEarnedAdd, string planType, int refreshAmount, string description)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var dbTransaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
            try
            {
                var userCredit = await _context.UserAICredits
                    .FromSqlRaw(@"SELECT * FROM ""UserAICredits"" WHERE ""UserId"" = {0} FOR UPDATE", userId)
                    .FirstOrDefaultAsync();

                if (userCredit != null)
                {
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                if (userCredit == null)
                {
                    var defaultPackage = await EnsureDefaultPackageAsync();
                    var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
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
                    _context.UserAICredits.Add(userCredit);
                    await _context.SaveChangesAsync();
                    await _context.Entry(userCredit).Reference(u => u.Package).LoadAsync();
                }

                var balanceBefore = userCredit.CurrentBalance;
                userCredit.CurrentBalance = newBalance;
                userCredit.TotalEarned += totalEarnedAdd;
                userCredit.LastRechargeDate = DateTime.SpecifyKind(lastRechargeDate, DateTimeKind.Utc);
                userCredit.NextRechargeDate = DateTime.SpecifyKind(nextRechargeDate, DateTimeKind.Utc);
                userCredit.LastPlanType = planType;
                userCredit.LastRefreshAmount = refreshAmount;
                userCredit.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);

                var transaction = new AICreditTransaction
                {
                    UserId = userId,
                    TransactionType = TransactionType.Charge,
                    Amount = newBalance - balanceBefore,
                    BalanceBefore = balanceBefore,
                    BalanceAfter = newBalance,
                    Description = description,
                    IsSuccessful = true,
                    CreatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc)
                };

                _context.UserAICredits.Update(userCredit);
                _context.AICreditTransactions.Add(transaction);
                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();
                return transaction;
            }
            catch
            {
                try { await dbTransaction.RollbackAsync(); }
                catch { }
                throw;
            }
        });
    }

    // Operation Cost İşlemleri
    public async Task<AIOperationCost?> GetOperationCostAsync(string operationType)
    {
        return await _context.AIOperationCosts
            .FirstOrDefaultAsync(o => o.OperationType == operationType && o.IsActive);
    }

    public async Task<List<AIOperationCost>> GetAllOperationCostsAsync()
    {
        return await _context.AIOperationCosts
            .Where(o => o.IsActive)
            .ToListAsync();
    }

    // Transaction İşlemleri
    public async Task<AICreditTransaction> CreateTransactionAsync(AICreditTransaction transaction)
    {
        _context.AICreditTransactions.Add(transaction);
        await _context.SaveChangesAsync();
        return transaction;
    }

    public async Task<List<AICreditTransaction>> GetUserTransactionsAsync(string userId, int skip = 0, int take = 50)
    {
        return await _context.AICreditTransactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync();
    }

    public async Task<int> GetUserTransactionCountAsync(string userId)
    {
        return await _context.AICreditTransactions
            .CountAsync(t => t.UserId == userId);
    }

    // Recharge İşlemleri
    public async Task<List<UserAICredit>> GetUsersNeedingRechargeAsync()
    {
        var now = DateTime.UtcNow;
        return await _context.UserAICredits
            .Include(u => u.Package)
            .Where(u => u.NextRechargeDate <= now)
            .ToListAsync();
    }

    public async Task UpdateNextRechargeDateAsync(string userId, DateTime nextRechargeDate)
    {
        var userCredit = await _context.UserAICredits.FirstOrDefaultAsync(u => u.UserId == userId);
        if (userCredit != null)
        {
            userCredit.NextRechargeDate = DateTime.SpecifyKind(nextRechargeDate, DateTimeKind.Utc);
            userCredit.LastRechargeDate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            userCredit.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            await _context.SaveChangesAsync();
        }
    }
    
    public async Task UpdateAfterMonthlyRechargeAsync(string userId, string planType, int refreshAmount, DateTime nextRechargeDate)
    {
        var userCredit = await _context.UserAICredits.FirstOrDefaultAsync(u => u.UserId == userId);
        if (userCredit != null)
        {
            userCredit.LastPlanType = planType;
            userCredit.LastRefreshAmount = refreshAmount;
            userCredit.NextRechargeDate = DateTime.SpecifyKind(nextRechargeDate, DateTimeKind.Utc);
            userCredit.LastRechargeDate = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            userCredit.UpdatedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            await _context.SaveChangesAsync();
        }
    }
}

