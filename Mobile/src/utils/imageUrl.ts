import { Platform } from 'react-native';
import { API_BASE_URL } from '../api/auth';
import Constants from 'expo-constants';

let loggedProxyRewriteOnce = false;

/**
 * Android emülatörde localhost çalışmadığı için URL'leri dönüştürür
 * Development modunda ve Android emülatörde localhost:5015 -> 10.0.2.2:5015
 * iOS simulator'da (ve bazı ağ kısıtlı ortamlarda) dış internet/DNS sorunları olabildiği için
 * GCS (storage.googleapis.com) görsellerini backend üzerinden proxy'ler: /api/imageproxy/{blobPath}
 */
export function fixImageUrlForEmulator(url: string): string {
  if (!url) return url;

  // Sadece iOS SIMULATOR + dev modda GCS URL'lerini backend proxy'sine çevir.
  // Canlıda (standalone) ve gerçek cihazlarda GCS'ye direkt gidilsin.
  // Not: Expo Go'da bazı SDK'larda Constants.isDevice undefined olabiliyor.
  // Bu yüzden ek bir sinyal olarak API_BASE_URL'nin localhost olmasını da kullanıyoruz.
  const isDeviceFlag = (Constants as any).isDevice;
  const isIosSimulator =
    Platform.OS === 'ios' &&
    (isDeviceFlag === false || (typeof isDeviceFlag === 'undefined' && API_BASE_URL.includes('localhost')));

  if (
    __DEV__ &&
    isIosSimulator &&
    (url.startsWith('https://storage.googleapis.com/') || url.startsWith('http://storage.googleapis.com/'))
  ) {
    try {
      const u = new URL(url);
      // pathname: /{bucket}/{blobPath...}
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        // const bucket = parts[0]; // bucket adı (backend kendi config'indekini kullanıyor)
        const blobPath = parts.slice(1).join('/');
        const encodedBlobPath = blobPath
          .split('/')
          .map(seg => encodeURIComponent(seg))
          .join('/');
        const proxied = `${API_BASE_URL}/api/imageproxy/${encodedBlobPath}`;
        if (!loggedProxyRewriteOnce) {
          loggedProxyRewriteOnce = true;
          console.log('[ImageProxy] Rewriting GCS URL to backend proxy:', proxied);
        }
        return proxied;
      }
    } catch {
      // fallthrough
    }
  }

  // Development modunda değilse değiştirme
  if (!__DEV__) return url;

  // Android emülatörde localhost'u 10.0.2.2'ye dönüştür
  if (Platform.OS === 'android' && url.includes('localhost:5015')) {
    return url.replace('localhost:5015', '10.0.2.2:5015');
  }

  return url;
}

