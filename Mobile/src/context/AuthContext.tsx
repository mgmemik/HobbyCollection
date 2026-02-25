import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateToken, isTokenExpired, getTokenExpiration } from '../api/auth';
import { ApiInterceptor } from '../api/interceptor';
import { checkNotificationPermissions, requestNotificationPermissionOnce, requestNotificationPermissionOnVersionUpdate } from '../utils/notifications';
import Constants from 'expo-constants';
import { collectAndSendDeviceInfo } from '../api/deviceInfo';

// Rate limiting için: Son başarısız deneme zamanını sakla
let lastFailedSyncTime: number | null = null;
const SYNC_RETRY_DELAY_MS = 60000; // 1 dakika - başarısız denemeden sonra bu kadar bekle

async function syncNotificationStateToBackend(label: string) {
  // Expo Go'da token güncelleme işlemini atla (sürekli hata veriyor)
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    return; // Expo Go'da push token çalışmıyor, sessizce atla
  }

  // Rate limiting: Son başarısız denemeden sonra çok kısa sürede tekrar deneme
  const now = Date.now();
  if (lastFailedSyncTime !== null && (now - lastFailedSyncTime) < SYNC_RETRY_DELAY_MS) {
    // Son başarısız denemeden 1 dakika geçmediyse atla
    return;
  }

  try {
    const result = await checkNotificationPermissions();
    await collectAndSendDeviceInfo(result.token || undefined, result.hasPermission);
    // Başarılı oldu - rate limiting'i sıfırla
    lastFailedSyncTime = null;
  } catch (e) {
    // Hata oldu - rate limiting için zamanı kaydet
    lastFailedSyncTime = now;
    // Sadece ilk hatada logla, sonraki hataları sessizce atla (spam'i önle)
    if (lastFailedSyncTime === now) {
      console.error(`[AuthContext] Failed to sync notification state (${label}):`, e);
      console.log(`[AuthContext] Will retry after ${SYNC_RETRY_DELAY_MS / 1000} seconds`);
    }
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  email: string | null;
  isLoading: boolean;
  login: (token: string, email: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    loadAuthState();
    // API interceptor callback'ini ayarla (logout useCallback olduğu için stable)
    ApiInterceptor.setLogoutCallback(logout);
  }, []); // logout'u dependency'den çıkardık

  const loadAuthState = async () => {
    try {
      setIsLoading(true);
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedEmail = await AsyncStorage.getItem('auth_email');
      const remember = await AsyncStorage.getItem('remember_me');
      
      // Remember me true ise veya token varsa yükle
      if (storedToken && storedEmail) {
        // Token expiration bilgisini logla (ama otomatik logout yapma - modern UX)
        const expiration = getTokenExpiration(storedToken);
        const expired = isTokenExpired(storedToken, 5); // 5 dakika tolerans
        
        if (expired && expiration) {
          console.warn(`Token expired. Expiration: ${expiration.toISOString()}, Now: ${new Date().toISOString()}`);
          console.log('Loading expired token anyway - API will handle 401 if truly invalid');
          // Modern uygulamalar (Instagram, WhatsApp, etc.) kullanıcıyı asla otomatik logout etmez
          // Token expired olsa bile yükle, gerçek validation API çağrılarında yapılacak
          // Sadece 401 response gelirse o zaman logout olacak
        }
        
        if (remember === '1') {
          // Remember me aktif - token'ı doğrula ama başarısız olsa bile sakla (geçici hata olabilir)
          try {
            const isValid = await validateToken(storedToken);
            if (isValid) {
              setToken(storedToken);
              setEmail(storedEmail);
              setIsAuthenticated(true);
              
              // Token expiration bilgisini logla
              if (expiration) {
                const daysRemaining = Math.floor((expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                console.log(`Token valid. Expires in ${daysRemaining} days (${expiration.toISOString()})`);
              }

              // Mevcut kullanıcılar için bir kerelik notification izni iste (asenkron, hata olsa bile devam et)
              if (!isExpoGo) {
                requestNotificationPermissionOnVersionUpdate().catch(err => {
                  console.error('[AuthContext] Failed to request notification permission on version update:', err);
                });
                // Her durumda backend’e izin/token durumunu senkronla
                void syncNotificationStateToBackend('remember-valid');
              }
            } else {
              // Geçersiz token ama remember me aktif - token'ı sakla, sadece state'i güncelleme
              // Kullanıcı tekrar deneyebilir veya token yenilenebilir
              console.warn('Token validation failed but remember me is active, keeping token');
              // Token'ı state'e yükle, API çağrıları başarısız olursa o zaman logout olur
              setToken(storedToken);
              setEmail(storedEmail);
              setIsAuthenticated(true);

              // Mevcut kullanıcılar için versiyon bazlı notification izni iste (asenkron, hata olsa bile devam et)
              if (!isExpoGo) {
                requestNotificationPermissionOnVersionUpdate().catch(err => {
                  console.error('[AuthContext] Failed to request notification permission on version update:', err);
                });
                void syncNotificationStateToBackend('remember-invalid');
              }
            }
          } catch (validationError) {
            // Validation hatası (network vs.) - remember me aktifse token'ı sakla
            console.warn('Token validation error but remember me is active, keeping token:', validationError);
            setToken(storedToken);
            setEmail(storedEmail);
            setIsAuthenticated(true);

            // Mevcut kullanıcılar için versiyon bazlı notification izni iste (asenkron, hata olsa bile devam et)
            if (!isExpoGo) {
              requestNotificationPermissionOnVersionUpdate().catch(err => {
                console.error('[AuthContext] Failed to request notification permission on version update:', err);
              });
            }
          }
        } else {
          // Remember me false - ama token expired değilse yükle
          // Client-side expiration kontrolü yeterli, server validation optional
          // Network hatası gibi geçici sorunlarda token'ı temizlememeli
          try {
            // Token validation'ı optional yap - başarısız olsa bile token'ı yükle
            // Sadece gerçekten geçersizse (401) API çağrıları sırasında logout olur
            const isValid = await validateToken(storedToken).catch(() => {
              // Validation hatası (network vs.) - token'ı yine de yükle
              // API çağrıları sırasında gerçekten geçersizse logout olur
              console.warn('Token validation failed (network error?), loading token anyway');
              return true; // Token'ı yükle, gerçek validation API çağrılarında yapılacak
            });
            
            if (isValid) {
              setToken(storedToken);
              setEmail(storedEmail);
              setIsAuthenticated(true);
              
              // Token expiration bilgisini logla
              if (expiration) {
                const hoursRemaining = Math.floor((expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60));
                console.log(`Token loaded. Expires in ${hoursRemaining} hours (${expiration.toISOString()})`);
              }

              // Mevcut izin durumunu kontrol et ve device info'yu güncelle (remember me false olsa bile)
              if (!isExpoGo) {
                void syncNotificationStateToBackend('remember-false');
              }
            } else {
              // Token gerçekten geçersiz (401 response) - temizle
              console.warn('Token validation returned false - clearing token');
              await AsyncStorage.multiRemove(['auth_token', 'auth_email']);
            }
          } catch (validationError: any) {
            // Validation hatası (network vs.) - token'ı yine de yükle
            // Geçici network sorunları token'ı temizlememeli
            console.warn('Token validation error but token not expired - loading token anyway:', validationError?.message);
            // Token expired değilse ve validation hatası varsa token'ı yükle
            // Gerçek validation API çağrılarında yapılacak
            setToken(storedToken);
            setEmail(storedEmail);
            setIsAuthenticated(true);
          }
        }
      }
    } catch (error) {
      console.error('Auth state loading error:', error);
      // Hata durumunda token'ı temizleme - geçici hatalar olabilir
      // Token varsa ve expired değilse yükle
      try {
        const storedToken = await AsyncStorage.getItem('auth_token');
        const storedEmail = await AsyncStorage.getItem('auth_email');
        const remember = await AsyncStorage.getItem('remember_me');
        
        if (storedToken && storedEmail) {
          const expiration = getTokenExpiration(storedToken);
          const expired = isTokenExpired(storedToken, 5);
          
          // Token expired değilse yükle (remember me kontrolü yapmadan)
          if (!expired) {
            console.log('Loading token despite error - token not expired');
            setToken(storedToken);
            setEmail(storedEmail);
            setIsAuthenticated(true);
          } else if (remember === '1') {
            // Remember me aktif ve expired - yine de yükle (kullanıcı yeniden login yapabilir)
            console.log('Loading token despite expiration - remember me is active');
            setToken(storedToken);
            setEmail(storedEmail);
            setIsAuthenticated(true);

            // Mevcut kullanıcılar için versiyon bazlı notification izni iste (asenkron, hata olsa bile devam et)
            if (!isExpoGo) {
              requestNotificationPermissionOnVersionUpdate().catch(err => {
                console.error('[AuthContext] Failed to request notification permission on version update:', err);
              });
            }
          }
        }
      } catch (innerError) {
        console.error('Error loading token after main error:', innerError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string, newEmail: string, remember: boolean) => {
    setToken(newToken);
    setEmail(newEmail);
    setIsAuthenticated(true);

    await AsyncStorage.setItem('auth_token', newToken);
    await AsyncStorage.setItem('auth_email', newEmail);
    
    if (remember) {
      await AsyncStorage.setItem('remember_me', '1');
    } else {
      await AsyncStorage.removeItem('remember_me');
    }

    // Mevcut kullanıcılar için versiyon bazlı notification izni iste (asenkron, hata olsa bile devam et)
    if (!isExpoGo) {
      requestNotificationPermissionOnVersionUpdate().catch(err => {
        console.error('[AuthContext] Failed to request notification permission on version update:', err);
      });
    }
  };

  const logout = useCallback(async () => {
    setToken(null);
    setEmail(null);
    setIsAuthenticated(false);

    try {
      // Remember me kontrolü yap
      const remember = await AsyncStorage.getItem('remember_me');
      
      if (remember === '1') {
        // Remember me aktif - token ve email'i sakla, sadece state'i temizle
        // Kullanıcı uygulamayı yeniden açtığında otomatik giriş yapabilir
        console.log('Logout but remember me is active - keeping credentials in storage');
        // Token ve email AsyncStorage'da kalıyor, sadece state temizleniyor
      } else {
        // Remember me false - her şeyi temizle
        await AsyncStorage.multiRemove(['auth_token', 'remember_me', 'auth_email']);
        console.log('Logout - cleared all credentials');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Hata durumunda güvenli tarafta kal - her şeyi temizle
      await AsyncStorage.multiRemove(['auth_token', 'remember_me', 'auth_email']);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      token,
      email,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
