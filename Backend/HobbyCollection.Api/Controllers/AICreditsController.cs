using HobbyCollection.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HobbyCollection.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AICreditsController : ControllerBase
{
    private readonly IAICreditService _creditService;
    private readonly ILogger<AICreditsController> _logger;

    public AICreditsController(IAICreditService creditService, ILogger<AICreditsController> logger)
    {
        _creditService = creditService;
        _logger = logger;
    }

    /// <summary>
    /// Kullanıcının AI kredi bakiyesini getirir
    /// </summary>
    [HttpGet("balance")]
    public async Task<IActionResult> GetBalance()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Kullanıcı kimliği bulunamadı." });
            }

            var balance = await _creditService.GetUserBalanceAsync(userId);
            return Ok(new { balance });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kredi bakiyesi alınırken hata oluştu.");
            return StatusCode(500, new { message = "Kredi bakiyesi alınamadı." });
        }
    }

    /// <summary>
    /// Kullanıcının AI kredi özetini getirir
    /// </summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Kullanıcı kimliği bulunamadı." });
            }

            var summary = await _creditService.GetUserCreditSummaryAsync(userId);
            return Ok(summary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kredi özeti alınırken hata oluştu.");
            return StatusCode(500, new { message = "Kredi özeti alınamadı." });
        }
    }

    /// <summary>
    /// Kullanıcının işlem geçmişini getirir
    /// </summary>
    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Kullanıcı kimliği bulunamadı." });
            }

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 50;

            var (transactions, totalCount) = await _creditService.GetUserTransactionHistoryAsync(userId, page, pageSize);
            
            return Ok(new
            {
                transactions,
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "İşlem geçmişi alınırken hata oluştu.");
            return StatusCode(500, new { message = "İşlem geçmişi alınamadı." });
        }
    }

    /// <summary>
    /// AI işlem maliyetlerini getirir
    /// </summary>
    [HttpGet("operation-costs")]
    public async Task<IActionResult> GetOperationCosts()
    {
        try
        {
            var costs = await _creditService.GetOperationCostsAsync();
            return Ok(costs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "İşlem maliyetleri alınırken hata oluştu.");
            return StatusCode(500, new { message = "İşlem maliyetleri alınamadı." });
        }
    }

    /// <summary>
    /// Belirli bir işlem için yeterli kredi olup olmadığını kontrol eder
    /// </summary>
    [HttpGet("check-sufficient")]
    public async Task<IActionResult> CheckSufficientCredits([FromQuery] string operationType)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Kullanıcı kimliği bulunamadı." });
            }

            if (string.IsNullOrWhiteSpace(operationType))
            {
                return BadRequest(new { message = "İşlem tipi belirtilmelidir." });
            }

            var hasSufficient = await _creditService.HasSufficientCreditsAsync(userId, operationType);
            var balance = await _creditService.GetUserBalanceAsync(userId);
            
            return Ok(new
            {
                hasSufficient,
                currentBalance = balance
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kredi kontrolü yapılırken hata oluştu.");
            return StatusCode(500, new { message = "Kredi kontrolü yapılamadı." });
        }
    }
}

