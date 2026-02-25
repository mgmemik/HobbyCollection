# 🔧 Canlı Veritabanında Admin Kullanıcı Güncelleme

## 📋 Durum

`gmemik@gmail.com` kullanıcısını canlı veritabanında admin yapmak gerekiyor.

## ✅ Yöntem 1: Google Cloud Console SQL Editor (Önerilen)

1. **Google Cloud Console'a gidin:**
   ```
   https://console.cloud.google.com/sql/instances/hobbycollection-db/databases?project=fresh-inscriber-472521-t7
   ```

2. **"Query" sekmesine tıklayın**

3. **Aşağıdaki SQL komutunu çalıştırın:**
   ```sql
   UPDATE "AspNetUsers" 
   SET "IsAdmin" = true 
   WHERE "Email" = 'gmemik@gmail.com';
   ```

4. **Kontrol için:**
   ```sql
   SELECT "Email", "IsAdmin" 
   FROM "AspNetUsers" 
   WHERE "Email" = 'gmemik@gmail.com';
   ```

## ✅ Yöntem 2: Cloud SQL Proxy ile (Local)

### Adım 1: Cloud SQL Proxy Kurulumu

```bash
# macOS
brew install cloud-sql-proxy

# veya direkt indirin
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
```

### Adım 2: Proxy Başlatma

```bash
export GOOGLE_CLOUD_PROJECT=fresh-inscriber-472521-t7
cloud-sql-proxy fresh-inscriber-472521-t7:europe-west1:hobbycollection-db
```

### Adım 3: Başka bir terminal'de psql ile bağlanma

```bash
psql -h 127.0.0.1 -U postgres -d hobbycollection

# Şifre: Secret Manager'dan alınacak
```

### Adım 4: SQL Komutunu Çalıştırma

```sql
UPDATE "AspNetUsers" 
SET "IsAdmin" = true 
WHERE "Email" = 'gmemik@gmail.com';

SELECT "Email", "IsAdmin" 
FROM "AspNetUsers" 
WHERE "Email" = 'gmemik@gmail.com';
```

## ✅ Yöntem 3: Backend API Üzerinden (Mevcut Admin Gerekli)

Eğer zaten bir admin kullanıcı varsa:

```bash
# Admin token ile
curl -X PUT https://api.save-all.com/api/admin/users/{userId} \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"isAdmin": true}'
```

## 🔍 Kontrol

Admin kullanıcının güncellendiğini kontrol etmek için:

```sql
SELECT "Id", "Email", "IsAdmin" 
FROM "AspNetUsers" 
WHERE "IsAdmin" = true;
```

## ⚠️ Önemli Notlar

1. **Veri Güvenliği:** SQL komutunu çalıştırmadan önce backup alınması önerilir
2. **JWT Token:** Kullanıcı yeni bir token alana kadar eski token'da `isAdmin` claim'i olmayabilir
3. **Cache:** Backend'de cache varsa temizlenmesi gerekebilir
