import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { requestNotificationPermissions, checkNotificationPermissions } from '../utils/notifications';
import { collectAndSendDeviceInfo, getMyDevices } from '../api/deviceInfo';
import { useToast } from '../components/ui/Toast';
import { useCallback } from 'react';

export const NotificationSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const toast = useToast();

  // OS izin durumu (telefon ayarı)
  const [hasOsNotificationPermission, setHasOsNotificationPermission] = useState<boolean>(false);
  // Uygulama içi ayar (DB'ye yazılacak, push gönderimi buna göre yapılacak)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Check notification permission on mount and when screen is focused
  const checkPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await checkNotificationPermissions();
      setHasOsNotificationPermission(result.hasPermission);
      // OS izin durumunu backend'e gönder (uygulama içi ayarı değiştirmeden)
      await collectAndSendDeviceInfo(result.token || undefined, result.hasPermission, undefined).catch(err => {
        console.error('[NotificationSettingsScreen] Failed to update device info:', err);
      });

      // DB'deki uygulama içi ayarı çek (en güncel cihaz kaydı genelde bu cihaz olur)
      try {
        const devices = await getMyDevices();
        const platformName = Platform.OS === 'ios' ? 'iOS' : 'Android';
        const current = devices.find(d => d.platform === platformName) || devices[0];
        if (current && typeof current.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(current.notificationsEnabled);
        }
      } catch (e) {
        // sessiz geç: UI default değerle devam eder
      }
    } catch (err) {
      console.error('[NotificationSettingsScreen] Failed to check notification permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useFocusEffect(
    useCallback(() => {
      checkPermission();
    }, [checkPermission])
  );

  const handleToggleNotification = async (enabled: boolean) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      
      // Expo Go'da push token kısıtlı olduğu için bilgilendir
      if (isExpoGo && enabled) {
        Alert.alert(
          t('settings.notifications') || 'Bildirimler',
          t('settings.pushInfoLimited') ||
            'Bu ortamda push token alma kısıtlı. Push bildirimlerini test etmek için development/production build kullanacağız. Canlı uygulamada bu alan normal çalışır.',
          [{ text: 'OK' }]
        );
        setIsUpdating(false);
        return;
      }

      if (enabled) {
        // Uygulama içi ayarı AÇ (önce UI + DB)
        setNotificationsEnabled(true);

        // Bildirimleri açarken OS iznini de kontrol et / iste
        const result = await requestNotificationPermissions();
        setHasOsNotificationPermission(result.hasPermission);

        // Token ile device info güncelle (DB: notificationsEnabled=true)
        await collectAndSendDeviceInfo(result.token || undefined, result.hasPermission, true);

        if (result.granted) {
          toast.show({
            type: 'success',
            message: t('settings.notifications') || 'Bildirimler',
            subMessage: t('settings.notificationPermissionGranted') || 'Bildirim izni verildi! Artık push bildirimleri alabileceksiniz.',
          });
        } else {
          // İzin reddedildi / kapalı: kullanıcıyı doğru yere yönlendir
          Alert.alert(
            t('settings.notifications') || 'Bildirimler',
            t('settings.notificationPermissionDenied') || 'Bildirim izni verilmedi. Bildirim almak için telefon ayarlarından izin vermelisiniz.',
            [
              { text: t('common.cancel') || 'İptal', style: 'cancel' },
              { text: t('settings.openSettings') || 'Ayarları Aç', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } else {
        // Uygulama içi ayarı KAPAT (telefon ayarından bağımsız)
        setNotificationsEnabled(false);

        // DB'ye kapalı yaz (OS izin durumunu aynen koru)
        const checkResult = await checkNotificationPermissions();
        setHasOsNotificationPermission(checkResult.hasPermission);
        await collectAndSendDeviceInfo(checkResult.token || undefined, checkResult.hasPermission, false).catch(err => {
          console.error('[NotificationSettingsScreen] Failed to update device info when disabling:', err);
        });

        toast.show({
          type: 'info',
          message: t('settings.notifications') || 'Bildirimler',
          subMessage: t('settings.notificationDisabled') || 'Bildirimler kapatıldı.',
        });
      }
    } catch (error: any) {
      console.error('[NotificationSettingsScreen] Failed to toggle notification:', error);
      
      // Hata durumunda da mevcut izin durumunu kontrol et ve güncelle
      checkNotificationPermissions()
        .then(checkResult => {
          setHasOsNotificationPermission(checkResult.hasPermission);
          collectAndSendDeviceInfo(checkResult.token || undefined, checkResult.hasPermission, notificationsEnabled).catch(err => {
            console.error('[NotificationSettingsScreen] Failed to update device info after error:', err);
          });
        })
        .catch(() => {
          // Son çare: false olarak gönder
          collectAndSendDeviceInfo(undefined, false, notificationsEnabled).catch(() => {});
        });
      
      toast.show({
        type: 'error',
        message: t('settings.notifications') || 'Bildirimler',
        subMessage: error.message || t('settings.notificationError') || 'Bildirim ayarı güncellenirken bir hata oluştu.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const SettingItem: React.FC<{
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    showArrow?: boolean;
  }> = ({ icon, title, subtitle, onPress, rightComponent, showArrow = true }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 20,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        pressed && { backgroundColor: colors.inputBg, opacity: 0.7 },
      ]}
    >
      <View style={{ width: 40, alignItems: 'center', marginRight: 12 }}>
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightComponent && <View style={{ marginRight: 8 }}>{rightComponent}</View>}
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle={colors.text === '#000' ? 'dark-content' : 'light-content'} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={colors.text === '#000' ? 'dark-content' : 'light-content'} />
      
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ padding: 8, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 }}>
          {t('settings.notifications') || 'Bildirimler'}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Notification Toggle */}
        <View style={{ marginTop: 16 }}>
          <SettingItem
            icon={notificationsEnabled ? "notifications" : "notifications-outline"}
            title={t('settings.notifications') || 'Bildirimler'}
            subtitle={notificationsEnabled 
              ? (t('settings.notificationsEnabled') || 'Bildirimler açık')
              : (t('settings.notificationsDisabled') || 'Bildirimler kapalı')
            }
            onPress={() => handleToggleNotification(!notificationsEnabled)}
            rightComponent={
              isUpdating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotification}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={notificationsEnabled ? colors.primary : colors.textMuted}
                />
              )
            }
            showArrow={false}
          />
        </View>

        {/* Info Section */}
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View style={{
            backgroundColor: colors.inputBg,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Ionicons name="information-circle" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 }}>
                {t('settings.notificationInfoTitle') || 'Bildirim Ayarları Hakkında'}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 20 }}>
              {t('settings.notificationInfoDescription') || 
                'Bildirimleri açtığınızda, takip istekleri, beğeniler, yorumlar ve mesajlar hakkında anında bilgilendirileceksiniz. Bildirimleri kapatmak için telefon ayarlarından devre dışı bırakabilirsiniz.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

