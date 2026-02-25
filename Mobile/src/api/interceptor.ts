import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from './auth';

// Axios instance oluştur
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Token ekle
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - 401 handling
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log('401 Unauthorized - Token expired or invalid');
      // AuthContext'teki logout fonksiyonu çağrılacak
    }
    return Promise.reject(error);
  }
);

// Axios instance'ı export et
export default axiosInstance;

export class ApiInterceptor {
  private static logoutCallback: (() => void) | null = null;
  private static originalFetch = global.fetch;

  static setLogoutCallback(callback: () => void) {
    this.logoutCallback = callback;
  }

  static async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await this.originalFetch(url, options);

    // 401 Unauthorized durumunda - logout callback'ini çağır
    // Token temizleme işlemini AuthContext'teki logout fonksiyonu halleder (remember me kontrolü ile)
    if (response.status === 401) {
      console.log('401 Unauthorized - Triggering logout');
      if (this.logoutCallback) {
        this.logoutCallback();
      }
    }

    return response;
  }
}

// Global fetch'i override et
const originalFetch = global.fetch;
global.fetch = (url: RequestInfo | URL, init?: RequestInit) => {
  if (typeof url === 'string' || url instanceof URL) {
    return ApiInterceptor.fetch(url.toString(), init);
  }
  return originalFetch(url, init);
};

