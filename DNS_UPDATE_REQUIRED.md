# ⚠️ DNS KAYDI GÜNCELLEMESİ GEREKLİ

## ✅ Durum

Domain mapping başarıyla oluşturuldu! Ancak GoDaddy'deki CNAME kaydını güncellemeniz gerekiyor.

---

## 📋 GoDaddy'de Yapılacaklar

### Adım 1: GoDaddy DNS Ayarlarına Gidin

1. https://www.godaddy.com adresine gidin
2. Hesabınıza giriş yapın
3. "My Products" → "Domains" → **save-all.com** → **"DNS"** sekmesine gidin

### Adım 2: Eski CNAME Kaydını Bulun ve Silin

1. **Mevcut CNAME kaydını bulun:**
   ```
   Name: backoffice
   Value: backoffice-admin-w2qvlhkctq-ew.a.run.app
   ```

2. Bu kaydı **SİLİN** veya **DÜZENLEYİN**

### Adım 3: Yeni CNAME Kaydı Ekleyin

1. **"Add"** butonuna tıklayın
2. Aşağıdaki bilgileri girin:

```
┌─────────────────────────────────────────────────────────────┐
│ Type:    CNAME                                               │
│ Name:    backoffice                                          │
│ Value:   ghs.googlehosted.com.                               │
│ TTL:     600 (10 dakika)                                    │
└─────────────────────────────────────────────────────────────┘
```

**ÖNEMLİ:** `ghs.googlehosted.com.` sonunda nokta (.) var!

3. **"Save"** butonuna tıklayın

---

## ⏳ Sonraki Adımlar

### DNS Kaydı Güncellendikten Sonra:

1. **DNS Propagation:** 5-10 dakika bekleyin

2. **SSL Sertifikası:** Google Cloud otomatik olarak SSL sertifikası oluşturur (10-15 dakika)

3. **Test:** 
   ```bash
   curl -I https://backoffice.save-all.com
   ```
   
   SSL sertifikası hazır olduğunda `200 OK` döner.

---

## 🔍 Durum Kontrolü

### DNS Kaydını Kontrol Et:

```bash
dig backoffice.save-all.com CNAME
```

Beklenen sonuç:
```
backoffice.save-all.com. 600 IN CNAME ghs.googlehosted.com.
```

### SSL Sertifikası Durumu:

```bash
curl -I https://backoffice.save-all.com
```

### Domain Mapping Durumu:

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
gcloud beta run domain-mappings list --region=europe-west1
```

---

## ⚠️ Önemli Notlar

1. **Eski CNAME Kaydı:** `backoffice-admin-w2qvlhkctq-ew.a.run.app` artık kullanılmıyor, silinmeli.

2. **Yeni CNAME Kaydı:** `ghs.googlehosted.com.` Google Cloud'un managed domain mapping için gereklidir.

3. **SSL Sertifikası:** DNS kaydı güncellendikten sonra Google Cloud otomatik olarak SSL sertifikası oluşturur.

4. **Bekleme Süresi:** DNS propagation (5-10 dakika) + SSL sertifikası oluşturma (10-15 dakika) = Toplam ~20 dakika

---

## 📞 Sorun Giderme

### DNS Kaydı Güncellenmedi:

1. GoDaddy'de kaydın doğru olduğundan emin olun
2. Birkaç dakika bekleyin (DNS propagation)
3. Farklı DNS sunucularından kontrol edin:
   ```bash
   dig @8.8.8.8 backoffice.save-all.com CNAME
   dig @1.1.1.1 backoffice.save-all.com CNAME
   ```

### SSL Sertifikası Oluşmazsa:

1. DNS kaydının doğru olduğunu kontrol edin
2. 15-20 dakika bekleyin
3. Google Cloud Console → Cloud Run → Domain Mappings → SSL sertifikası durumunu kontrol edin

