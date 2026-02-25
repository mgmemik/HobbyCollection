import { API_BASE_URL } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export interface UploadAvatarResponse {
  avatarUrl: string;
  message: string;
}

function normalizeUploadAvatarResponse(raw: any): UploadAvatarResponse {
  const avatarUrl = raw?.avatarUrl ?? raw?.AvatarUrl ?? raw?.data?.avatarUrl ?? raw?.data?.AvatarUrl ?? '';
  const message = raw?.message ?? raw?.Message ?? raw?.data?.message ?? raw?.data?.Message ?? '';
  return { avatarUrl, message };
}

/**
 * Avatar yükle
 */
export async function uploadAvatar(imageUri: string): Promise<UploadAvatarResponse> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Auth required');
  }

  // FormData oluştur
  const formData = new FormData();
  
  // Dosya bilgilerini ekle
  const filename = imageUri.split('/').pop() || 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  
  // React Native FormData formatı
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type: type,
  } as any);

  console.log('[uploadAvatar] Uploading avatar:', { imageUri, filename, type });

  // Axios ile multipart/form-data gönderimi (React Native uyumluluğu için)
  try {
    const response = await axios.post(`${API_BASE_URL}/api/avatar/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 60 saniye timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log('[uploadAvatar] Response status:', response.status);
    console.log('[uploadAvatar] Response data:', JSON.stringify(response.data));
    return normalizeUploadAvatarResponse(response.data);
  } catch (error: any) {
    console.error('[uploadAvatar] Upload error:', error);
    if (error?.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data || error.message;
      throw new Error(`API hatası (${status}): ${message}`);
    } else if (error?.request) {
      throw new Error('Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
    } else {
      throw error;
    }
  }
}

/**
 * Avatar'ı sil
 */
export async function deleteAvatar(): Promise<{ message: string }> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Auth required');
  }

  const response = await fetch(`${API_BASE_URL}/api/avatar`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

