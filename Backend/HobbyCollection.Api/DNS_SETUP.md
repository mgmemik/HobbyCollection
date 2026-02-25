# 🌐 DNS Ayarları - api.save-all.com

## Google Cloud Run Custom Domain için DNS Kayıtları

### 1. Cloud Run Domain Mapping Oluşturma

Önce Cloud Run'da domain mapping oluşturun:

```bash
gcloud run domain-mappings create \
  --service hobbycollection-api \
  --domain api.save-all.com \
  --region europe-west3
```

Bu komut size bir **verification record** verecek.

### 2. DNS Kayıtları (save-all.com Domain'inizde)

Domain sağlayıcınızın DNS panelinde şu kayıtları ekleyin:

#### A) Verification Record (TXT)

```
Type: TXT
Name: api
Value: google-site-verification=ABC123XYZ... (Cloud Run'dan aldığınız değer)
TTL: 3600 (veya otomatik)
```

**ÖNEMLİ:** 
- Eğer `api.save-all.com` için kayıt ekliyorsanız, `Name` alanına sadece `api` yazın
- Root domain için (`save-all.com`) `@` veya boş bırakın

#### B) CNAME Record

```
Type: CNAME
Name: api
Value: ghs.googlehosted.com
TTL: 3600 (veya otomatik)
```

**ÖNEMLİ:**
- `Name`: `api` (subdomain için)
- `Value`: `ghs.googlehosted.com` (Google'un hosting servisi)

### 3. DNS Sağlayıcı Örnekleri

#### Cloudflare
1. DNS > Records > Add record
2. Type: `TXT`, Name: `api`, Value: `google-site-verification=...`
3. Type: `CNAME`, Name: `api`, Target: `ghs.googlehosted.com`, Proxy: `DNS only` (⚠️ Proxy kapalı olmalı!)

#### GoDaddy
1. DNS Management > Add
2. Type: `TXT`, Host: `api`, Value: `google-site-verification=...`
3. Type: `CNAME`, Host: `api`, Points to: `ghs.googlehosted.com`

#### Namecheap
1. Advanced DNS > Add New Record
2. Type: `TXT Record`, Host: `api`, Value: `google-site-verification=...`
3. Type: `CNAME Record`, Host: `api`, Value: `ghs.googlehosted.com`

#### Google Domains
1. DNS > Custom records
2. Type: `TXT`, Subdomain: `api`, Data: `google-site-verification=...`
3. Type: `CNAME`, Subdomain: `api`, Data: `ghs.googlehosted.com`

### 4. DNS Verification Kontrolü

Kayıtları ekledikten sonra birkaç dakika bekleyin ve kontrol edin:

```bash
# TXT kaydını kontrol et
dig api.save-all.com TXT +short

# CNAME kaydını kontrol et
dig api.save-all.com CNAME +short

# Cloud Run domain mapping durumunu kontrol et
gcloud run domain-mappings describe api.save-all.com --region europe-west3
```

**Beklenen Çıktı:**
```
TXT kaydı: "google-site-verification=ABC123XYZ..."
CNAME kaydı: ghs.googlehosted.com.
```

### 5. Verification Süreci

1. **DNS kayıtlarını ekleyin** (yukarıdaki adımlar)
2. **5-10 dakika bekleyin** (DNS propagation)
3. **Cloud Run otomatik olarak verify edecek**
4. **Status kontrol edin:**

```bash
gcloud run domain-mappings describe api.save-all.com --region europe-west3
```

**Başarılı durum:**
```
status:
  conditions:
  - status: 'True'
    type: Ready
  observedGeneration: 1
  resourceRecords:
  - name: api.save-all.com
    rrdata: ghs.googlehosted.com.
    type: CNAME
```

### 6. SSL Sertifikası

Cloud Run **otomatik olarak SSL sertifikası** sağlar:
- Let's Encrypt sertifikası otomatik oluşturulur
- HTTPS otomatik aktif olur
- Sertifika otomatik yenilenir

### 7. Troubleshooting

#### Problem: "Domain verification failed"

**Çözüm:**
- DNS kayıtlarının doğru eklendiğinden emin olun
- TTL süresini bekleyin (5-10 dakika)
- `dig` komutu ile DNS kayıtlarını kontrol edin

#### Problem: "CNAME conflict"

**Çözüm:**
- Başka bir CNAME kaydı varsa kaldırın
- A record varsa kaldırın (CNAME ile çakışır)

#### Problem: "DNS propagation taking too long"

**Çözüm:**
- TTL değerini düşürün (300 saniye)
- Farklı DNS sunucularından kontrol edin:
  ```bash
  dig @8.8.8.8 api.save-all.com CNAME
  dig @1.1.1.1 api.save-all.com CNAME
  ```

### 8. Test

DNS ayarları tamamlandıktan sonra:

```bash
# HTTPS testi
curl -I https://api.save-all.com/api/health

# SSL sertifikası kontrolü
openssl s_client -connect api.save-all.com:443 -servername api.save-all.com
```

### 9. Önemli Notlar

⚠️ **Cloudflare Proxy:** Eğer Cloudflare kullanıyorsanız, CNAME kaydı için **Proxy kapalı** olmalı (DNS only). Aksi halde SSL sertifikası oluşturulamaz.

⚠️ **Root Domain:** Eğer `save-all.com` (root domain) için mapping yapmak istiyorsanız, Cloud Run yerine **Cloud Load Balancer** kullanmanız gerekir.

⚠️ **Wildcard:** `*.save-all.com` için wildcard mapping yapamazsınız, her subdomain için ayrı mapping gerekir.

### 10. Son Kontrol

```bash
# Domain mapping listesi
gcloud run domain-mappings list --region europe-west3

# Service URL
gcloud run services describe hobbycollection-api --region europe-west3 --format 'value(status.url)'

# Custom domain URL
echo "https://api.save-all.com"
```

## ✅ Başarı Kriterleri

- [ ] TXT kaydı eklendi ve verify edildi
- [ ] CNAME kaydı eklendi ve çözümleniyor
- [ ] Cloud Run domain mapping "Ready" durumunda
- [ ] HTTPS çalışıyor (SSL sertifikası aktif)
- [ ] API endpoint'leri erişilebilir

## 📞 Destek

Sorun yaşarsanız:
1. Cloud Run logs kontrol edin
2. DNS kayıtlarını tekrar kontrol edin
3. Google Cloud Support'a başvurun

