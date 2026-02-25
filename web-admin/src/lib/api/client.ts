import axios from 'axios';

const DEFAULT_PORT = 5015;
const PRODUCTION_API_URL = 'https://api.save-all.com';
const LOCAL_API_URL = `http://localhost:${DEFAULT_PORT}`;
const isDevelopment = process.env.NODE_ENV !== 'production';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  (isDevelopment ? LOCAL_API_URL : PRODUCTION_API_URL);

// Axios instance oluştur
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - token ekle
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - 401 durumunda logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

