# 🔄 Migration Talimatları - IsAdmin Field

## Adımlar

### 1. Migration Oluşturma

```bash
cd Backend/HobbyCollection.Infrastructure
dotnet ef migrations add AddIsAdminToUser --startup-project ../HobbyCollection.Api
```

### 2. Migration'ı Uygulama

```bash
dotnet ef database update --startup-project ../HobbyCollection.Api
```

### 3. Admin Kullanıcı Oluşturma

Migration uygulandıktan sonra, bir kullanıcıyı admin yapmak için:

**PostgreSQL:**
```sql
UPDATE "AspNetUsers" 
SET "IsAdmin" = true 
WHERE "Email" = 'admin@save-all.com';
```

**SQLite (Development):**
```sql
UPDATE AspNetUsers 
SET IsAdmin = 1 
WHERE Email = 'admin@save-all.com';
```

### 4. Kontrol

Admin kullanıcının oluşturulduğunu kontrol etmek için:

```sql
SELECT "Id", "Email", "IsAdmin" 
FROM "AspNetUsers" 
WHERE "IsAdmin" = true;
```

## Notlar

- Migration dosyası otomatik oluşturulacak
- `IsAdmin` field'ı default olarak `false` olacak
- Sadece database'de manuel olarak `true` yapılan kullanıcılar admin olacak
- JWT token'da `isAdmin` claim'i bulunacak (frontend için)

