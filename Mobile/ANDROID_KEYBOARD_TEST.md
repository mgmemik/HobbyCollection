# Android Emülatör Klavye Test Rehberi

## Sorun
Android emülatörde klavye popup olarak açılıyor ve alttan açılamıyor. Bu yüzden gerçek cihazlardaki klavye davranışını test edemiyoruz.

## Çözüm: Emülatörde Klavyeyi Alttan Açmak

### Yöntem 1: ADB Komutu (En Hızlı)

```bash
# Klavye ayarını kontrol et
adb shell settings get secure show_ime_with_hard_keyboard

# Eğer 0 dönerse (kapalı), açmak için:
adb shell settings put secure show_ime_with_hard_keyboard 1

# Emülatörü yeniden başlatın
```

### Yöntem 2: Emülatör Extended Controls

1. Emülatör açıkken sağ taraftaki **"..."** (üç nokta) butonuna tıklayın
2. **Settings** > **General** bölümüne gidin
3. **"Show virtual keyboard"** seçeneğini açın
4. Emülatörü yeniden başlatın

### Yöntem 3: Android Ayarlarından

1. Emülatörde **Settings** uygulamasını açın
2. **System** > **Languages & input** > **Physical keyboard** bölümüne gidin
3. **"Show on-screen keyboard"** seçeneğini açın

### Yöntem 4: Emülatör AVD Ayarları

1. Android Studio'da **Tools** > **Device Manager** açın
2. Emülatörünüzün yanındaki **▼** > **Edit** tıklayın
3. **Advanced Settings** bölümüne gidin
4. **"Enable keyboard input"** seçeneğini açın
5. Emülatörü yeniden başlatın

## Test Komutu

Klavye ayarının çalışıp çalışmadığını test etmek için:

```bash
# Klavye durumunu kontrol et
adb shell settings get secure show_ime_with_hard_keyboard

# Beklenen: 1 (açık) veya 0 (kapalı)
```

## Not

- Emülatörü yeniden başlattıktan sonra ayarlar uygulanır
- Bazı emülatörlerde klavye popup olarak açılabilir; bu durumda **Yöntem 1** veya **Yöntem 2** genelde çözüm sağlar
- Emülatör Extended Controls'dan **"Show virtual keyboard"** açıldıktan sonra klavye ekranın altında görünür

## Kod Değişiklikleri

Android için `KeyboardAvoidingView` ile `behavior="height"` kullanılıyor. Bu, gerçek cihazlarda klavye alttan açıldığında bottom sheet'in otomatik olarak yukarı kaymasını sağlar.

iOS için mevcut `keyboardHeight` state yaklaşımı korunuyor.
