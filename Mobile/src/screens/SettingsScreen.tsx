import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable,
  StatusBar,
  Switch,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
// import { PALETTES } from '../theme/config';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';
import { translations, SupportedLocale } from '../i18n/translations';
import { fetchUserPreferences, updateUserPreferences } from '../api/userPreferences';
import { Input } from '../components/ui/Input';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../api/auth';
import { requestNotificationPermissions, checkNotificationPermissions } from '../utils/notifications';
import { collectAndSendDeviceInfo, getMyDevices } from '../api/deviceInfo';
import * as ImagePicker from 'expo-image-picker';
import { uploadAvatar, deleteAvatar } from '../api/avatar';
import { Image } from 'expo-image';
import { fixImageUrlForEmulator } from '../utils/imageUrl';

export const SettingsScreen: React.FC = () => {
  const { colors, currentTheme, toggleTheme } = useTheme();
  // const themeCtx = useTheme();
  const navigation = useNavigation();
  const { email, logout } = useAuth();
  const { t } = useTranslation();

  // Language settings state
  const [languageOpen, setLanguageOpen] = useState(false);
  const [uiLang, setUiLang] = useState<SupportedLocale>('en');
  const [aiLang, setAiLang] = useState<SupportedLocale>('en'); // default always en
  const [currency, setCurrency] = useState<string>('TRY');
  const [username, setUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState<string>(''); // Username input için local state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarImageNonce, setAvatarImageNonce] = useState(0);
  const [avatarImageFailedRow, setAvatarImageFailedRow] = useState(false);
  const [avatarImageFailedModal, setAvatarImageFailedModal] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [isPrivateAccount, setIsPrivateAccount] = useState<boolean>(false);
  const [isWebProfilePublic, setIsWebProfilePublic] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  // webProfileUrl artık state'de tutulmuyor - username ile dinamik oluşturuluyor
  // Telefon/OS izni
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(false);
  // Uygulama içi ayar (DB)
  const [notificationsEnabledDb, setNotificationsEnabledDb] = useState<boolean>(true);

  // Check notification permission on mount and when screen is focused
  const checkNotificationPermission = useCallback(async () => {
    try {
      const result = await checkNotificationPermissions();
      setHasNotificationPermission(result.hasPermission);

      // DB'deki uygulama içi ayarı çek (en güncel cihaz kaydı genelde bu cihaz olur)
      try {
        const devices = await getMyDevices();
        const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
        const current = devices.find(d => d.platform === platformName) || devices[0];
        if (current && typeof current.notificationsEnabled === 'boolean') {
          setNotificationsEnabledDb(current.notificationsEnabled);
        }
      } catch {
        // sessiz geç
      }
    } catch (err) {
      console.error('[SettingsScreen] Failed to check notification permissions:', err);
    }
  }, []);

  const effectiveNotificationsEnabled = notificationsEnabledDb && hasNotificationPermission;

  const openPhoneNotificationSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const handleEnableNotificationsFromSettings = async () => {
    // 1) Uygulama içi ayarı aç (DB)
    try {
      const check = await checkNotificationPermissions();
      setHasNotificationPermission(check.hasPermission);
      setNotificationsEnabledDb(true);
      await collectAndSendDeviceInfo(check.token || undefined, check.hasPermission, true);

      // 2) OS izni kapalıysa izin iste / yönlendir
      if (!check.hasPermission) {
        const isExpoGo = Constants.appOwnership === 'expo';
        if (isExpoGo) {
          Alert.alert(
            t('settings.notifications') || 'Bildirimler',
            t('settings.pushInfoLimited') ||
              'Bu ortamda push token alma kısıtlı. Push bildirimlerini test etmek için development/production build kullanacağız. Canlı uygulamada bu alan normal çalışır.',
            [{ text: 'OK' }]
          );
          return;
        }

        const req = await requestNotificationPermissions();
        setHasNotificationPermission(req.hasPermission);
        await collectAndSendDeviceInfo(req.token || undefined, req.hasPermission, true);

        if (!req.granted) {
          Alert.alert(
            t('settings.notifications') || 'Bildirimler',
            t('settings.notificationPermissionDenied') ||
              'Bildirim izni verilmedi. Bildirim almak için telefon ayarlarından izin vermelisiniz.',
            [
              { text: t('common.cancel') || 'İptal', style: 'cancel' },
              { text: t('settings.openSettings') || 'Ayarları Aç', onPress: openPhoneNotificationSettings },
            ]
          );
        }
      }
    } catch (e) {
      // Sessiz fail; kullanıcı detay ayar ekranından deneyebilir
    }
  };

  const handleGrantPermissionFromSettings = async () => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        Alert.alert(
          t('settings.notifications') || 'Bildirimler',
          t('settings.pushInfoLimited') ||
            'Bu ortamda push token alma kısıtlı. Push bildirimlerini test etmek için development/production build kullanacağız. Canlı uygulamada bu alan normal çalışır.',
          [{ text: 'OK' }]
        );
        return;
      }

      const req = await requestNotificationPermissions();
      setHasNotificationPermission(req.hasPermission);
      await collectAndSendDeviceInfo(req.token || undefined, req.hasPermission, notificationsEnabledDb);

      if (!req.granted) {
        Alert.alert(
          t('settings.notifications') || 'Bildirimler',
          t('settings.notificationPermissionDenied') ||
            'Bildirim izni verilmedi. Bildirim almak için telefon ayarlarından izin vermelisiniz.',
          [
            { text: t('common.cancel') || 'İptal', style: 'cancel' },
            { text: t('settings.openSettings') || 'Ayarları Aç', onPress: openPhoneNotificationSettings },
          ]
        );
      }
    } catch {
      openPhoneNotificationSettings();
    }
  };

  useEffect(() => {
    checkNotificationPermission();
  }, [checkNotificationPermission]);

  useFocusEffect(
    useCallback(() => {
      checkNotificationPermission();
    }, [checkNotificationPermission])
  );

  // Load persisted languages
  useEffect(() => {
    (async () => {
      try {
        // server preferences
        const token = (await AsyncStorage.getItem('auth_token')) || '';
        if (token) {
          try {
            const prefs = await fetchUserPreferences(token);
            if (prefs?.uiLanguage && translations[prefs.uiLanguage as SupportedLocale]) {
              setUiLang(prefs.uiLanguage as SupportedLocale);
            }
            if (prefs?.aiLanguage && translations[prefs.aiLanguage as SupportedLocale]) {
              setAiLang(prefs.aiLanguage as SupportedLocale);
            }
            if (prefs?.username) {
              setUsername(prefs.username);
              setUsernameInput(prefs.username); // Input state'ini de güncelle
            }
            if (prefs?.avatarUrl) setAvatarUrl(prefs.avatarUrl);
            if (prefs?.currency) setCurrency(prefs.currency);
            if (typeof prefs?.isPremium === 'boolean') setIsPremium(prefs.isPremium);
            // Standart kullanıcılar için isPrivateAccount her zaman false olmalı
            if (typeof prefs?.isPrivateAccount === 'boolean') {
              const isPremiumUser = typeof prefs?.isPremium === 'boolean' && prefs.isPremium;
              setIsPrivateAccount(isPremiumUser ? prefs.isPrivateAccount : false);
            }
            if (typeof prefs?.isWebProfilePublic === 'boolean') setIsWebProfilePublic(prefs.isWebProfilePublic);
            // webProfileUrl artık backend'den gelmiyor - frontend'de username ile oluşturulacak
          } catch {}
        }
        const storedUi = await AsyncStorage.getItem('ui_lang');
        const storedAi = await AsyncStorage.getItem('ai_lang');
        if (storedUi && translations[storedUi as SupportedLocale]) setUiLang(storedUi as SupportedLocale);
        else setUiLang((i18n.language as SupportedLocale) || 'en');
        if (storedAi && translations[storedAi as SupportedLocale]) setAiLang(storedAi as SupportedLocale);
        else setAiLang('en'); // enforce default
      } catch {}
    })();
  }, []);

  const languageName = (code: SupportedLocale) => {
    const map: Partial<Record<SupportedLocale, string>> = { en: 'English', tr: 'Türkçe' };
    return map[code] || code;
  };

  const currencyName = (code: string) => {
    const map: Record<string, string> = { 
      TRY: 'Türk Lirası (₺)', 
      USD: 'US Dollar ($)', 
      EUR: 'Euro (€)',
      GBP: 'British Pound (£)',
      JPY: 'Japanese Yen (¥)'
    };
    return map[code] || code;
  };

  const handleAvatarChange = async () => {
    console.log('[handleAvatarChange] Opening avatar modal');
    setAvatarFeedback(null);
    setAvatarImageNonce(n => n + 1);
    setAvatarImageFailedModal(false);
    setAvatarModalOpen(true);
  };

  const handleSelectPhoto = async () => {
    try {
      setAvatarFeedback(null);
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          t('addProduct.permissionRequired') || 'İzin Gerekli',
          t('addProduct.galleryPermissionMessage') || 'Fotoğraf seçmek için galeri erişim izni gereklidir.'
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        setIsUploadingAvatar(true);
        try {
          const response = await uploadAvatar(result.assets[0].uri);
          console.log('[handleSelectPhoto] Upload response:', response);
          console.log('[handleSelectPhoto] Avatar URL:', response.avatarUrl);
          
          // Avatar URL'yi hemen güncelle
          if (response.avatarUrl) setAvatarUrl(response.avatarUrl);
          setAvatarImageNonce(n => n + 1);
          setAvatarImageFailedRow(false);
          setAvatarImageFailedModal(false);
          
          // User preferences'ı refresh et
          const token = (await AsyncStorage.getItem('auth_token')) || '';
          if (token) {
            const prefs = await fetchUserPreferences(token);
            console.log('[handleSelectPhoto] Preferences avatarUrl:', prefs.avatarUrl);
            // Sadece preferences'tan gelen avatarUrl'yi kullan (eğer varsa)
            if (prefs.avatarUrl) {
              setAvatarUrl(prefs.avatarUrl);
              setAvatarImageNonce(n => n + 1);
              setAvatarImageFailedRow(false);
              setAvatarImageFailedModal(false);
            }
          }

          // Modal açık kalsın; kullanıcı süreci takip edebilsin
          setAvatarFeedback({ type: 'success', text: t('settings.avatarUploaded') || 'Avatar başarıyla yüklendi' });
          setTimeout(() => setAvatarFeedback(null), 2500);
        } catch (error: any) {
          setAvatarFeedback({ type: 'error', text: error.message || t('settings.avatarUploadError') || 'Avatar yüklenirken bir hata oluştu' });
          setTimeout(() => setAvatarFeedback(null), 4000);
        } finally {
          setIsUploadingAvatar(false);
        }
      }
    } catch (error: any) {
      setAvatarFeedback({ type: 'error', text: error.message || t('settings.avatarSelectError') || 'Fotoğraf seçilirken bir hata oluştu' });
      setTimeout(() => setAvatarFeedback(null), 4000);
      setIsUploadingAvatar(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      setAvatarFeedback(null);
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          t('addProduct.permissionRequired') || 'İzin Gerekli',
          t('addProduct.cameraPermissionMessage') || 'Fotoğraf çekmek için kamera erişim izni gereklidir.'
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        setIsUploadingAvatar(true);
        try {
          const response = await uploadAvatar(result.assets[0].uri);
          console.log('[handleTakePhoto] Upload response:', response);
          console.log('[handleTakePhoto] Avatar URL:', response.avatarUrl);
          
          // Avatar URL'yi hemen güncelle
          if (response.avatarUrl) setAvatarUrl(response.avatarUrl);
          setAvatarImageNonce(n => n + 1);
          setAvatarImageFailedRow(false);
          setAvatarImageFailedModal(false);
          
          // User preferences'ı refresh et
          const token = (await AsyncStorage.getItem('auth_token')) || '';
          if (token) {
            const prefs = await fetchUserPreferences(token);
            console.log('[handleTakePhoto] Preferences avatarUrl:', prefs.avatarUrl);
            // Sadece preferences'tan gelen avatarUrl'yi kullan (eğer varsa)
            if (prefs.avatarUrl) {
              setAvatarUrl(prefs.avatarUrl);
              setAvatarImageNonce(n => n + 1);
              setAvatarImageFailedRow(false);
              setAvatarImageFailedModal(false);
            }
          }

          setAvatarFeedback({ type: 'success', text: t('settings.avatarUploaded') || 'Avatar başarıyla yüklendi' });
          setTimeout(() => setAvatarFeedback(null), 2500);
        } catch (error: any) {
          setAvatarFeedback({ type: 'error', text: error.message || t('settings.avatarUploadError') || 'Avatar yüklenirken bir hata oluştu' });
          setTimeout(() => setAvatarFeedback(null), 4000);
        } finally {
          setIsUploadingAvatar(false);
        }
      }
    } catch (error: any) {
      setAvatarFeedback({ type: 'error', text: error.message || t('settings.avatarCameraError') || 'Kamera kullanılırken bir hata oluştu' });
      setTimeout(() => setAvatarFeedback(null), 4000);
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      setAvatarFeedback(null);
      setIsUploadingAvatar(true);
      await deleteAvatar();
      setAvatarUrl(null);
      setAvatarImageNonce(n => n + 1);
      setAvatarImageFailedRow(false);
      setAvatarImageFailedModal(false);
      const token = (await AsyncStorage.getItem('auth_token')) || '';
      if (token) {
        const prefs = await fetchUserPreferences(token);
        // Eğer backend hala url dönüyorsa onu al; yoksa null kal
        if (prefs.avatarUrl) setAvatarUrl(prefs.avatarUrl);
      }
      setAvatarFeedback({ type: 'success', text: t('settings.avatarDeleted') || 'Avatar silindi' });
      setTimeout(() => setAvatarFeedback(null), 2500);
    } catch (error: any) {
      setAvatarFeedback({ type: 'error', text: error.message || t('settings.avatarDeleteError') || 'Avatar silinirken bir hata oluştu' });
      setTimeout(() => setAvatarFeedback(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getAvatarUri = (url: string | null) => {
    if (!url) return null;
    const fixed = fixImageUrlForEmulator(url);
    const join = fixed.includes('?') ? '&' : '?';
    return `${fixed}${join}v=${avatarImageNonce}`;
  };

  const handleSaveLanguages = async () => {
    try {
      await AsyncStorage.setItem('ui_lang', uiLang);
      await AsyncStorage.setItem('ai_lang', aiLang || 'en');
      if (i18n.language !== uiLang) {
        await i18n.changeLanguage(uiLang);
      }
      const token = (await AsyncStorage.getItem('auth_token')) || '';
      if (token) {
        await updateUserPreferences(token, { 
          uiLanguage: uiLang, 
          aiLanguage: aiLang || 'en', 
          currency, 
          isPrivateAccount,
          avatarUrl: avatarUrl || null
        });
        // Preferences'ı yeniden çek
        const prefs = await fetchUserPreferences(token);
        if (prefs?.username) {
          setUsername(prefs.username);
          setUsernameInput(prefs.username); // Input state'ini de güncelle
        }
      }
      setLanguageOpen(false);
      // Force re-render to update UI
      setTimeout(() => {
        navigation.navigate('Settings' as never);
      }, 100);
    } catch (error: any) {
      console.error('Error saving languages:', error);
      Alert.alert(t('common.error') || 'Hata', error.message || t('settings.saveError') || 'Ayarlar kaydedilirken bir hata oluştu');
    }
  };

  const SettingItem: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    showArrow?: boolean;
  }> = ({ icon, title, subtitle, onPress, rightComponent, showArrow = true }) => {
    const rightComponentRef = useRef<View>(null);
    
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: colors.surface,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={onPress}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
          }}>
            <Ionicons name={icon} size={20} color={colors.primary} />
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 16, 
              fontWeight: '600' 
            }}>
              {title}
            </Text>
            {subtitle && (
              <Text style={{ 
                color: colors.textMuted, 
                fontSize: 14, 
                marginTop: 2 
              }}>
                {subtitle}
              </Text>
            )}
          </View>
        </Pressable>

        {rightComponent && (
          <View ref={rightComponentRef} pointerEvents="box-none">
            {rightComponent}
          </View>
        )}
        
        {showArrow && !rightComponent && (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar 
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background}
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Pressable 
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          
          <Text style={{ 
            color: colors.text, 
            fontSize: 20, 
            fontWeight: '700',
            flex: 1,
          }}>
            {t('settings.title')}
          </Text>
        </View>

        <ScrollView 
          contentContainerStyle={{ paddingVertical: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Account */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{
              color: colors.textMuted,
              fontSize: 14,
              fontWeight: '600',
              paddingHorizontal: 20,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              {t('settings.account') || 'ACCOUNT'}
            </Text>

            <SettingItem
              icon="person"
              title={t('settings.accountInfo') || 'Account Information'}
              subtitle={email ? (username ? `${email} • @${username}` : email) : (email || t('settings.accountInfo') || 'Account Information')}
              onPress={() => {
                try {
                  console.log('[SettingItem] Account Info pressed');
                  // Modal açılırken mevcut username'i input'a yükle
                  if (username) {
                    setUsernameInput(username);
                  }
                  setAccountOpen(true);
                } catch (error: any) {
                  console.error('Error opening account settings:', error);
                  Alert.alert(t('common.error') || 'Hata', error.message || t('settings.openError') || 'Hesap ayarları açılırken bir hata oluştu');
                }
              }}
            />

            <SettingItem
              icon="image"
              title={t('settings.avatar') || 'Avatar'}
              subtitle={avatarUrl ? (t('settings.avatarSet') || 'Tap to change or remove') : (t('settings.avatarNotSet') || 'Tap to add avatar')}
              onPress={() => {
                console.log('[SettingItem] Avatar pressed');
                handleAvatarChange();
              }}
              showArrow={false}
              rightComponent={
                isUploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                ) : avatarUrl && !avatarImageFailedRow ? (
                  <Image
                    key={getAvatarUri(avatarUrl) || avatarUrl}
                    source={{ uri: getAvatarUri(avatarUrl) || fixImageUrlForEmulator(avatarUrl) }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      marginRight: 8,
                    }}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="disk"
                    onError={(e) => {
                      console.warn('[SettingsScreen] Avatar (row) load error', e?.error);
                      setAvatarImageFailedRow(true);
                    }}
                  />
                ) : (
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginRight: 8,
                  }}>
                    <Ionicons name="person" size={20} color={colors.textMuted} />
                  </View>
                )
              }
            />

            <SettingItem
              icon="eye"
              title={t('settings.appProfileVisibility') || 'App Profile Visibility'}
              subtitle={
                !isPremium
                  ? t('settings.appProfileStandardMessage') || 'Profil görünürlüğünü sadece premium üyeler değiştirebilir. Standart üyeler için her zaman görünür durumdadır. Premium almak için planlar sayfasını ziyaret edin.'
                  : t('settings.appProfilePremiumMessage') || 'Profilinizi gizli profil yaparak sadece onaylı kullanıcılara yetki verebilirsiniz.'
              }
              showArrow={false}
              rightComponent={
                <Switch
                  value={!isPrivateAccount} // UI: true = görünür (isPrivateAccount=false), false = gizli (isPrivateAccount=true)
                  disabled={!isPremium} // Standart kullanıcılar için disabled - müdahale edilemez
                  onValueChange={async (value) => {
                    // Standart kullanıcılar için uyarı (disabled olduğu için buraya gelmemeli ama güvenlik için)
                    if (!isPremium) {
                      Alert.alert(
                        t('settings.appProfileVisibility') || 'Profil Görünürlüğü',
                        t('settings.privateAccountPremiumOnly') || 'Kapalı profil sadece premium üyeler için kullanılabilir. Premium plana geçmek için Planlar sayfasını ziyaret edin.',
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    
                    // UI'dan gelen value: true = profil görünür isteniyor (isPrivateAccount = false)
                    const newIsPrivateAccount = !value;
                    setIsPrivateAccount(newIsPrivateAccount);
                    
                    // Eğer profil kapatılıyorsa web profili de otomatik kapansın
                    if (newIsPrivateAccount && isWebProfilePublic) {
                      setIsWebProfilePublic(false);
                    }
                    try {
                      const token = (await AsyncStorage.getItem('auth_token')) || '';
                      if (token) {
                        await updateUserPreferences(token, { 
                          uiLanguage: uiLang, 
                          aiLanguage: aiLang || 'en', 
                          currency,
                          isPrivateAccount: newIsPrivateAccount,
                          isWebProfilePublic: newIsPrivateAccount ? false : isWebProfilePublic
                        });
                        // Preferences'ı yeniden çek
                        const prefs = await fetchUserPreferences(token);
                        if (typeof prefs?.isWebProfilePublic === 'boolean') setIsWebProfilePublic(prefs.isWebProfilePublic);
                        if (prefs?.username) {
                          setUsername(prefs.username);
                          setUsernameInput(prefs.username); // Input state'ini de güncelle
                        }
                      }
                    } catch (error) {
                      console.error('Error updating private account setting:', error);
                      setIsPrivateAccount(!newIsPrivateAccount); // Revert on error
                    }
                  }}
                  thumbColor={colors.primary}
                  trackColor={{ true: colors.accent, false: colors.border }}
                />
              }
            />

            <SettingItem
              icon="globe"
              title={t('settings.webProfileVisibility') || 'Web Profile Visibility'}
              subtitle={
                !isPremium
                  ? t('settings.webProfileStandardMessage') || 'Sadece premium kullanıcılar web profili yaratabilir.'
                  : isPrivateAccount
                  ? t('settings.webProfileRequiresPublic')
                  : t('settings.webProfilePremiumMessage') || 'Web profili kullanmak için aktif edebilirsiniz.'
              }
              showArrow={false}
              rightComponent={
                <View style={{ alignItems: 'flex-end' }}>
                  <Switch
                    value={isWebProfilePublic}
                    disabled={!isPremium || isPrivateAccount}
                    onValueChange={async (value) => {
                      if (!isPremium) {
                        Alert.alert(
                          t('settings.webProfileVisibility'),
                          t('settings.webProfilePremiumOnly'),
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      if (isPrivateAccount) {
                        Alert.alert(
                          t('settings.webProfileVisibility'),
                          t('settings.webProfileRequiresPublic'),
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      setIsWebProfilePublic(value);
                      try {
                        const token = (await AsyncStorage.getItem('auth_token')) || '';
                        if (token) {
                          await updateUserPreferences(token, { 
                            uiLanguage: uiLang, 
                            aiLanguage: aiLang || 'en', 
                            currency,
                            isPrivateAccount,
                            isWebProfilePublic: value
                          });
                          // Preferences'ı yeniden çek
                          const prefs = await fetchUserPreferences(token);
                          if (typeof prefs?.isWebProfilePublic === 'boolean') setIsWebProfilePublic(prefs.isWebProfilePublic);
                          if (prefs?.webProfileUrl) setWebProfileUrl(prefs.webProfileUrl);
                        }
                      } catch (error: any) {
                        console.error('Error updating web profile visibility:', error);
                        setIsWebProfilePublic(!value); // Revert on error
                        // Backend'den gelen özel hata mesajlarını göster
                        const errorText = error.message || '';
                        if (errorText.includes('APP_PROFILE_PRIVATE')) {
                          Alert.alert(
                            t('common.error'),
                            t('settings.webProfileRequiresPublic')
                          );
                        } else if (errorText.includes('PREMIUM_REQUIRED')) {
                          Alert.alert(
                            t('common.error'),
                            t('settings.webProfilePremiumOnly')
                          );
                        } else {
                          Alert.alert(t('common.error'), error.message || t('settings.updateError'));
                        }
                      }
                    }}
                    thumbColor={colors.primary}
                    trackColor={{ true: colors.accent, false: colors.border }}
                  />
                </View>
              }
            />

            {isWebProfilePublic && username && (
              <View style={{
                marginHorizontal: 16,
                marginTop: 8,
                marginBottom: 8,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.primary + '10',
                borderWidth: 1,
                borderColor: colors.primary + '30',
              }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                  {t('settings.webProfileUrl')}
                </Text>
                <Pressable
                  onPress={async () => {
                    try {
                      const url = `https://www.save-all.com/u/${username}`;
                      await Linking.openURL(url);
                    } catch (error) {
                      Alert.alert(t('common.error'), 'URL açılamadı');
                    }
                  }}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="link" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text 
                    style={{ 
                      color: colors.primary, 
                      fontSize: 13, 
                      flex: 1,
                      textDecorationLine: 'underline',
                    }}
                    numberOfLines={1}
                  >
                    {`https://www.save-all.com/u/${username}`}
                  </Text>
                  <Ionicons name="open-outline" size={16} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      const { default: Clipboard } = await import('expo-clipboard');
                      const url = `https://www.save-all.com/u/${username}`;
                      await Clipboard.setStringAsync(url);
                      Alert.alert(t('common.success') || 'Başarılı', t('settings.urlCopied') || 'Link kopyalandı');
                    } catch (error) {
                      Alert.alert(t('common.error'), 'Link kopyalanamadı');
                    }
                  }}
                  style={({ pressed }) => ({ 
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: pressed ? colors.border : colors.primary,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  })}
                >
                  <Ionicons name="copy-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                    {t('settings.copyUrl') || 'Linki Kopyala'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Application */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{
              color: colors.textMuted,
              fontSize: 14,
              fontWeight: '600',
              paddingHorizontal: 20,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              {t('settings.application') || 'APPLICATION'}
            </Text>

            <SettingItem
              icon="moon"
              title={t('settings.darkTheme') || 'Dark Theme'}
              subtitle={currentTheme === 'dark' ? t('settings.themeOn') : t('settings.themeOff')}
              showArrow={false}
              rightComponent={
                <Switch
                  value={currentTheme === 'dark'}
                  onValueChange={toggleTheme}
                  thumbColor={colors.primary}
                  trackColor={{ true: colors.accent, false: colors.border }}
                />
              }
            />

            <SettingItem
              icon="bookmark"
              title={t('profile.savedProducts') || 'Saved Products'}
              subtitle={t('profile.savedProductsDesc')}
              onPress={() => navigation.navigate('SavedProducts' as never)}
            />

            <SettingItem
              icon="document-text"
              title={t('collectionReport.title') || 'Collection Report'}
              subtitle={t('collectionReport.subtitle') || 'Tüm ürünlerinizi Excel formatında görüntüleyin'}
              onPress={() => navigation.navigate('CollectionReport' as never)}
            />

            <SettingItem
              icon="sparkles"
              title={t('settings.aiCredits') || 'AI Credits'}
              subtitle={t('settings.aiCreditsSubtitle') || 'View your AI credit balance and transaction history'}
              onPress={() => navigation.navigate('AICreditsDetail' as never)}
            />

            <SettingItem
              icon="star"
              title={t('plans.title') || 'Plans'}
              subtitle={t('plans.subtitle') || 'Standart ve Premium planları görüntüleyin'}
              onPress={() => navigation.navigate('Plans' as never)}
            />

            <View
              style={{
                flexDirection: 'column',
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: colors.surface,
                marginHorizontal: 16,
                marginBottom: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                onPress={() => navigation.navigate('NotificationSettings' as never)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primary + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}>
                  <Ionicons 
                    name={effectiveNotificationsEnabled ? "notifications" : "notifications-outline"} 
                    size={20} 
                    color={colors.primary} 
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 16, 
                    fontWeight: '600' 
                  }}>
                    {t('settings.notifications') || 'Notification'}
                  </Text>
                  <Text style={{ 
                    color: colors.textMuted, 
                    fontSize: 14, 
                    marginTop: 2 
                  }}>
                    {effectiveNotificationsEnabled
                      ? (t('settings.notificationsEnabled') || 'Bildirimler açık')
                      : `${t('settings.notificationsDisabled') || 'Bildirimler kapalı'}\n` +
                        `${t('settings.appSetting') || 'Uygulama ayarı'}: ${notificationsEnabledDb ? (t('settings.enabled') || 'Açık') : (t('settings.disabled') || 'Kapalı')} • ${t('settings.phonePermission') || 'Telefon izni'}: ${hasNotificationPermission ? (t('settings.enabled') || 'Açık') : (t('settings.disabled') || 'Kapalı')}`
                    }
                  </Text>
                </View>
                
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
              
              {/* Buton alt satırda */}
              {!effectiveNotificationsEnabled && (
                <View style={{ marginTop: 12, marginLeft: 56 }}>
                  {!notificationsEnabledDb ? (
                    <Pressable
                      onPress={handleEnableNotificationsFromSettings}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: colors.primary,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                        {t('settings.enableInApp') || 'Uygulamada Aç'}
                      </Text>
                    </Pressable>
                  ) : !hasNotificationPermission ? (
                    <Pressable
                      onPress={handleGrantPermissionFromSettings}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: colors.accent,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                        {t('settings.grantPhonePermission') || 'Telefonda İzin Ver'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>

            <SettingItem
              icon="language"
              title={t('settings.language') || 'Language'}
              subtitle={`${t('settings.uiLanguage')}: ${languageName(uiLang)} • ${t('settings.aiLanguage')}: ${languageName(aiLang || 'en')}`}
              onPress={() => setLanguageOpen(true)}
            />

            <SettingItem
              icon="cash"
              title={t('settings.currency') || 'Currency'}
              subtitle={currencyName(currency)}
              onPress={() => setLanguageOpen(true)}
            />
          </View>

          {/* Policies */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{
              color: colors.textMuted,
              fontSize: 14,
              fontWeight: '600',
              paddingHorizontal: 20,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              {t('settings.policies') || 'POLICIES'}
            </Text>

            <SettingItem
              icon="trash-outline"
              title={t('settings.accountDeletion') || 'Account Deletion'}
              subtitle={t('settings.accountDeletionSubtitle')}
              onPress={() => {
                const url = 'https://save-all.com/account-deletion';
                Linking.openURL(url).catch(err => {
                  Alert.alert('Hata', 'URL açılamadı');
                  console.error('Error opening URL:', err);
                });
              }}
            />

            <SettingItem
              icon="shield-checkmark-outline"
              title={t('settings.childSafety') || 'Child Safety Standards'}
              subtitle={t('settings.childSafetySubtitle')}
              onPress={() => {
                const url = 'https://save-all.com/child-safety';
                Linking.openURL(url).catch(err => {
                  Alert.alert('Hata', 'URL açılamadı');
                  console.error('Error opening URL:', err);
                });
              }}
            />

            <SettingItem
              icon="sparkles-outline"
              title={t('settings.aiCreditsPolicy') || 'AI Credits Policy'}
              subtitle={t('settings.aiCreditsPolicySubtitle')}
              onPress={() => (navigation as any).navigate('AICreditsPolicy')}
            />

            <SettingItem
              icon="document-text-outline"
              title={t('settings.privacyPolicy') || 'Privacy Policy'}
              subtitle={t('settings.privacyPolicySubtitle')}
              onPress={() => {
                const url = 'https://save-all.com/privacy';
                Linking.openURL(url).catch(err => {
                  Alert.alert('Hata', 'URL açılamadı');
                  console.error('Error opening URL:', err);
                });
              }}
            />

            <SettingItem
              icon="document-outline"
              title={t('settings.termsOfService') || 'Terms of Services'}
              subtitle={t('settings.termsOfServiceSubtitle')}
              onPress={() => {
                const url = 'https://save-all.com/terms';
                Linking.openURL(url).catch(err => {
                  Alert.alert('Hata', 'URL açılamadı');
                  console.error('Error opening URL:', err);
                });
              }}
            />

            <SettingItem
              icon="help-circle-outline"
              title={t('settings.helpSupport') || 'Help & Support'}
              subtitle={t('settings.helpSupportSubtitle')}
              onPress={() => {
                const url = 'https://save-all.com/support';
                Linking.openURL(url).catch(err => {
                  Alert.alert('Hata', 'URL açılamadı');
                  console.error('Error opening URL:', err);
                });
              }}
            />
          </View>

          {/* Hesap - Logout */}
          <View style={{ marginBottom: 32 }}>
            <Pressable
              onPress={async () => {
                Alert.alert(
                  t('auth.logout'),
                  t('auth.logoutConfirm'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('auth.logout'),
                      style: 'destructive',
                      onPress: async () => {
                        await logout();
                        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
                      },
                    },
                  ],
                );
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: '#ff444420',
                marginHorizontal: 16,
                marginBottom: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#ff4444',
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#ff444420',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}>
                <Ionicons name="log-out" size={20} color="#ff4444" />
              </View>
              
              <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: '600', flex: 1 }}>
                {t('auth.logout')}
              </Text>
            </Pressable>
          </View>

          {/* Versiyon */}
          <Pressable
            onPress={() => {
              // TODO: Navigate to What's New page
            }}
            style={{ alignItems: 'center', marginTop: 20 }}
          >
            <Text style={{
              color: colors.textMuted,
              fontSize: 12,
            }}>
              {t('settings.version')} {Constants.expoConfig?.version || '1.3.0'}
            </Text>
          </Pressable>
        </ScrollView>

        {(languageOpen || accountOpen || avatarModalOpen) && (
          <>
            {/* Backdrop */}
            <Pressable 
              onPress={() => { setLanguageOpen(false); setAccountOpen(false); setAvatarModalOpen(false); }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            >
              <BlurView intensity={20} tint={currentTheme === 'dark' ? 'dark' : 'light'} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#00000066' }} />
            </Pressable>

            {/* Bottom sheet */}
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
            >
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {languageOpen ? t('settings.languageSettings') : avatarModalOpen ? (t('settings.changeAvatar') || 'Avatar Değiştir') : t('settings.accountInfo')}
              </Text>
              <Pressable onPress={() => { setLanguageOpen(false); setAccountOpen(false); setAvatarModalOpen(false); }}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            {languageOpen && (
            <View style={{ padding: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{t('settings.uiLanguage')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['en','tr'] as const).map((code) => (
                  <Pressable key={code} onPress={() => setUiLang(code as any)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: uiLang === code ? colors.primary : colors.border, backgroundColor: uiLang === code ? colors.primary + '20' : colors.surface, marginRight: 8, marginBottom: 8 }}>
                    <Text style={{ color: uiLang === code ? colors.primary : colors.text }}>{code.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            )}

            {languageOpen && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{t('settings.aiLanguage')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['en','tr'] as const).map((code) => (
                  <Pressable key={code} onPress={() => setAiLang(code as any)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: aiLang === code ? colors.primary : colors.border, backgroundColor: aiLang === code ? colors.primary + '20' : colors.surface, marginRight: 8, marginBottom: 8 }}>
                    <Text style={{ color: aiLang === code ? colors.primary : colors.text }}>{code.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('settings.aiLanguageDefault')}</Text>
            </View>
            )}

            {languageOpen && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{t('settings.currency')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['TRY', 'USD', 'EUR', 'GBP', 'JPY'] as const).map((code) => (
                  <Pressable key={code} onPress={() => setCurrency(code)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: currency === code ? colors.primary : colors.border, backgroundColor: currency === code ? colors.primary + '20' : colors.surface, marginRight: 8, marginBottom: 8 }}>
                    <Text style={{ color: currency === code ? colors.primary : colors.text }}>{code}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('settings.currencySubtitle')}</Text>
            </View>
            )}

            {accountOpen && (
              <ScrollView 
                style={{ maxHeight: 400 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={{ padding: 16 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {t('settings.username') || 'Kullanıcı Adı'}
                  </Text>
                  <Input 
                    placeholder={t('settings.usernamePlaceholder') || 'Kullanıcı adınızı girin'} 
                    value={usernameInput} 
                    onChangeText={(text) => {
                      // @ işaretini kaldır ve sadece alfanumerik karakterler, alt çizgi ve tire bırak
                      const cleaned = text.replace('@', '').replace(/[^a-z0-9_-]/gi, '');
                      setUsernameInput(cleaned);
                    }} 
                    autoCapitalize="none" 
                    autoCorrect={false}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                    {t('settings.usernameInfo') || 'Kullanıcı adınız URL\'de görünecektir: save-all.com/u/kullaniciadi'}
                  </Text>
                </View>
              </ScrollView>
            )}

            {avatarModalOpen ? (
              <ScrollView style={{ maxHeight: 500 }}>
                {/* Avatar Preview */}
                <View style={{ 
                  alignItems: 'center', 
                  paddingVertical: 32,
                  paddingHorizontal: 24,
                }}>
                  <View style={{
                    position: 'relative',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 8,
                  }}>
                    {isUploadingAvatar ? (
                      <View style={{
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        backgroundColor: colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: colors.border,
                      }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                      </View>
                    ) : avatarUrl && !avatarImageFailedModal ? (
                      <Image
                        key={getAvatarUri(avatarUrl) || avatarUrl}
                        source={{ uri: getAvatarUri(avatarUrl) || fixImageUrlForEmulator(avatarUrl) }}
                        style={{
                          width: 120,
                          height: 120,
                          borderRadius: 60,
                          borderWidth: 3,
                          borderColor: colors.primary,
                        }}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="disk"
                        onError={(e) => {
                          console.warn('[SettingsScreen] Avatar (modal) load error', e?.error);
                          setAvatarImageFailedModal(true);
                        }}
                      />
                    ) : (
                      <View style={{
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        backgroundColor: colors.primary + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: colors.border,
                      }}>
                        <Ionicons name="person" size={48} color={colors.primary} />
                      </View>
                    )}
                    
                    {/* Edit Badge */}
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3,
                      borderColor: colors.surface,
                    }}>
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                  
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 18, 
                    fontWeight: '700', 
                    marginTop: 16,
                  }}>
                    {isUploadingAvatar 
                      ? (t('settings.uploading') || 'Yükleniyor...') 
                      : avatarUrl 
                        ? (t('settings.changeAvatar') || 'Avatar Değiştir') 
                        : (t('settings.addAvatar') || 'Avatar Ekle')
                    }
                  </Text>
                  <Text style={{ 
                    color: colors.textMuted, 
                    fontSize: 14, 
                    marginTop: 4,
                    textAlign: 'center',
                  }}>
                    {isUploadingAvatar
                      ? (t('settings.uploadingDesc') || 'Avatarınız yükleniyor, lütfen bekleyin...')
                      : avatarUrl 
                        ? (t('settings.avatarChangeDesc') || 'Profil fotoğrafınızı güncelleyin veya kaldırın')
                        : (t('settings.avatarAddDesc') || 'Profilinize bir fotoğraf ekleyin')
                    }
                  </Text>

                  {avatarFeedback && (
                    <View style={{
                      marginTop: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: avatarFeedback.type === 'success' ? (colors.primary + '20') : ('#FF3B3015'),
                      borderWidth: 1,
                      borderColor: avatarFeedback.type === 'success' ? (colors.primary + '55') : ('#FF3B3030'),
                    }}>
                      <Text style={{
                        color: avatarFeedback.type === 'success' ? colors.primary : '#FF3B30',
                        fontSize: 13,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}>
                        {avatarFeedback.text}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />

                {/* Options */}
                <View style={{ paddingVertical: 8, opacity: isUploadingAvatar ? 0.5 : 1 }}>
                  <Pressable
                    onPress={handleSelectPhoto}
                    disabled={isUploadingAvatar}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      backgroundColor: pressed ? colors.border + '40' : 'transparent',
                    })}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.primary + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}>
                      <Ionicons name="images-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                        {t('settings.selectPhoto') || 'Galeriden Seç'}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                        {t('settings.selectPhotoDesc') || 'Galerinizdeki mevcut bir fotoğrafı seçin'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>

                  <Pressable
                    onPress={handleTakePhoto}
                    disabled={isUploadingAvatar}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 20,
                      backgroundColor: pressed ? colors.border + '40' : 'transparent',
                    })}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.primary + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}>
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                        {t('settings.takePhoto') || 'Fotoğraf Çek'}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                        {t('settings.takePhotoDesc') || 'Kameranızla yeni bir fotoğraf çekin'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>

                  {avatarUrl && (
                    <>
                      {/* Divider */}
                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8, marginHorizontal: 20 }} />
                      
                      <Pressable
                        onPress={handleDeleteAvatar}
                        disabled={isUploadingAvatar}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 16,
                          paddingHorizontal: 20,
                          backgroundColor: pressed ? '#FF3B3010' : 'transparent',
                        })}
                      >
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: '#FF3B3015',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 16,
                        }}>
                          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#FF3B30', fontSize: 16, fontWeight: '600' }}>
                            {t('settings.deleteAvatar') || 'Avatar\'ı Kaldır'}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                            {t('settings.deleteAvatarDesc') || 'Mevcut profil fotoğrafınızı silin'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
                      </Pressable>
                    </>
                  )}
                </View>

                {/* Cancel Button */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 }}>
                  <Pressable 
                    onPress={() => setAvatarModalOpen(false)} 
                    style={({ pressed }) => ({ 
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.border : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                    })}
                  >
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                      {t('common.cancel') || 'İptal'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Pressable onPress={() => { setLanguageOpen(false); setAccountOpen(false); setAvatarModalOpen(false); }} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
                </Pressable>
              {languageOpen && (
                <Pressable onPress={handleSaveLanguages} style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10, marginLeft: 8 }}>
                  <Text style={{ color: colors.primaryTextOnPrimary, fontWeight: '600' }}>{t('common.save')}</Text>
                </Pressable>
              )}
              {accountOpen && (
                <Pressable onPress={async () => {
                  try {
                    const token = (await AsyncStorage.getItem('auth_token')) || '';
                    if (token) {
                      await updateUserPreferences(token, { 
                        uiLanguage: uiLang, 
                        aiLanguage: aiLang || 'en', 
                        username: usernameInput.trim() || null, // Username güncelleme
                        currency, 
                        isPrivateAccount,
                        avatarUrl: avatarUrl || null
                      });
                      // Username güncellendiğinde preferences'ı yeniden çek
                      const prefs = await fetchUserPreferences(token);
                      if (prefs?.username) {
                        setUsername(prefs.username);
                        setUsernameInput(prefs.username); // Input state'ini de güncelle
                      }
                    }
                    setAccountOpen(false);
                  } catch (error: any) {
                    console.error('Error updating user preferences:', error);
                    Alert.alert(t('common.error') || 'Hata', error.message || t('settings.updateError') || 'Ayarlar güncellenirken bir hata oluştu');
                  }
                }} style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10, marginLeft: 8 }}>
                  <Text style={{ color: colors.primaryTextOnPrimary, fontWeight: '600' }}>{t('common.save')}</Text>
                </Pressable>
              )}
            </View>
            )}
          </View>
          </KeyboardAvoidingView>
        </>
        )}

      </SafeAreaView>
    </View>
  );
};
