import { Platform } from 'react-native';

// Tercih sırası:
// 1) EXPO_PUBLIC_API_BASE_URL (prod veya fiziksel cihazlar için)
// 2) Production URL (https://api.save-all.com)
// 3) iOS Simulator: localhost:5015
// 4) Android Emulator: 10.0.2.2:5015
// 5) LAN fallback: 192.168.68.140:5015 (gerekirse kendi IP'nizle değiştirin)
const DEFAULT_PORT = 5015;
const LAN_FALLBACK = `http://192.168.68.140:${DEFAULT_PORT}`;
const PRODUCTION_API_URL = 'https://api.save-all.com';

// __DEV__ Expo'nun development modunu kontrol eder
const isDevelopment = __DEV__;

// API URL konfigürasyonu:
// 1) EXPO_PUBLIC_API_BASE_URL varsa onu kullan (override)
// 2) Development modunda:
//    - iOS Simulator: localhost
//    - Android Emulator: 10.0.2.2 (standart)
// 3) Production modunda: Production API
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (!isDevelopment
    ? PRODUCTION_API_URL
    : Platform.OS === 'ios'
      ? `http://localhost:${DEFAULT_PORT}`
      : `http://10.0.2.2:${DEFAULT_PORT}`);

// Log API URL'i
console.log('=== API CONFIGURATION ===');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
console.log('PRODUCTION_API_URL:', PRODUCTION_API_URL);
console.log('Platform:', Platform.OS);
console.log('__DEV__:', __DEV__);
console.log('isDevelopment:', isDevelopment);
console.log(
  'Selected URL Type:',
  !isDevelopment
    ? 'PRODUCTION'
    : Platform.OS === 'ios'
      ? 'iOS LOCALHOST'
      : 'ANDROID EMULATOR (10.0.2.2)'
);

async function http<T>(path: string, body?: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function register(email: string): Promise<{ message: string }> {
  return http('/api/auth/register', { email });
}

export async function verifyEmail(
  email: string, 
  code: string, 
  appVersion?: string
): Promise<{ message: string; accessToken?: string; requiresUpdate?: boolean; currentVersion?: string }> {
  return http('/api/auth/verify-email', { email, code, appVersion });
}

export async function login(email: string, rememberMe: boolean = false): Promise<{ message: string; accessToken?: string }> {
  return http('/api/auth/login', { email, rememberMe });
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    // API interceptor'ı bypass etmek için direkt original fetch kullan
    const originalFetch = (global as any).originalFetch || global.fetch;
    const res = await originalFetch(`${API_BASE_URL}/api/products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return res.ok;
  } catch (e: any) {
    // Network hatası gibi geçici hatalarda false döndürme
    // Bu, token'ın temizlenmesine neden olmamalı
    console.warn('Token validation error (network?):', e?.message);
    // Network hatası durumunda true döndür (token geçerli kabul et)
    // Gerçek validation API çağrılarında yapılacak
    if (e?.message?.includes('Network request failed') || e?.message?.includes('timeout')) {
      return true; // Network hatası - token'ı geçerli kabul et
    }
    return false; // Diğer hatalar için false döndür
  }
}

export interface TokenInfo {
  valid: boolean;
  expiresAt: string;
  expiresAtLocal: string;
  timeRemainingMinutes: number;
  timeRemainingDays: number;
}

export async function checkTokenExpiration(token: string): Promise<TokenInfo | null> {
  try {
    const originalFetch = (global as any).originalFetch || global.fetch;
    const res = await originalFetch(`${API_BASE_URL}/api/auth/check-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      return await res.json() as TokenInfo;
    }
    return null;
  } catch (e) {
    console.error('Token expiration check failed:', e);
    return null;
  }
}

/**
 * Base64 decode helper for React Native
 * React Native'de atob mevcut değilse, manuel decode yapar
 */
export function base64Decode(str: string): string {
  try {
    // Base64 URL-safe karakterleri düzelt
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Padding ekle
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // React Native'de global atob varsa kullan
    if (typeof global !== 'undefined' && (global as any).atob) {
      return (global as any).atob(base64);
    }
    
    // Web ortamında atob kullan
    if (typeof atob !== 'undefined') {
      return atob(base64);
    }
    
    // Fallback: React Native için basit base64 decode
    // Not: Bu sadece ASCII karakterler için çalışır
    // Production'da daha güvenilir bir çözüm (expo-crypto veya benzeri) kullanılmalı
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    
    for (let i = 0; i < base64.length; i += 4) {
      const enc1 = chars.indexOf(base64.charAt(i));
      const enc2 = chars.indexOf(base64.charAt(i + 1));
      const enc3 = chars.indexOf(base64.charAt(i + 2));
      const enc4 = chars.indexOf(base64.charAt(i + 3));
      
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    
    return output;
  } catch (e) {
    console.error('Base64 decode error:', e);
    throw e;
  }
}

/**
 * JWT token'ın expiration claim'ini decode eder
 * Token'ın süresini kontrol etmek için kullanılır
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // JWT payload'ı decode et (base64)
    const payload = parts[1];
    const decodedStr = base64Decode(payload);
    const decoded = JSON.parse(decodedStr);

    if (decoded.exp) {
      // exp Unix timestamp (seconds), Date constructor milliseconds bekler
      return new Date(decoded.exp * 1000);
    }

    return null;
  } catch (e) {
    console.error('Failed to decode token expiration:', e);
    return null;
  }
}

/**
 * Token'ın süresinin dolup dolmadığını kontrol eder
 * 5 dakika tolerans verir (clock skew için)
 */
export function isTokenExpired(token: string, toleranceMinutes: number = 5): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true; // Decode edilemezse expired kabul et
  }

  const now = new Date();
  const tolerance = toleranceMinutes * 60 * 1000; // milliseconds
  return expiration.getTime() - now.getTime() < tolerance;
}

export type SearchUser = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  email?: string;
  followerCount: number;
  followingCount: number;
  productCount: number;
  isFollowing: boolean;
  isPrivateAccount: boolean;
  isOwnProfile: boolean;
};

export type SearchUsersResponse = {
  users: SearchUser[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export async function searchUsers(
  query?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchUsersResponse> {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  
  // Token'ı al (varsa)
  let token: string | null = null;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // Uygulamadaki standart key: auth_token
    token = await AsyncStorage.getItem('auth_token');
  } catch (e) {
    // Token yoksa anonymous arama yapılabilir
  }
  
  const res = await fetch(`${API_BASE_URL}/api/auth/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  const data = await res.json();
  // Backend camelCase döndürüyor ama güvenli olmak için normalize edelim.
  return {
    ...data,
    users: (data?.users || []).map((u: any) => ({
      userId: u.userId ?? u.UserId,
      displayName: u.displayName ?? u.DisplayName ?? 'User',
      avatarUrl: u.avatarUrl ?? u.AvatarUrl ?? null,
      email: u.email ?? u.Email,
      followerCount: u.followerCount ?? u.FollowerCount ?? 0,
      followingCount: u.followingCount ?? u.FollowingCount ?? 0,
      productCount: u.productCount ?? u.ProductCount ?? 0,
      isFollowing: u.isFollowing ?? u.IsFollowing ?? false,
      isPrivateAccount: u.isPrivateAccount ?? u.IsPrivateAccount ?? false,
      isOwnProfile: u.isOwnProfile ?? u.IsOwnProfile ?? false,
    })),
  };
}

async function getStoredToken(): Promise<string | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem('authToken');
  } catch (e) {
    return null;
  }
}

