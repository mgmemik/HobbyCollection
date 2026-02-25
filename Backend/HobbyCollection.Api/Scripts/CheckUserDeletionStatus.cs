// Bu script bir kullanıcının neden silinmediğini kontrol eder
// Kullanım: Program.cs'de veya bir controller'da çağrılabilir

using HobbyCollection.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Scripts;

public static class CheckUserDeletionStatus
{
    public static async Task<string> CheckUserAsync(
        AppDbContext db,
        UserManager<ApplicationUser> userManager,
        string email,
        ILogger logger)
    {
        var user = await db.Users
            .OfType<ApplicationUser>()
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return $"❌ Kullanıcı bulunamadı: {email}";
        }

        var now = DateTime.UtcNow;
        var cutoffDate = now.AddHours(-24);
        var age = now - user.CreatedAt;
        var isOlderThan24Hours = user.CreatedAt < cutoffDate;

        var reasons = new List<string>();
        var status = new List<string>();

        status.Add($"📧 Email: {user.Email}");
        status.Add($"🆔 UserId: {user.Id}");
        status.Add($"📅 CreatedAt: {user.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC");
        status.Add($"⏰ Yaş: {age.TotalHours:F2} saat ({age.TotalDays:F2} gün)");
        status.Add($"✅ EmailConfirmed: {user.EmailConfirmed}");
        status.Add($"🔍 24 saatten eski mi: {isOlderThan24Hours}");

        // Silinme kriterlerini kontrol et
        if (user.EmailConfirmed)
        {
            reasons.Add("❌ EmailConfirmed = true (Email onaylanmış, bu yüzden silinmez)");
        }

        if (!isOlderThan24Hours)
        {
            reasons.Add($"❌ CreatedAt ({user.CreatedAt:yyyy-MM-dd HH:mm:ss}) < cutoffDate ({cutoffDate:yyyy-MM-dd HH:mm:ss}) değil (Son 24 saat içinde oluşturulmuş, bu yüzden silinmez)");
        }

        // İlişkili verileri kontrol et
        var hasProducts = await db.Products.AnyAsync(p => p.UserId == user.Id);
        var hasComments = await db.Comments.AnyAsync(c => c.UserId == user.Id);
        var hasLikes = await db.ProductLikes.AnyAsync(pl => pl.UserId == user.Id);
        var hasSaves = await db.ProductSaves.AnyAsync(ps => ps.UserId == user.Id);
        var hasFollows = await db.Follows.AnyAsync(f => f.FollowerId == user.Id || f.FollowingId == user.Id);
        var hasConversations = await db.Conversations.AnyAsync(c => c.User1Id == user.Id || c.User2Id == user.Id);
        var hasMessages = await db.Messages.AnyAsync(m => m.SenderId == user.Id || m.ReceiverId == user.Id);

        status.Add($"");
        status.Add($"📊 İlişkili Veriler:");
        status.Add($"  - Ürünler: {hasProducts}");
        status.Add($"  - Yorumlar: {hasComments}");
        status.Add($"  - Beğeniler: {hasLikes}");
        status.Add($"  - Kaydedilenler: {hasSaves}");
        status.Add($"  - Takip/Takipçi: {hasFollows}");
        status.Add($"  - Konuşmalar: {hasConversations}");
        status.Add($"  - Mesajlar: {hasMessages}");

        // Silinme kriterlerine uyuyor mu?
        var shouldBeDeleted = !user.EmailConfirmed && isOlderThan24Hours;
        
        status.Add($"");
        if (shouldBeDeleted)
        {
            status.Add($"✅ SİLİNME KRİTERLERİNE UYUYOR");
            status.Add($"   (EmailConfirmed=false ve CreatedAt < 24 saat)");
            
            if (reasons.Any())
            {
                status.Add($"");
                status.Add($"⚠️ Ancak şu nedenlerle silinmemiş olabilir:");
                status.AddRange(reasons);
            }
            else
            {
                status.Add($"");
                status.Add($"⚠️ Service henüz çalışmamış olabilir veya silme işlemi başarısız olmuş olabilir.");
                status.Add($"   Service her 24 saatte bir çalışır. Son çalışma zamanını loglardan kontrol edin.");
            }
        }
        else
        {
            status.Add($"❌ SİLİNME KRİTERLERİNE UYMUYOR");
            status.Add($"");
            status.Add($"📋 Nedenler:");
            status.AddRange(reasons);
        }

        return string.Join("\n", status);
    }
}
