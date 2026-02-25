import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { collectAndSendDeviceInfo } from '../api/deviceInfo';
import Constants from 'expo-constants';
import { navigate, runWhenNavigationReady } from '../navigation/navigationRef';
import AsyncStorage from '@react-native-async-storage/async-storage';

let warnedExpoGoToken = false;

function shouldAttemptExpoPushToken(): boolean {
  // Expo Go ortamında token alma çoğunlukla hata spam'ine neden oluyor.
  // Prod/dev-build'da çalışacak; burada sessizce skip edelim.
  const isExpoGo = Constants.appOwnership === 'expo';
  
  // isDevice undefined olabilir, bu durumda production build varsayalım
  // Sadece Expo Go ise token almayı atla
  return !isExpoGo;
}

// Notification handler configuration
// Expo Go + simulator ortamında expo-notifications bazen çok fazla warning üretebiliyor.
// Push testini dev-build'da yapacağız; burada handler'ı kurmadan geçmek spam'i azaltır.
if (shouldAttemptExpoPushToken()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Push notification izni iste ve token al
 * Bir sonraki sürümde kullanılacak
 */
export async function requestNotificationPermissions(): Promise<{
  granted: boolean;
  token: string | null;
  hasPermission: boolean;
}> {
  try {
    // iOS için özel izin isteği
    if (Platform.OS === 'ios') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return {
          granted: false,
          token: null,
          hasPermission: false,
        };
      }
    } else {
      // Android için izin kontrolü
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('[Notifications] Permission not granted');
          return {
            granted: false,
            token: null,
            hasPermission: false,
          };
        }
      }
    }

    // Android: notification channel tanımla (bazı cihazlarda bildirim davranışını stabilize eder)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch (e) {
        console.log('[Notifications] Failed to set Android notification channel (non-fatal):', e);
      }
    }

    // Token al (Expo Go / simulator'da hata spam'ini engelle)
    if (!shouldAttemptExpoPushToken()) {
      if (!warnedExpoGoToken) {
        warnedExpoGoToken = true;
        console.log('[Notifications] Skipping Expo push token in Expo Go / simulator. Use a dev build for push testing.');
      }
      return { granted: true, token: null, hasPermission: true };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '104221e6-35b6-4482-8e0f-1465263aaf52', // EAS project ID from app.json
    });

    const token = tokenData.data;

    console.log('[Notifications] Push token obtained:', token);

    // Device info'yu güncelle (token ile birlikte)
    await collectAndSendDeviceInfo(token, true).catch(err => {
      console.error('[Notifications] Failed to send device info with token:', err);
    });

    return {
      granted: true,
      token,
      hasPermission: true,
    };
  } catch (error) {
    console.error('[Notifications] Error requesting permissions:', error);
    return {
      granted: false,
      token: null,
      hasPermission: false,
    };
  }
}

// Rate limiting için: Son başarısız token alma zamanını sakla
let lastFailedTokenTime: number | null = null;
const TOKEN_RETRY_DELAY_MS = 60000; // 1 dakika - başarısız denemeden sonra bu kadar bekle

/**
 * Mevcut notification iznini kontrol et
 */
export async function checkNotificationPermissions(): Promise<{
  hasPermission: boolean;
  token: string | null;
}> {
  // Expo Go'da token alma işlemini tamamen atla (sürekli hata veriyor)
  if (!shouldAttemptExpoPushToken()) {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return {
        hasPermission: status === 'granted',
        token: null, // Expo Go'da token yok
      };
    } catch (error) {
      // Sessizce hata döndür
      return {
        hasPermission: false,
        token: null,
      };
    }
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    const hasPermission = status === 'granted';

    let token: string | null = null;
    if (hasPermission) {
      // Rate limiting: Son başarısız denemeden sonra çok kısa sürede tekrar deneme
      const now = Date.now();
      if (lastFailedTokenTime !== null && (now - lastFailedTokenTime) < TOKEN_RETRY_DELAY_MS) {
        // Son başarısız denemeden 1 dakika geçmediyse token alma işlemini atla
        return {
          hasPermission,
          token: null,
        };
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '104221e6-35b6-4482-8e0f-1465263aaf52',
        });
        token = tokenData.data;
        // Başarılı oldu - rate limiting'i sıfırla
        lastFailedTokenTime = null;
      } catch (err) {
        // Token alamadı - rate limiting için zamanı kaydet
        const errorTime = Date.now();
        lastFailedTokenTime = errorTime;
        // Sadece ilk hatada logla, sonraki hataları sessizce atla (spam'i önle)
        if (lastFailedTokenTime === errorTime) {
          console.log('[Notifications] Failed to get Expo push token. Will retry later. Error:', (err as any)?.message || err);
        }
        // Token null kalacak, hasPermission true olarak dönecek
      }
    }

    return {
      hasPermission,
      token,
    };
  } catch (error) {
    // Sessizce hata döndür (spam'i önle)
    return {
      hasPermission: false,
      token: null,
    };
  }
}

