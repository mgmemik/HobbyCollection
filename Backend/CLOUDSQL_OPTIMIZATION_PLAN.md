# 🚀 Cloud SQL PostgreSQL Optimizasyon Planı

## 📊 Mevcut Durum Analizi

### ✅ İyi Haberler
- **Tier:** db-f1-micro (zaten en küçük ve en ucuz paket)
- **Aylık Maliyet:** ~$7-8 (~₺250-280/ay) ✅
- **Disk Boyutu:** 10 GB (limit dahilinde)
- **Backup:** Otomatik backup aktif ve başarılı ✅
- **Durum:** RUNNABLE (çalışıyor)

### ⚠️ Optimizasyon Gerekenler

1. **Connection Pool:** 100 → 10 (db-f1-micro için optimize)
2. **Database Boyutu:** Kontrol edilmeli
3. **Query Optimizasyonu:** Gerekebilir

## 🔧 Yapılan Optimizasyonlar

### 1. Connection Pool Optimizasyonu ✅

**Değişiklik:**
- **Önceki:** `Maximum Pool Size=100`
- **Yeni:** `Maximum Pool Size=10`

**Neden?**
- db-f1-micro sadece 0.6 GB RAM'e sahip
- 100 connection çok fazla memory kullanır
- 10 connection küçük-orta trafik için yeterli
- Memory pressure'i azaltır

**Etki:**
- ✅ Daha stabil performans
- ✅ Daha az memory kullanımı
- ✅ Connection timeout'ları azalır
- ⚠️ Yüksek trafikte connection limit'e ulaşılabilir (bu durumda upgrade gerekir)

### 2. Backup Durumu ✅

- Otomatik backup aktif
- Son backup: Başarılı
- Backup window: 03:00 UTC

## 📈 Performans İzleme

### İzlenecek Metrikler

1. **Connection Sayısı**
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

2. **Memory Kullanımı**
   - Cloud Console'da monitoring
   - CPU kullanımı
   - RAM kullanımı

3. **Query Performansı**
   - Yavaş query'leri tespit et
   - Index kullanımını kontrol et

4. **Error Rate**
   - Connection timeout'ları
   - Query timeout'ları
   - Memory pressure hataları

## 🔍 Database Boyutu Kontrolü

Database boyutunu kontrol etmek için:

```bash
export CLOUDSQL_PASSWORD=$(gcloud secrets versions access latest --secret="database-password" --project fresh-inscriber-472521-t7)

gcloud sql connect hobbycollection-db \
  --user=postgres \
  --database=hobbycollection \
  --project=fresh-inscriber-472521-t7 <<EOF

-- Database boyutu
SELECT pg_size_pretty(pg_database_size('hobbycollection')) AS database_size;

-- Tablo boyutları
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 20;

EOF
```

## 💡 Ek Optimizasyon Önerileri

### 1. Eski Verileri Temizle

```sql
-- Eski log kayıtlarını temizle (90 günden eski)
DELETE FROM "AnalysisLogs" WHERE "CreatedAt" < NOW() - INTERVAL '90 days';

-- VACUUM yap (disk alanını geri kazan)
VACUUM FULL;
```

### 2. Index Optimizasyonu

```sql
-- Kullanılmayan index'leri bul
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 3. Query Optimizasyonu

- N+1 query sorunlarını önle
- Pagination kullan
- Gereksiz JOIN'leri kaldır
- Cache mekanizması ekle

## ⚠️ Ne Zaman Upgrade Gerekir?

db-f1-micro yetersiz kalırsa:

### İşaretler:
- Connection limit'e sürekli ulaşılıyor
- Query'ler çok yavaş (> 1 saniye)
- Memory pressure hataları
- CPU sürekli %80+ kullanımda

### Upgrade Seçenekleri:
1. **db-g1-small:** ~$25/ay (1 shared-core, 1.7 GB RAM)
2. **db-e2-micro:** ~$9-10/ay (0.5-1 shared-core, 1 GB RAM)

## 📊 Maliyet Karşılaştırması

| Tier | Aylık Maliyet | vCPU | RAM | Durum |
|------|---------------|------|-----|-------|
| **db-f1-micro** | **~$7-8** | 0.5 shared | 0.6 GB | ✅ **Mevcut** |
| db-e2-micro | ~$9-10 | 0.5-1 shared | 1 GB | Upgrade seçeneği |
| db-g1-small | ~$25 | 1 shared | 1.7 GB | Yüksek trafik için |

## ✅ Optimizasyon Checklist

- [x] Mevcut tier kontrol edildi (db-f1-micro)
- [x] Connection pool optimize edildi (100 → 10)
- [x] Backup durumu kontrol edildi (aktif)
- [ ] Database boyutu kontrol edildi
- [ ] Performans testleri yapıldı
- [ ] 24 saat monitoring yapıldı

## 🚀 Sonraki Adımlar

1. **Deploy:** Connection pool değişikliğini deploy et
2. **Monitor:** 24 saat performansı izle
3. **Test:** Yüksek trafik senaryolarını test et
4. **Optimize:** Gerekirse query optimizasyonu yap

## 📝 Notlar

- Connection pool değişikliği hemen etkili olacak
- Eğer connection limit'e ulaşılırsa, `Maximum Pool Size=20`'ye çıkarılabilir
- Performans sorunları devam ederse, db-e2-micro veya db-g1-small'a upgrade yapılabilir
- Mevcut maliyet zaten optimize edilmiş durumda (~$7-8/ay)



