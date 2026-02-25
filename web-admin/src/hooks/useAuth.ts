'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { login, verifyEmail, getUserFromToken, getToken, removeToken, saveToken, UserInfo } from '@/lib/api/auth';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sayfa yüklendiğinde token'dan kullanıcı bilgilerini al
    const token = getToken();
    if (token) {
      const userInfo = getUserFromToken(token);
      if (userInfo && userInfo.isAdmin) {
        setUser(userInfo);
      } else {
        // Admin değilse token'ı sil
        removeToken();
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = useCallback(async (email: string) => {
    try {
      const response = await login(email);
      
      // Eğer token varsa direkt giriş yapıldı
      if (response.accessToken) {
        saveToken(response.accessToken);
        const userInfo = getUserFromToken(response.accessToken);
        if (userInfo && userInfo.isAdmin) {
          setUser(userInfo);
          router.push('/dashboard');
          return { success: true, needsVerification: false };
        } else {
          removeToken();
          return { success: false, error: 'Bu kullanıcı admin değil' };
        }
      }
      
      // Token yoksa verification gerekiyor
      return { success: true, needsVerification: true, message: response.message };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Giriş başarısız',
      };
    }
  }, [router]);

  const handleVerifyEmail = useCallback(async (email: string, code: string) => {
    try {
      const response = await verifyEmail(email, code);
      
      // Verification başarılı, token response'da geliyor
      if ((response as any).accessToken) {
        const token = (response as any).accessToken;
        saveToken(token);
        const userInfo = getUserFromToken(token);
        if (userInfo && userInfo.isAdmin) {
          setUser(userInfo);
          router.push('/dashboard');
          return { success: true };
        } else {
          removeToken();
          return { success: false, error: 'Bu kullanıcı admin değil' };
        }
      }
      
      return { success: false, error: 'Giriş başarısız' };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Doğrulama başarısız',
      };
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    removeToken();
    setUser(null);
    router.push('/login');
  }, [router]);

  return {
    user,
    loading,
    login: handleLogin,
    verifyEmail: handleVerifyEmail,
    logout: handleLogout,
    isAuthenticated: !!user,
  };
}
