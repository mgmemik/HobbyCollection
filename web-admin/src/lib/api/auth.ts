import apiClient from './client';

export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  message: string;
  accessToken?: string;
  code?: string; // Hata durumunda kod gösterilebilir
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  message: string;
  accessToken?: string;
}

export interface UserInfo {
  userId: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Admin login - Email verification gerektirir
 */
export async function login(email: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/api/auth/login', { email });
  return response.data;
}

/**
 * Email verification
 */
export async function verifyEmail(email: string, code: string): Promise<VerifyEmailResponse> {
  const response = await apiClient.post<VerifyEmailResponse>('/api/auth/verify-email', { email, code });
  return response.data;
}

/**
 * Token'ı decode ederek kullanıcı bilgilerini al
 */
export function getUserFromToken(token: string): UserInfo | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));

    return {
      userId: decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '',
      email: decoded.email || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
      isAdmin: decoded.isAdmin === 'true' || decoded.isAdmin === true,
    };
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

/**
 * Token'ı localStorage'a kaydet
 */
export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', token);
  }
}

/**
 * Token'ı localStorage'dan al
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_token');
  }
  return null;
}

/**
 * Token'ı localStorage'dan sil
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token');
  }
}

/**
 * Kullanıcının admin olup olmadığını kontrol et
 */
export function isAdmin(): boolean {
  const token = getToken();
  if (!token) return false;

  const user = getUserFromToken(token);
  return user?.isAdmin === true;
}
