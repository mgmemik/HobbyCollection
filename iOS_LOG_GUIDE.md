# iOS Canlı Uygulamada Log Takibi Rehberi

## 1. Xcode Console ile Log Takibi

### Adımlar:
1. **Mac'inizde Xcode'u açın**
2. **Window > Devices and Simulators** menüsüne gidin (⌘⇧2)
3. Sol panelden **fiziksel iOS cihazınızı** seçin
4. Sağ panelde **"Open Console"** butonuna tıklayın
5. Console açıldığında:
   - Üst kısımdaki filtre alanına uygulama adınızı yazın (örn: "HobbyCollection")
   - Veya "Save All" yazın
   - Console log'ları gerçek zamanlı olarak görünecek

### Log Filtreleme:
- `[getOrCreateConversation]` - Mesajlaşma log'ları
- `[getUserPublicProducts]` - Profil log'ları
- `Error` - Hata log'ları
- `Warning` - Uyarı log'ları

## 2. React Native Debugger ile Log Takibi

### Kurulum:
```bash
# Homebrew ile kurulum
brew install --cask react-native-debugger
```

### Kullanım:
1. **React Native Debugger'ı açın**
2. **Mobil uygulamada** shake gesture yapın (cihazı sallayın)
3. **"Debug"** seçeneğini seçin
4. React Native Debugger'da console log'ları görünecek

### Alternatif (Chrome DevTools):
1. Mobil uygulamada shake gesture yapın
2. **"Debug"** seçeneğini seçin
3. Chrome'da `http://localhost:8081/debugger-ui` açılacak
4. Console sekmesinde log'ları görebilirsiniz

## 3. Metro Bundler Console

### Terminal'de:
```bash
cd Mobile
npm start
# veya
npx expo start
```

Metro bundler console'unda tüm log'lar görünecek.

## 4. Flipper ile Log Takibi (Önerilen)

### Kurulum:
```bash
# Homebrew ile
brew install --cask flipper
```

### Kullanım:
1. **Flipper'ı açın**
2. **Mobil cihazınızı USB ile Mac'e bağlayın**
3. Flipper otomatik olarak cihazı algılayacak
4. **Logs** sekmesinde tüm log'ları görebilirsiniz
5. Filtreleme ve arama yapabilirsiniz

## 5. iOS Console App (macOS)

### Kullanım:
1. **Applications > Utilities > Console** uygulamasını açın
2. Sol panelden cihazınızı seçin
3. Sağ üstteki arama kutusuna uygulama adını yazın
4. Log'lar gerçek zamanlı görünecek

## 6. Programatik Log Ekleme

### Önemli Log Noktaları:
- `[getOrCreateConversation]` - Mesajlaşma API çağrıları
- `[getUserPublicProducts]` - Profil yükleme
- `[UserProfileScreen]` - Profil ekranı log'ları
- `Error` - Tüm hatalar

### Örnek Log:
```typescript
console.log('[getOrCreateConversation] API_BASE_URL:', API_BASE_URL);
console.error('[getOrCreateConversation] Error:', error);
```

## 7. Backend Log'ları (Cloud Logging)

### Google Cloud Console:
```bash
# Son 50 log kaydını göster
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api AND textPayload=~'GetOrCreateConversation'" --limit 50 --project=fresh-inscriber-472521-t7

# Sadece hata log'larını göster
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=hobbycollection-api AND severity>=ERROR" --limit 50 --project=fresh-inscriber-472521-t7
```

### Web Console:
1. https://console.cloud.google.com/logs adresine gidin
2. Proje: `fresh-inscriber-472521-t7`
3. Resource type: `Cloud Run Revision`
4. Service name: `hobbycollection-api`
5. Filtre: `GetOrCreateConversation` veya `ERROR`

## Önerilen Yöntem

**En kolay ve hızlı yöntem:**
1. **Xcode Devices and Simulators** (⌘⇧2)
2. Cihazınızı seçin
3. "Open Console" butonuna tıklayın
4. Filtre: `Save All` veya `HobbyCollection`

Bu yöntem gerçek zamanlı log'ları gösterir ve iOS sistem log'larını da içerir.

