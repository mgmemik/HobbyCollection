import { API_BASE_URL } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// expo-device paketi yoksa fallback kullan
let Device: any = null;
try {
  Device = require('expo-device');
} catch {
  // expo-device yoksa Device null kalacak
}

export interface DeviceInfo {
  platform: string;
  osVersion?: string;
  appVersion?: string;
  buildNumber?: string;
  deviceModel?: string;
  deviceManufacturer?: string;
  deviceName?: string;
  pushToken?: string;
  hasNotificationPermission?: boolean;
  notificationsEnabled?: boolean;
}

export interface MyDeviceInfo {
  id: string;
  platform: string;
  osVersion?: string;
  appVersion?: string;
  buildNumber?: string;
  deviceModel?: string;
  deviceManufacturer?: string;
  deviceName?: string;
  hasNotificationPermission: boolean;
  notificationsEnabled: boolean;
  hasPushToken: boolean;
  lastUpdatedUtc: string;
  createdAtUtc: string;
  isActive: boolean;
}

/**
 * Cihaz bilgilerini topla
 */
export async function collectDeviceInfo(
  pushToken?: string,
  hasNotificationPermission?: boolean,
  notificationsEnabled?: boolean
): Promise<DeviceInfo> {
  const platform = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Unknown';
  
  const deviceInfo: DeviceInfo = {
    platform,
    osVersion: Platform.Version?.toString(),
    appVersion: Constants.expoConfig?.version,
    buildNumber: Platform.OS === 'ios' 
      ? Constants.expoConfig?.ios?.buildNumber 
      : Constants.expoConfig?.android?.versionCode?.toString(),
    deviceModel: Device?.modelName || Platform.constants?.systemName || undefined,
    deviceManufacturer: Device?.manufacturer || (Platform.OS === 'ios' ? 'Apple' : Platform.OS === 'android' ? 'Google' : undefined),
    deviceName: Device?.deviceName || undefined,
    pushToken: pushToken,
    hasNotificationPermission: hasNotificationPermission,
    notificationsEnabled: notificationsEnabled,
  };

  return deviceInfo;
}

// Rate limiting için: Son başarısız güncelleme zamanını sakla
let lastFailedUpdateTime: number | null = null;
const UPDATE_RETRY_DELAY_MS = 30000; // 30 saniye - başarısız denemeden sonra bu kadar bekle

/**
 * Cihaz bilgilerini backend'e gönder
 */
export async function updateDeviceInfo(deviceInfo: DeviceInfo): Promise<void> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    // Token yoksa sessizce atla (log spam'ini önle)
    return;
  }

  // Expo Go'da device info güncelleme işlemini atla (network hatası spam'ini önle)
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    return; // Expo Go'da push token çalışmıyor, sessizce atla
  }

  // Rate limiting: Son başarısız denemeden sonra çok kısa sürede tekrar deneme
  const now = Date.now();
  if (lastFailedUpdateTime !== null && (now - lastFailedUpdateTime) < UPDATE_RETRY_DELAY_MS) {
    // Son başarısız denemeden 30 saniye geçmediyse atla
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/deviceinfo/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceInfo),
    });

    if (!response.ok) {
      // Hata oldu - rate limiting için zamanı kaydet
      lastFailedUpdateTime = now;
      // Sadece ilk hatada logla, sonraki hataları sessizce atla (spam'i önle)
      if (lastFailedUpdateTime === now) {
        const errorText = await response.text();
        console.error('[updateDeviceInfo] Failed to update device info:', response.status, errorText);
        console.log(`[updateDeviceInfo] Will retry after ${UPDATE_RETRY_DELAY_MS / 1000} seconds`);
      }
      return;
    }

    // Başarılı oldu - rate limiting'i sıfırla
    lastFailedUpdateTime = null;
    // Başarılı güncellemeleri loglamayı kaldırdık (spam'i önle)
  } catch (error) {
    // Hata oldu - rate limiting için zamanı kaydet
    lastFailedUpdateTime = now;
    // Sadece ilk hatada logla, sonraki hataları sessizce atla (spam'i önle)
    if (lastFailedUpdateTime === now) {
      console.error('[updateDeviceInfo] Error updating device info:', error);
      console.log(`[updateDeviceInfo] Will retry after ${UPDATE_RETRY_DELAY_MS / 1000} seconds`);
    }
  }
}

/**
 * Kullanıcının cihaz kayıtlarını getir
 */
export async function getMyDevices(): Promise<MyDeviceInfo[]> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/api/deviceinfo/my-devices`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data?.devices) ? (data.devices as MyDeviceInfo[]) : [];
}

/**
 * Cihaz bilgilerini topla ve gönder (kolay kullanım için)
 */
export async function collectAndSendDeviceInfo(
  pushToken?: string,
  hasNotificationPermission?: boolean,
  notificationsEnabled?: boolean
): Promise<void> {
  // Expo Go'da device info güncelleme işlemini atla (network hatası spam'ini önle)
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    return; // Expo Go'da push token çalışmıyor, sessizce atla
  }

  try {
    const deviceInfo = await collectDeviceInfo(pushToken, hasNotificationPermission, notificationsEnabled);
    await updateDeviceInfo(deviceInfo);
    // updateDeviceInfo içinde zaten rate limiting var, burada ekstra log yapmaya gerek yok
  } catch (error) {
    // updateDeviceInfo içinde zaten hata yönetimi var, burada ekstra log yapmaya gerek yok
    // Sessizce hata yakala (spam'i önle)
  }
}

