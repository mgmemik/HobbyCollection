# 🌐 DNS Kayıtları - api.save-all.com

## ✅ Domain Mapping Oluşturuldu!

Domain mapping başarıyla oluşturuldu. Şimdi domain sağlayıcınızda (save-all.com) şu DNS kayıtlarını eklemeniz gerekiyor:

---

## 📋 EKLENMESİ GEREKEN DNS KAYITLARI

### A Records (IPv4)

Domain sağlayıcınızın DNS panelinde şu **4 adet A kaydı** ekleyin:

```
Type: A
Name: api
Value: 216.239.32.21
TTL: 3600 (veya otomatik)

Type: A
Name: api
Value: 216.239.34.21
TTL: 3600

Type: A
Name: api
Value: 216.239.36.21
TTL: 3600

Type: A
Name: api
Value: 216.239.38.21
TTL: 3600
```

### AAAA Records (IPv6) - Opsiyonel ama önerilir

IPv6 desteği için şu **4 adet AAAA kaydı** ekleyin:

```
Type: AAAA
Name: api
Value: 2001:4860:4802:32::15
TTL: 3600

Type: AAAA
Name: api
Value: 2001:4860:4802:34::15
TTL: 3600

Type: AAAA
Name: api
Value: 2001:4860:4802:36::15
TTL: 3600

Type: AAAA
Name: api
Value: 2001:4860:4802:38::15
TTL: 3600
```

---

## 🔧 Domain Sağlayıcı Örnekleri

### Cloudflare

1. **DNS** > **Records** > **Add record**
2. Her A kaydı için:
   - **Type:** `A`
   - **Name:** `api`
   - **IPv4 address:** `216.239.32.21` (sonra diğerleri: 34.21, 36.21, 38.21)
   - **Proxy status:** ⚠️ **DNS only** (Proxy KAPALI olmalı!)
   - **TTL:** `Auto` veya `3600`
3. Her AAAA kaydı için:
   - **Type:** `AAAA`
   - **Name:** `api`
   - **IPv6 address:** `2001:4860:4802:32::15` (sonra diğerleri)
   - **Proxy status:** ⚠️ **DNS only** (Proxy KAPALI olmalı!)

**⚠️ ÖNEMLİ:** Cloudflare'de Proxy **KAPALI** olmalı, aksi halde SSL sertifikası oluşturulamaz!

### GoDaddy

1. **DNS Management** > **Add**
2. Her kayıt için:
   - **Type:** `A` veya `AAAA`
   - **Host:** `api`
   - **Points to:** IP adresi (A için) veya IPv6 adresi (AAAA için)
   - **TTL:** `1 Hour`

### Namecheap

1. **Advanced DNS** > **Add New Record**
2. Her kayıt için:
   - **Type:** `A Record` veya `AAAA Record`
   - **Host:** `api`
   - **Value:** IP adresi
   - **TTL:** `Automatic`

### Google Domains

1. **DNS** > **Custom records**
2. Her kayıt için:
   - **Type:** `A` veya `AAAA`
   - **Subdomain:** `api`
   - **Data:** IP adresi

---

## ✅ DNS Kayıtlarını Kontrol Etme

Kayıtları ekledikten sonra **5-10 dakika** bekleyin ve kontrol edin:

```bash
# A kayıtlarını kontrol et
dig api.save-all.com A +short

# AAAA kayıtlarını kontrol et
dig api.save-all.com AAAA +short
```

**Beklenen Çıktı:**
```
216.239.32.21
216.239.34.21
216.239.36.21
216.239.38.21
```

---

## 🔍 Domain Mapping Durumunu Kontrol Etme

```bash
# Domain mapping durumu
gcloud beta run domain-mappings describe api.save-all.com --region=europe-west1

# Service URL
gcloud run services describe hobbycollection-api --region europe-west1 --format='value(status.url)'
```

---

## 🎉 SSL Sertifikası

DNS kayıtları eklendikten sonra:

1. **5-10 dakika bekleyin** (DNS propagation)
2. Cloud Run **otomatik olarak SSL sertifikası** oluşturur (Let's Encrypt)
3. **Test edin:** `curl https://api.save-all.com/api/health`

---

## ⚠️ Önemli Notlar

1. **Cloudflare Proxy:** Eğer Cloudflare kullanıyorsanız, **Proxy KAPALI** olmalı (DNS only). Aksi halde SSL sertifikası oluşturulamaz.

2. **DNS Propagation:** DNS değişiklikleri 5-10 dakika sürebilir.

3. **SSL Sertifikası:** Cloud Run otomatik SSL sertifikası oluşturur (5-10 dakika).

4. **Tüm A Kayıtları:** 4 adet A kaydının **hepsini** eklemeniz gerekiyor (load balancing için).

---

## 🆘 Sorun Giderme

### Problem: "Certificate provisioning pending"

**Çözüm:**
- Tüm A kayıtlarının eklendiğinden emin olun (4 adet)
- DNS propagation için 5-10 dakika bekleyin
- Cloudflare kullanıyorsanız Proxy'yi kapatın

### Problem: "DNS records not found"

**Çözüm:**
- `dig api.save-all.com A +short` ile kontrol edin
- Tüm 4 A kaydının göründüğünden emin olun
- TTL süresini bekleyin

---

## 📞 Sonraki Adımlar

1. ✅ DNS kayıtlarını ekleyin (yukarıdaki A ve AAAA kayıtları)
2. ⏳ 5-10 dakika bekleyin (DNS propagation)
3. ✅ Test edin: `curl https://api.save-all.com/api/health`
4. 🎉 Başarılı!

---

## 🔗 Faydalı Linkler

- **Google Cloud Console:** https://console.cloud.google.com/run/domains?project=fresh-inscriber-472521-t7
- **Service URL:** https://hobbycollection-api-w2qvlhkctq-ew.a.run.app
- **Custom Domain:** https://api.save-all.com (DNS kayıtları eklendikten sonra aktif olacak)

