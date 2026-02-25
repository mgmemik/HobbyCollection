import { API_BASE_URL } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum MessageType {
  Text = 0,
  Image = 1,
  Video = 2,
}

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderDisplayName: string;
  senderAvatarUrl?: string | null;
  receiverId: string;
  type: MessageType;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  isFromMe: boolean;
};

export type MessagesResponse = {
  messages: Message[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export async function sendMessage(
  conversationId: string,
  content: string,
  type: MessageType = MessageType.Text
): Promise<Message> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      content,
      type,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return {
    ...data,
    isFromMe: true,
    senderDisplayName: '', // Backend'den gelmiyor, frontend'de set edilecek
  };
}

export async function getMessages(
  conversationId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<MessagesResponse> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  
  try {
  const res = await fetch(
    `${API_BASE_URL}/api/messages/conversation/${conversationId}?page=${page}&pageSize=${pageSize}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
    
    if (!res.ok) {
      let errorMessage = 'Mesajlar yüklenemedi';
      try {
        const errorText = await res.text();
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorText;
          } catch {
            errorMessage = errorText;
          }
        }
      } catch {
        // Hata mesajı okunamazsa varsayılan mesajı kullan
      }
      
      if (res.status === 401) {
        errorMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
      } else if (res.status === 404) {
        errorMessage = 'Konuşma bulunamadı.';
      } else if (res.status >= 500) {
        errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
      }
      
      throw new Error(errorMessage);
    }
    
  return res.json();
  } catch (error: any) {
    if (error.message === 'Network request failed' || error.message === 'Failed to fetch') {
      throw new Error('İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error?.message || 'Mesajlar yüklenemedi');
  }
}

export async function markMessagesAsRead(conversationId: string): Promise<{ message: string; readCount: number }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/messages/${conversationId}/read`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteMessage(messageId: string): Promise<{ message: string }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