/**
 * Notification listener'ları kur (bir sonraki sürümde kullanılacak)
 */
export function setupNotificationListeners() {
  // Foreground notification handler
  Notifications.addNotificationReceivedListener(notification => {
    console.log('[Notifications] Notification received:', notification);
    // Burada notification gösterimi yapılacak
  });

  const MAX_COLDSTART_AGE_MS = 15_000; // uygulama icon ile açıldığında eski response yüzünden yanlış yönlendirmeyi engelle
  const LAST_HANDLED_KEY = 'last_handled_notification_response';

  async function handleResponse(
    response: Notifications.NotificationResponse | null,
    source: 'tap' | 'coldStart'
  ) {
    if (!response) return;
    try {
      // Cold start'ta çok eski response'ları ignore et (Android'de son response cache'lenmiş olabiliyor)
      if (source === 'coldStart') {
        const notifDateMs = response.notification?.date ? response.notification.date * 1000 : 0;
        if (notifDateMs && Date.now() - notifDateMs > MAX_COLDSTART_AGE_MS) {
          console.log('[Notifications] Ignoring old cold-start notification response');
          return;
        }

        const requestId = response.notification?.request?.identifier || '';
        const signature = `${requestId}:${notifDateMs}:${response.actionIdentifier || ''}`;
        const lastHandled = await AsyncStorage.getItem(LAST_HANDLED_KEY);
        if (lastHandled && lastHandled === signature) {
          console.log('[Notifications] Cold-start response already handled, skipping');
          return;
        }
        await AsyncStorage.setItem(LAST_HANDLED_KEY, signature);
      }

      const data: any = response.notification?.request?.content?.data || {};
      const type = String(data.type || '');

      // Backend payload standardı:
      // type, productId, userId, conversationId, otherUserDisplayName, otherUserAvatarUrl
      const productId = data.productId ? String(data.productId) : null;
      const commentId = data.commentId ? String(data.commentId) : null;

      // Ürün ile ilgili bildirimler
      if ((type === 'product_like' || type === 'comment' || type === 'comment_like' || type === 'new_product') && productId) {
        navigate('ProductDetail', {
          productId,
          openComments: type === 'comment' || type === 'comment_like',
          focusCommentId: commentId || undefined,
        });
        return;
      }

      // Kredi bildirimi
      if (type === 'ai_credit_charged') {
        navigate('AICreditsDetail', undefined as any);
        return;
      }

      // Takip isteği: aksiyon (kabul/ret) için en güvenlisi Bildirimler ekranı
      if (type === 'follow_request') {
        navigate('Notifications', undefined as any);
        return;
      }

      if ((type === 'follow' || type === 'follow_request' || type === 'follow_request_accepted') && data.userId) {
        navigate('UserProfile', { userId: String(data.userId) });
        return;
      }

      if (type === 'message' && data.conversationId && data.userId) {
        const otherUserDisplayName = String(data.otherUserDisplayName || 'User');
        const otherUserAvatarUrl = data.otherUserAvatarUrl ? String(data.otherUserAvatarUrl) : null;
        navigate('Chat', {
          conversationId: String(data.conversationId),
          otherUserId: String(data.userId),
          otherUserDisplayName,
          otherUserAvatarUrl,
        });
        return;
      }

      // Tanınmayan payload'da otomatik yönlendirme yapma.
      // (Android'de eski response cache'i yüzünden uygulama açılır açılmaz yanlış ekrana gitmeye sebep olabiliyor.)
    } catch (e) {
      console.warn('[Notifications] Failed to handle notification response:', e);
    }
  }

  // Notification tap handler
  Notifications.addNotificationResponseReceivedListener(response => {
    console.log('[Notifications] Notification tapped:', response);
    runWhenNavigationReady(() => {
      void handleResponse(response, 'tap');
    });
  });

  // Cold start: uygulama bildirim tıklamasıyla açıldıysa yakala
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      runWhenNavigationReady(() => {
        void handleResponse(response, 'coldStart');
      });
    })
    .catch((err) => {
      console.warn('[Notifications] getLastNotificationResponseAsync error:', err);
    });
}

