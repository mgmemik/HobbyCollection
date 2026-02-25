using HobbyCollection.Api.Models;
using Microsoft.Extensions.Logging;

namespace HobbyCollection.Api.Services.Analysis
{
    public class HashtagGenerationService : IHashtagGenerationService
    {
        private readonly ILogger<HashtagGenerationService> _logger;

        public HashtagGenerationService(ILogger<HashtagGenerationService> logger)
        {
            _logger = logger;
        }

        public string GenerateEnhancedHashtags(ProductIdentificationResult result, AnalysisDataCollection data)
        {
            var hashtags = new List<string>();

            // Brand'den
            if (!string.IsNullOrEmpty(result.Brand))
            {
                hashtags.Add($"#{result.Brand.Replace(" ", "").ToLower()}");
            }

            // Model'den (kelime kelime)
            if (!string.IsNullOrEmpty(result.Model))
            {
                var modelWords = result.Model.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 2 && !IsCommonWord(w.ToUpper()));
                
                foreach (var word in modelWords.Take(3))
                {
                    hashtags.Add($"#{word.ToLower()}");
                }
            }

            // ProductName'den (kelime kelime, brand/model dışındakiler)
            if (!string.IsNullOrEmpty(result.ProductName))
            {
                var nameWords = result.ProductName.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 2 && !IsCommonWord(w.ToUpper()))
                    .Take(3);
                
                foreach (var word in nameWords)
                {
                    hashtags.Add($"#{word.ToLower()}");
                }
            }

            // Vision API Label'larından (kategori bilgisi)
            var topLabels = data.VisionResults
                .SelectMany(v => v.Labels ?? new List<LabelInfo>())
                .GroupBy(l => l.Description.ToLower())
                .Select(g => new { Label = g.Key, Score = g.Sum(l => l.Score) })
                .OrderByDescending(g => g.Score)
                .Take(5)
                .Select(g => g.Label)
                .Where(l => l.Length > 3)
                .ToList();

            foreach (var label in topLabels)
            {
                hashtags.Add($"#{label.Replace(" ", "")}");
            }

            // WebEntities'den (Google'ın tanıdığı entity'ler)
            var topEntities = data.VisionResults
                .SelectMany(v => v.WebEntities ?? new List<WebEntity>())
                .OrderByDescending(e => e.Score)
                .Take(5)
                .Select(e => e.Description.ToLower().Replace(" ", "").Replace("-", ""))
                .Where(e => e.Length > 3)
                .ToList();

            foreach (var entity in topEntities)
            {
                hashtags.Add($"#{entity}");
            }

            // BestGuess'den (Google'ın en iyi tahmini)
            var bestGuess = data.VisionResults
                .Where(v => !string.IsNullOrEmpty(v.BestGuessLabel))
                .Select(v => v.BestGuessLabel)
                .FirstOrDefault();

            if (!string.IsNullOrEmpty(bestGuess))
            {
                var guessWords = bestGuess.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => w.Length > 2 && !IsCommonWord(w.ToUpper()))
                    .Take(3);

                foreach (var word in guessWords)
                {
                    hashtags.Add($"#{word.ToLower()}");
                }
            }

            // OCR'den önemli kelimeler (ürün türü, özellikler)
            var ocrWords = data.OcrText.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(w => w.ToUpper())
                .Where(w => w.Length >= 4 && w.Length <= 15)
                .Where(w => !IsCommonWord(w))
                .Distinct()
                .Take(2);

            foreach (var word in ocrWords)
            {
                hashtags.Add($"#{word.ToLower()}");
            }

            var uniqueHashtags = hashtags.Distinct().Take(12).ToList();
            _logger.LogInformation($"[HASHTAG] Oluşturulan hashtag'ler: {string.Join(", ", uniqueHashtags)}");
            
            return string.Join(" ", uniqueHashtags);
        }

        private bool IsCommonWord(string word)
        {
            // Yaygın kelimeler (hashtag olarak yorumlanmamalı)
            var commonWords = new[] { "BIT", "THE", "AND", "FOR", "WITH", "FROM", "THIS", "THAT", "BUY", "SELL", "SHOP", "STORE", "ONLINE" };
            return commonWords.Contains(word);
        }
    }
}

