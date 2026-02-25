using System.Text.Json;

namespace HobbyCollection.Api.Services
{
    public interface IExchangeRateService
    {
        Task<decimal?> GetExchangeRateAsync(string fromCurrency, string toCurrency);
    }

    public class ExchangeRateService : IExchangeRateService
    {
        private readonly ILogger<ExchangeRateService> _logger;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly Dictionary<string, (decimal rate, DateTime cachedAt)> _cache = new();
        private readonly TimeSpan _cacheExpiry = TimeSpan.FromHours(1); // 1 saat cache

        public ExchangeRateService(ILogger<ExchangeRateService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(10)
            };
        }

        public async Task<decimal?> GetExchangeRateAsync(string fromCurrency, string toCurrency)
        {
            // Aynı currency ise 1.0 döndür
            if (string.Equals(fromCurrency, toCurrency, StringComparison.OrdinalIgnoreCase))
            {
                return 1.0m;
            }

            // Cache kontrolü
            var cacheKey = $"{fromCurrency}_{toCurrency}";
            if (_cache.TryGetValue(cacheKey, out var cached) && DateTime.UtcNow - cached.cachedAt < _cacheExpiry)
            {
                _logger.LogInformation($"[EXCHANGE] Cache'den döviz kuru alındı: {fromCurrency} -> {toCurrency} = {cached.rate}");
                return cached.rate;
            }

            try
            {
                // exchangerate-api.com kullan (ücretsiz tier: 1500 request/month)
                // Alternatif: fixer.io, currencyapi.net
                var apiKey = _configuration["ExchangeRateApiKey"]; // Opsiyonel API key
                var baseUrl = string.IsNullOrEmpty(apiKey)
                    ? "https://api.exchangerate-api.com/v4/latest"
                    : $"https://v6.exchangerate-api.com/v6/{apiKey}/latest";

                var url = $"{baseUrl}/{fromCurrency.ToUpper()}";
                _logger.LogInformation($"[EXCHANGE] Döviz kuru alınıyor: {url}");

                var response = await _httpClient.GetStringAsync(url);
                var jsonDoc = JsonDocument.Parse(response);
                
                if (jsonDoc.RootElement.TryGetProperty("rates", out var rates))
                {
                    var targetCurrency = toCurrency.ToUpper();
                    if (rates.TryGetProperty(targetCurrency, out var rateElement))
                    {
                        if (rateElement.TryGetDecimal(out var rate))
                        {
                            // Cache'e kaydet
                            _cache[cacheKey] = (rate, DateTime.UtcNow);
                            _logger.LogInformation($"[EXCHANGE] Döviz kuru alındı: {fromCurrency} -> {toCurrency} = {rate}");
                            return rate;
                        }
                    }
                }

                _logger.LogWarning($"[EXCHANGE] Döviz kuru bulunamadı: {fromCurrency} -> {toCurrency}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[EXCHANGE] Döviz kuru alınırken hata: {fromCurrency} -> {toCurrency}");
                return null;
            }
        }
    }
}

