# 🚀 Google Play Console Internal Testing - Android TestFlight Benzeri Sistem

Android'de TestFlight benzeri test dağıtımı için Google Play Console'un **Internal Testing** ve **Closed Testing** track'lerini kullanabilirsiniz.

## 📋 Ön Hazırlık

### 1. Google Play Console Hesabı

- [ ] Google Play Console hesabı oluştur: https://play.google.com/console
- [ ] **Tek seferlik kayıt ücreti:** $25 (bir kerelik, ömür boyu geçerli)
- [ ] Developer hesabı doğrulaması tamamlanmalı

### 2. Google Play Console'da App Oluşturma

**İlk Adımlar:**
- [ ] Google Play Console'a giriş yap
- [ ] "Create app" butonuna tıkla
- [ ] App bilgileri:
  - **App name:** Save All (veya See All)
  - **Default language:** Turkish (veya English)
  - **App or game:** App
  - **Free or paid:** Free
  - **Declarations:** Gerekli onay kutularını işaretle

**Package Name:**
- [ ] Package name: `com.gmemik.saveall` (app.json'da zaten mevcut)
- [ ] Bu package name benzersiz olmalı ve Google Play'de kayıtlı olmamalı

## 🔧 EAS Build ile Android Build Alma

### 1. EAS CLI Kurulumu (Eğer yoksa)

```bash
npm install -g eas-cli
eas login
```

### 2. Android Build Alma

```bash
cd /Users/gokhanmemik/Desktop/HobbyCollection/Mobile

# Production build al
eas build --platform android --profile production

# Veya preview build (test için)
eas build --platform android --profile preview
```

**Build sırasında sorulacaklar:**
- Google Play Console hesabı bağlantısı → EAS otomatik yönetir
- Keystore → EAS otomatik oluşturur ve yönetir (ilk build'de)

### 3. Build'i Google Play Console'a Yükleme

**Seçenek A: Otomatik Yükleme (Önerilen)**

```bash
# Build ve otomatik Google Play Console'a yükleme
eas build --platform android --profile production --auto-submit
```

**Seçenek B: Manuel Yükleme**

1. Build tamamlandıktan sonra EAS dashboard'dan `.aab` dosyasını indir
2. Google Play Console'a git: https://play.google.com/console
3. App'i seç > **Testing** > **Internal testing**
4. **Create new release** butonuna tıkla
5. **Upload** ile `.aab` dosyasını yükle
6. **Release notes** ekle (opsiyonel)
7. **Save** ve **Review release** > **Start rollout to Internal testing**

## 📱 Internal Testing Track Kurulumu

### 1. Internal Testing Grubu Oluşturma

Google Play Console'da:
- [ ] **Testing** > **Internal testing** sekmesine git
- [ ] **Testers** sekmesine git
- [ ] **Create email list** ile test kullanıcıları ekle
  - Email listesi oluştur (örn: "Beta Testers")
  - Test kullanıcılarının email adreslerini ekle
  - **Save changes**

### 2. Test Link'i Paylaşma

- [ ] **Testing** > **Internal testing** > **Testers** sekmesinde
- [ ] **Copy link** butonuna tıkla
- [ ] Bu linki test kullanıcılarına gönder
- [ ] Test kullanıcıları bu link ile uygulamayı indirebilir

**Test Link Formatı:**
```
https://play.google.com/apps/internaltest/[TEST_ID]
```

### 3. Build'i Test Grubuna Atama

- [ ] Build yüklendikten sonra **Internal testing** > **Releases** sekmesine git
- [ ] Yeni release'i seç
- [ ] **Review release** > **Start rollout to Internal testing**
- [ ] Test kullanıcıları artık uygulamayı indirebilir

## 🎯 Closed Testing (Daha Geniş Test Grubu)

Internal Testing'den daha geniş bir test grubu için **Closed Testing** kullanabilirsiniz:

### Farklar:
- **Internal Testing:** En fazla 100 test kullanıcısı, hızlı dağıtım
- **Closed Testing:** Sınırsız test kullanıcısı, daha fazla kontrol

### Closed Testing Kurulumu:
1. **Testing** > **Closed testing** > **Create new track**
2. Track adı ver (örn: "Beta Testers")
3. Test kullanıcıları ekle
4. Build yükle ve release yap

## 📊 Version ve Build Number Yönetimi

### Version Code (Build Number)
- Her build için **mutlaka artırılmalı**
- `app.json`'da `android.versionCode` eklenebilir (opsiyonel)
- EAS otomatik olarak artırır (`autoIncrement: true`)

### Version Name
- `app.json`'da `version: "1.1.0"` mevcut
- Her önemli güncellemede artırılır

### app.json Örneği:
```json
{
  "expo": {
    "version": "1.1.0",
    "android": {
      "package": "com.gmemik.saveall",
      "versionCode": 1  // Her build'de artırılmalı
    }
  }
}
```

## 🔐 Keystore Yönetimi

**EAS otomatik yönetir:**
- İlk build'de otomatik keystore oluşturulur
- Keystore EAS'ta güvenli şekilde saklanır
- Her build için aynı keystore kullanılır
- **ÖNEMLİ:** Keystore'u kaybetmeyin! EAS'ta saklanır ama yedek almak isterseniz:

```bash
# Keystore bilgilerini görüntüle
eas credentials
```

## 🔑 Google Play Service Account (Otomatik Submit İçin)

EAS'ın otomatik olarak Google Play'e yüklemesi için Service Account gerekir:

### 1. Service Account Oluşturma

**Adım 1: Google Cloud Console'a Git**
- Tarayıcıda şu adresi aç: https://console.cloud.google.com
- Google hesabınla giriş yap

**Adım 2: Proje Seç veya Oluştur**
- Üst kısımdaki proje seçici dropdown'a tıkla (varsayılan olarak "My First Project" yazabilir)
- Eğer proje yoksa:
  - **"New Project"** butonuna tıkla
  - Proje adı ver (örn: "Save All App" veya "HobbyCollection")
  - **Create** butonuna tıkla
- Mevcut bir proje varsa, onu seç

**Adım 3: Service Accounts Sayfasına Git**
- Sol taraftaki menüden (☰ hamburger menü) **"IAM & Admin"** seçeneğini bul
- **"IAM & Admin"** üzerine gelince alt menü açılır
- **"Service Accounts"** seçeneğine tıkla
- Eğer sol menüde göremiyorsan:
  - Üstteki arama kutusuna "Service Accounts" yaz
  - "Service Accounts" sonucuna tıkla

**Adım 4: Yeni Service Account Oluştur**
- Sayfanın üst kısmında **"+ CREATE SERVICE ACCOUNT"** butonuna tıkla
- Service account bilgilerini doldur:
  - **Service account name:** `eas-submit` (veya istediğin bir isim)
  - **Service account ID:** Otomatik doldurulur (değiştirmene gerek yok)
  - **Description:** (Opsiyonel) "EAS Build için Google Play otomatik submit"
- **"CREATE AND CONTINUE"** butonuna tıkla

**Adım 5: Role (Rol) Ekle**
- "Grant this service account access to project" bölümünde:
  - **"Select a role"** dropdown'ına tıkla
  - Arama kutusuna "Editor" yaz
  - **"Editor"** rolünü seç (veya "Owner" seçebilirsin ama Editor yeterli)
- **"CONTINUE"** butonuna tıkla

**Adım 6: Tamamla**
- Son adımda ek bir ayar yapmana gerek yok
- **"DONE"** butonuna tıkla
- Service account oluşturuldu! Artık listede görebilirsin

### 2. Service Account Key İndirme

**Adım 1: Service Account'ı Aç**
- Service Accounts listesinde, az önce oluşturduğun service account'a (örn: `eas-submit`) tıkla
- Service account detay sayfası açılacak

**Adım 2: Keys Sekmesine Git**
- Üst kısımda sekmeler var: **"DETAILS"**, **"PERMISSIONS"**, **"KEYS"**
- **"KEYS"** sekmesine tıkla

**Adım 3: Yeni Key Oluştur**
- **"+ ADD KEY"** butonuna tıkla
- Açılan menüden **"Create new key"** seçeneğini seç
- Key formatı seçimi penceresi açılacak:
  - **JSON** formatını seç (varsayılan olarak seçili olabilir)
  - **"CREATE"** butonuna tıkla
- Key dosyası otomatik olarak indirilecek (`google-play-service-account.json` veya benzer bir isimle)

**Not:** Bu JSON dosyası çok önemli! İçinde Google Play Console'a erişim için gerekli bilgiler var. Güvenli bir yerde sakla.

### 3. Google Play Console'da Yetkilendirme

**Adım 1: Google Play Console'a Git**
- Tarayıcıda şu adresi aç: https://play.google.com/console
- Google hesabınla giriş yap (Google Play Developer hesabın olmalı)

**Adım 2: API Access Sayfasına Git**

**Yöntem 1: Doğrudan URL ile (En Kolay)**
- Tarayıcıda şu adresi aç: https://play.google.com/console/u/0/developers/api-access
- Bu sayfa doğrudan API access sayfasına götürür

**Yöntem 2: Menüden Bulma**
- Sol menüden **"Setup"** > **"API access"** seçeneğine tıkla
- VEYA sol menüden **"Settings"** (Ayarlar) > **"API access"** seçeneğine tıkla
- VEYA sol menüden **"Users and permissions"** > **"API access"** seçeneğine tıkla

**Not:** Eğer hiçbirinde göremiyorsan, Google Play Console'da henüz bir app oluşturmamış olabilirsin. Bu durumda önce bir app oluşturman gerekir (aşağıdaki "App Oluşturma" bölümüne bak).

**Adım 3: Service Account'ı Bağla**
- "Service accounts" bölümünde **"Link service account"** butonuna tıkla
- Açılan pencerede:
  - Oluşturduğun service account'ı göreceksin (e-posta formatında görünür, örn: `eas-submit@proje-id.iam.gserviceaccount.com`)
  - Service account'ı seç
  - **"LINK"** veya **"Grant access"** butonuna tıkla

**Adım 4: İzinleri Ver**
- Service account bağlandıktan sonra, yanında **"Grant access"** veya **"Manage access"** butonu görünecek
- Bu butona tıkla
- Açılan pencerede şu izinleri işaretle:
  - ✅ **View app information and download bulk reports**
  - ✅ **Manage production releases**
  - ✅ **Manage testing track releases** (veya **Manage testing releases**)
  - ✅ **Manage testing track releases (Internal testing)** (eğer ayrı bir seçenek varsa)
- **"Apply"** veya **"Save"** butonuna tıkla

**Not:** Eğer "Link service account" butonunu göremiyorsan, Google Play Console'da henüz bir app oluşturmamış olabilirsin. Önce bir app oluşturman gerekebilir.

### 4. Service Account Key'i Projeye Ekle

**Adım 1: İndirilen Dosyayı Bul**
- İndirilen JSON dosyası genellikle **Downloads** klasöründe olur
- Dosya adı şöyle olabilir: `proje-id-xxxxx.json` veya `google-play-service-account.json`
- Dosyayı bul ve konumunu not al

**Adım 2: Dosyayı Proje Klasörüne Kopyala**

Terminal'de şu komutu çalıştır (dosya adını kendi dosyanla değiştir):

```bash
# Eğer dosya Downloads klasöründeyse:
cp ~/Downloads/proje-id-xxxxx.json /Users/gokhanmemik/Desktop/HobbyCollection/Mobile/google-play-service-account.json

# Veya dosyayı Finder'dan sürükle-bırak yapabilirsin:
# 1. Finder'da Downloads klasörünü aç
# 2. JSON dosyasını bul
# 3. Dosyayı /Users/gokhanmemik/Desktop/HobbyCollection/Mobile/ klasörüne sürükle
# 4. Dosya adını "google-play-service-account.json" olarak değiştir
```

**Adım 3: Dosya Adını Kontrol Et**
- Dosyanın adı tam olarak `google-play-service-account.json` olmalı
- `eas.json` dosyasında bu isim kullanılıyor

**ÖNEMLİ:** Bu dosya hassas bilgiler içerir! `.gitignore`'a eklenmiş olmalı (zaten ekledik). Asla bu dosyayı Git'e commit etme!

### 5. Otomatik Submit Kullanımı

Service account kurulduktan sonra:

```bash
# Build al ve otomatik Google Play'e yükle
eas build --platform android --profile production --auto-submit
```

**Alternatif:** Service account olmadan manuel yükleme yapabilirsiniz (yukarıdaki "Manuel Yükleme" bölümüne bakın).

## 🚀 Hızlı Başlangıç Komutları

```bash
# 1. EAS'a login (eğer değilseniz)
eas login

# 2. Android production build al ve Google Play'e yükle
eas build --platform android --profile production --auto-submit

# 3. Build durumunu kontrol et
eas build:list

# 4. Build'i manuel indir (gerekirse)
eas build:download
```

## 📝 Google Play Console Checklist

### İlk Kurulum:
- [ ] Google Play Console hesabı oluşturuldu ($25 ödeme yapıldı)
- [ ] App oluşturuldu (package: `com.gmemik.saveall`)
- [ ] App Store listing bilgileri dolduruldu (en azından temel bilgiler)
- [ ] Content rating tamamlandı
- [ ] Privacy policy URL eklendi (gerekirse)

### Her Build İçin:
- [ ] Build alındı (`eas build --platform android`)
- [ ] Build Google Play Console'a yüklendi
- [ ] Version code artırıldı
- [ ] Release notes eklendi
- [ ] Internal testing grubuna atandı
- [ ] Test link'i paylaşıldı

## ⚠️ Önemli Notlar

1. **İlk Yayın:** İlk kez Google Play'e yüklerken Google'ın incelemesi gerekebilir (birkaç saat - 1 gün)
2. **Version Code:** Her build için mutlaka artırılmalı (EAS otomatik yapar)
3. **Keystore:** EAS otomatik yönetir, kaybetmeyin
4. **Test Kullanıcıları:** Internal testing için maksimum 100 kullanıcı
5. **Production Release:** Internal testing'den sonra production'a geçmek için ayrı bir release oluşturulmalı

## 🔄 iOS TestFlight ile Karşılaştırma

| Özellik | iOS TestFlight | Android Internal Testing |
|---------|----------------|--------------------------|
| Ücret | $99/yıl | $25 (tek seferlik) |
| Test Kullanıcı Sayısı | Sınırsız | 100 (Internal), Sınırsız (Closed) |
| Dağıtım Hızı | Hızlı | Çok hızlı |
| İnceleme Süresi | 1-2 gün (ilk) | Birkaç saat - 1 gün (ilk) |
| Link Paylaşımı | Var | Var |
| Otomatik Güncelleme | Var | Var |

## 🐛 Sorun Giderme

### Build Hatası
- Package name'in Google Play'de kayıtlı olduğundan emin ol
- Keystore'un geçerli olduğundan emin ol
- `eas credentials` ile credential'ları kontrol et

### Google Play'e Yüklenemiyor
- Google Play Console'da app oluşturulmuş olmalı
- Package name eşleşmeli (`com.gmemik.saveall`)
- Version code her seferinde artırılmalı
- App Store listing bilgileri tamamlanmış olmalı

### Test Kullanıcıları Göremiyor
- Internal testing track'inde release yapılmış olmalı
- Test kullanıcıları email listesine eklenmiş olmalı
- Test link'i doğru paylaşılmış olmalı
- Google Play Store uygulaması güncel olmalı

## 📚 Ek Kaynaklar

- [Google Play Console Dokümantasyonu](https://support.google.com/googleplay/android-developer)
- [EAS Build Dokümantasyonu](https://docs.expo.dev/build/introduction/)
- [Android App Bundle (AAB) Formatı](https://developer.android.com/guide/app-bundle)

