using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HobbyCollection.Infrastructure;

namespace HobbyCollection.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DatabaseStatsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DatabaseStatsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("verify")]
    public async Task<IActionResult> VerifyDatabase()
    {
        try
        {
            // Kullanıcı sayıları
            var totalUsers = await _db.Users.CountAsync();
            
            // IsWebProfilePublic kolonu var mı kontrol et
            var hasWebProfileColumn = false;
            try
            {
                var result = await _db.Database.ExecuteSqlRawAsync(@"
                    SELECT COUNT(*) 
                    FROM information_schema.columns 
                    WHERE table_name = 'AspNetUsers' 
                    AND column_name = 'IsWebProfilePublic';
                ");
                hasWebProfileColumn = true; // Eğer hata yoksa kolon var
            }
            catch
            {
                hasWebProfileColumn = false;
            }
            
            // Alternatif: Direkt test et
            try
            {
                var testCount = await _db.Users.OfType<ApplicationUser>()
                    .Where(u => u.IsWebProfilePublic == false)
                    .CountAsync();
                hasWebProfileColumn = true;
            }
            catch
            {
                hasWebProfileColumn = false;
            }
            
            int usersWithWebProfilePublic = 0;
            int usersWithWebProfilePrivate = 0;
            
            if (hasWebProfileColumn)
            {
                usersWithWebProfilePublic = await _db.Users
                    .OfType<ApplicationUser>()
                    .Where(u => u.IsWebProfilePublic == true)
                    .CountAsync();
                usersWithWebProfilePrivate = await _db.Users
                    .OfType<ApplicationUser>()
                    .Where(u => u.IsWebProfilePublic == false)
                    .CountAsync();
            }

            // Ürün sayıları
            var totalProducts = await _db.Products.CountAsync();
            var publicProducts = await _db.Products
                .Where(p => p.IsPublic == true)
                .CountAsync();
            var privateProducts = await _db.Products
                .Where(p => p.IsPublic == false)
                .CountAsync();

            // Ürün sahipleri
            var productUserIds = await _db.Products
                .Where(p => p.IsPublic == true)
                .Select(p => p.UserId)
                .Distinct()
                .CountAsync();

            int productsFromWebPublicUsers = 0;
            int productsFromWebPrivateUsers = 0;
            
            if (hasWebProfileColumn)
            {
                // Web profili açık olan kullanıcıların ürün sayısı
                productsFromWebPublicUsers = await _db.Products
                    .Where(p => p.IsPublic == true)
                    .Join(_db.Users.OfType<ApplicationUser>(),
                        p => p.UserId,
                        u => u.Id,
                        (p, u) => new { Product = p, User = u })
                    .Where(x => x.User.IsWebProfilePublic == true)
                    .CountAsync();

                // Web profili kapalı olan kullanıcıların ürün sayısı
                productsFromWebPrivateUsers = await _db.Products
                    .Where(p => p.IsPublic == true)
                    .Join(_db.Users.OfType<ApplicationUser>(),
                        p => p.UserId,
                        u => u.Id,
                        (p, u) => new { Product = p, User = u })
                    .Where(x => x.User.IsWebProfilePublic == false)
                    .CountAsync();
            }

            return Ok(new
            {
                users = new
                {
                    total = totalUsers,
                    webProfilePublic = usersWithWebProfilePublic,
                    webProfilePrivate = usersWithWebProfilePrivate,
                    hasWebProfileColumn = hasWebProfileColumn
                },
                products = new
                {
                    total = totalProducts,
                    publicCount = publicProducts,
                    privateCount = privateProducts,
                    uniqueOwners = productUserIds,
                    fromWebPublicUsers = productsFromWebPublicUsers,
                    fromWebPrivateUsers = productsFromWebPrivateUsers
                },
                message = "Database verification completed"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
        }
    }
}
