# 🔒 SSL Sertifikası Sorun Giderme

## 📊 Mevcut Durum

DNS kayıtları doğru yapılandırılmış ancak SSL sertifikaları henüz oluşturulmamış.

## ⏱️ SSL Sertifikası Oluşturma Süreci

Google Cloud Run SSL sertifikaları **otomatik olarak** oluşturulur, ancak bu işlem:

1. **DNS kayıtlarının doğru yapılandırıldığını doğrular**
2. **Let's Encrypt veya Google'ın sertifika sağlayıcısı ile sertifika oluşturur**
3. **5-15 dakika sürebilir** (bazen 30 dakikaya kadar)

## 🔍 Kontrol Adımları

### 1. DNS Kayıtlarını Doğrula

```bash
# Root domain A Records
dig @8.8.8.8 save-all.com A +short
# Beklenen: 4 IP adresi (216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21)

# www CNAME
dig @8.8.8.8 www.save-all.com CNAME +short
# Beklenen: ghs.googlehosted.com.
```

### 2. Domain Mapping Durumunu Kontrol Et

```bash
gcloud beta run domain-mappings list \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7 \
  --format="table(name,status.conditions[0].status,status.conditions[0].message)"
```

**Durumlar:**
- `True` = SSL aktif ✅
- `Unknown` = SSL oluşturuluyor ⏳
- `False` = Hata ❌

### 3. SSL Sertifikasını Test Et

```bash
# www subdomain
curl -I https://www.save-all.com

# Root domain
curl -I https://save-all.com
```

## 🔧 Çözüm Yöntemleri

### Yöntem 1: Bekleme (Önerilen)

SSL sertifikası oluşturma işlemi genellikle **5-15 dakika** içinde tamamlanır. DNS kayıtları doğruysa, sadece beklemek yeterlidir.

### Yöntem 2: Domain Mapping'i Yeniden Oluştur

Eğer 30 dakikadan fazla beklediyseniz:

```bash
# Önce mevcut mapping'i sil
gcloud beta run domain-mappings delete save-all.com \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7

gcloud beta run domain-mappings delete www.save-all.com \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7

# Sonra yeniden oluştur
gcloud beta run domain-mappings create \
  --service save-all-web \
  --domain save-all.com \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7

gcloud beta run domain-mappings create \
  --service save-all-web \
  --domain www.save-all.com \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7
```

### Yöntem 3: Google Cloud Console'dan Kontrol

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
   ```

2. **Domain mapping'leri kontrol edin:**
   - `save-all.com` ve `www.save-all.com` için durumu görün
   - "Certificate provisioning" mesajı görüyorsanız, bekleyin

3. **Manuel olarak yeniden deneyin:**
   - Domain mapping'in yanındaki "⋮" menüsünden "Refresh" seçeneğini kullanın

## ⚠️ Yaygın Sorunlar

### Problem 1: "Waiting for certificate provisioning"

**Neden:** DNS kayıtları henüz Google Cloud tarafından görülmüyor olabilir.

**Çözüm:**
- DNS kayıtlarının doğru olduğundan emin olun
- 10-15 dakika daha bekleyin
- Farklı DNS sunucularından test edin (8.8.8.8, 1.1.1.1)

### Problem 2: DNS kayıtları doğru ama SSL oluşmuyor

**Neden:** Google Cloud'un DNS kayıtlarını görmesi zaman alabilir.

**Çözüm:**
- Domain mapping'i silip yeniden oluşturun (Yöntem 2)
- Google Cloud Console'dan manuel olarak refresh edin

### Problem 3: SSL sertifikası oluştu ama site açılmıyor

**Neden:** Cloud Run servisi çalışmıyor olabilir.

**Çözüm:**
```bash
# Cloud Run servisini kontrol et
gcloud run services describe save-all-web \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7 \
  --format="value(status.conditions[0].status)"

# Logları kontrol et
gcloud run services logs read save-all-web \
  --region europe-west1 \
  --project fresh-inscriber-472521-t7 \
  --limit=50
```

## ✅ Başarı Kriterleri

SSL sertifikası başarıyla oluşturulduğunda:

1. ✅ Domain mapping durumu `True` olur
2. ✅ `curl -I https://www.save-all.com` başarılı yanıt döner
3. ✅ `curl -I https://save-all.com` www'ye yönlendirir
4. ✅ Tarayıcıda kilit ikonu yeşil görünür
5. ✅ SSL sertifikası geçerli (süresi dolmamış)

## 📞 Sonraki Adımlar

1. **10-15 dakika bekleyin** (SSL sertifikası oluşturulması için)
2. **Durumu kontrol edin:**
   ```bash
   gcloud beta run domain-mappings list \
     --region europe-west1 \
     --project fresh-inscriber-472521-t7
   ```
3. **Test edin:**
   ```bash
   curl -I https://www.save-all.com
   curl -I https://save-all.com
   ```

Eğer 30 dakika sonra hala SSL sertifikası oluşmadıysa, domain mapping'leri yeniden oluşturmayı deneyin.