/**
 * Bir kerelik notification izni iste (mevcut kullanıcılar için)
 * AsyncStorage'da flag kontrolü yapar, daha önce sorulmadıysa izin ister
 */
export async function requestNotificationPermissionOnce(): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const FLAG_KEY = 'notification_permission_asked_v1';
    
    // Daha önce soruldu mu kontrol et
    const alreadyAsked = await AsyncStorage.getItem(FLAG_KEY);
    if (alreadyAsked === 'true') {
      console.log('[Notifications] Permission already asked, skipping');
      return;
    }

    // Mevcut izni kontrol et
    const currentPermission = await checkNotificationPermissions();
    if (currentPermission.hasPermission) {
      // Zaten izin varsa flag'i kaydet ve çık
      await AsyncStorage.setItem(FLAG_KEY, 'true');
      console.log('[Notifications] Permission already granted, marking as asked');
      return;
    }

    // İzin iste
    console.log('[Notifications] Requesting permission for existing user (one-time)');
    const result = await requestNotificationPermissions();
    
    // Flag'i kaydet (izin verilse de verilmese de)
    await AsyncStorage.setItem(FLAG_KEY, 'true');
    
    if (result.granted && result.token) {
      console.log('[Notifications] Permission granted for existing user');
      // Token ile device info güncelle
      await collectAndSendDeviceInfo(result.token, result.hasPermission).catch(err => {
        console.error('[Notifications] Failed to send device info:', err);
      });
    } else {
      console.log('[Notifications] Permission denied for existing user');
    }
  } catch (error) {
    console.error('[Notifications] Error in requestNotificationPermissionOnce:', error);
    // Hata olsa bile devam et, kullanıcı deneyimini bozma
  }
}

/**
 * Her versiyon yüklendiğinde notification izni vermeyen kullanıcılara bir kere daha izin iste
 * Versiyon bazlı kontrol yapar - her yeni versiyonda bir kere daha izin ister
 */
export async function requestNotificationPermissionOnVersionUpdate(): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const Constants = require('expo-constants').default;
    const Application = require('expo-application').default;
    
    // Mevcut app versiyonunu al (Simulator'da Application/ nativeApplicationVersion bazen undefined olabiliyor)
    const currentVersion = Application?.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown';
    const VERSION_KEY = 'notification_permission_last_asked_version';
    
    // Son sorulan versiyonu kontrol et
    const lastAskedVersion = await AsyncStorage.getItem(VERSION_KEY);
    
    // Eğer versiyon değişmediyse, zaten bu versiyonda sorulmuş demektir
    if (lastAskedVersion === currentVersion) {
      console.log(`[Notifications] Permission already asked for version ${currentVersion}, skipping`);
      return;
    }
    
    // Mevcut izni kontrol et
    const currentPermission = await checkNotificationPermissions();
    
    // Eğer zaten izin varsa, versiyonu kaydet ve çık
    if (currentPermission.hasPermission) {
      await AsyncStorage.setItem(VERSION_KEY, currentVersion);
      console.log(`[Notifications] Permission already granted, marking version ${currentVersion} as asked`);
      return;
    }
    
    // İzin yoksa, yeni versiyon için bir kere daha izin iste
    console.log(`[Notifications] New version detected (${currentVersion}), requesting permission again`);
    const result = await requestNotificationPermissions();
    
    // Versiyonu kaydet (izin verilse de verilmese de)
    await AsyncStorage.setItem(VERSION_KEY, currentVersion);
    
    if (result.granted && result.token) {
      console.log(`[Notifications] Permission granted for version ${currentVersion}`);
      // Token ile device info güncelle
      await collectAndSendDeviceInfo(result.token, result.hasPermission).catch(err => {
        console.error('[Notifications] Failed to send device info:', err);
      });
    } else {
      console.log(`[Notifications] Permission denied for version ${currentVersion}`);
    }
  } catch (error) {
    console.error('[Notifications] Error in requestNotificationPermissionOnVersionUpdate:', error);
    // Hata olsa bile devam et, kullanıcı deneyimini bozma
  }
}

