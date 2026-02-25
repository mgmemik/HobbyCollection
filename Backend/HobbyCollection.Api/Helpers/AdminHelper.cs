using System.Security.Claims;
using HobbyCollection.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HobbyCollection.Api.Helpers;

/// <summary>
/// Admin yetkilendirme kontrolü için helper metodlar
/// </summary>
public static class AdminHelper
{
    /// <summary>
    /// Kullanıcının admin olup olmadığını kontrol eder (async)
    /// </summary>
    public static async Task<bool> IsAdminAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return false;
        
        var appUser = await db.Users.FindAsync(userId);
        return appUser?.IsAdmin == true;
    }
    
    /// <summary>
    /// Kullanıcının admin olup olmadığını kontrol eder (sync)
    /// </summary>
    public static bool IsAdmin(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return false;
        
        var appUser = db.Users.Find(userId);
        return appUser?.IsAdmin == true;
    }
}

