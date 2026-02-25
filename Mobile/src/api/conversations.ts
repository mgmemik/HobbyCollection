import { API_BASE_URL } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Conversation = {
  id: string;
  otherUserId: string;
  otherUserDisplayName: string;
  otherUserUsername: string;
  otherUserAvatarUrl?: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  isLastMessageFromMe: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getConversations(): Promise<Conversation[]> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/conversations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      let errorMessage = 'Konuşmalar yüklenemedi';
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
      } else if (res.status >= 500) {
        errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
      }
      
      throw new Error(errorMessage);
    }
    
    const responseData = await res.json();
    console.log('[getConversations] Response data count:', responseData?.length || 0);
    
    // Response formatını normalize et (camelCase'e çevir)
    const normalizedConversations: Conversation[] = (responseData || []).map((item: any) => ({
      id: item.id || item.Id || '',
      otherUserId: item.otherUserId || item.OtherUserId || '',
      otherUserDisplayName: item.otherUserDisplayName || item.OtherUserDisplayName || 'User',
      otherUserUsername: item.otherUserUsername || item.OtherUserUsername || '',
      otherUserAvatarUrl: item.otherUserAvatarUrl ?? item.OtherUserAvatarUrl ?? null,
      lastMessage: item.lastMessage || item.LastMessage || null,
      lastMessageAt: item.lastMessageAt || item.LastMessageAt || null,
      lastMessageSenderId: item.lastMessageSenderId || item.LastMessageSenderId || null,
      unreadCount: item.unreadCount ?? item.UnreadCount ?? 0,
      isLastMessageFromMe: item.isLastMessageFromMe ?? item.IsLastMessageFromMe ?? false,
      createdAt: item.createdAt || item.CreatedAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.UpdatedAt || new Date().toISOString(),
    }));
    
    return normalizedConversations;
  } catch (error: any) {
    if (error.message === 'Network request failed' || error.message === 'Failed to fetch') {
      throw new Error('İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error?.message || 'Konuşmalar yüklenemedi');
  }
}

export async function getOrCreateConversation(otherUserId: string): Promise<Conversation> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const url = `${API_BASE_URL}/api/conversations/with/${otherUserId}`;
  
  console.log('[getOrCreateConversation] API_BASE_URL:', API_BASE_URL);
  console.log('[getOrCreateConversation] Full URL:', url);
  console.log('[getOrCreateConversation] Token exists:', !!token);
  console.log('[getOrCreateConversation] OtherUserId:', otherUserId);
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[getOrCreateConversation] Response status:', res.status);
    console.log('[getOrCreateConversation] Response ok:', res.ok);
    
    if (!res.ok) {
      let errorMessage = 'Konuşma oluşturulamadı';
      let errorDetails = '';
      
      try {
        const errorText = await res.text();
        console.error('[getOrCreateConversation] Error response text:', errorText);
        
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorText;
            errorDetails = errorJson.error || errorJson.details || '';
            console.error('[getOrCreateConversation] Parsed error:', JSON.stringify(errorJson, null, 2));
          } catch {
            errorMessage = errorText;
            console.error('[getOrCreateConversation] Error text is not JSON:', errorText);
          }
        }
      } catch (e) {
        console.error('[getOrCreateConversation] Error reading error response:', e);
      }
      
      // HTTP durum koduna göre özel mesajlar
      if (res.status === 401) {
        errorMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
      } else if (res.status === 404) {
        errorMessage = 'Kullanıcı bulunamadı.';
      } else if (res.status === 400) {
        errorMessage = errorMessage || 'Geçersiz istek.';
      } else if (res.status >= 500) {
        errorMessage = errorMessage || 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        if (errorDetails) {
          errorMessage += ` (${errorDetails})`;
        }
      }
      
      console.error('[getOrCreateConversation] Final error message:', errorMessage);
      console.error('[getOrCreateConversation] HTTP Status:', res.status);
      
      throw new Error(errorMessage);
    }
    
    const responseData = await res.json();
    console.log('[getOrCreateConversation] Response data:', JSON.stringify(responseData, null, 2));
    
    // Response formatını kontrol et ve normalize et
    const normalizedResponse: Conversation = {
      id: responseData.id || responseData.Id || responseData.conversationId || '',
      otherUserId: responseData.otherUserId || responseData.OtherUserId || '',
      otherUserDisplayName: responseData.otherUserDisplayName || responseData.OtherUserDisplayName || 'User',
      otherUserUsername: responseData.otherUserUsername || responseData.OtherUserUsername || '',
      otherUserAvatarUrl: responseData.otherUserAvatarUrl ?? responseData.OtherUserAvatarUrl ?? null,
      lastMessage: responseData.lastMessage || responseData.LastMessage || null,
      lastMessageAt: responseData.lastMessageAt || responseData.LastMessageAt || null,
      lastMessageSenderId: responseData.lastMessageSenderId || responseData.LastMessageSenderId || null,
      unreadCount: responseData.unreadCount ?? responseData.UnreadCount ?? 0,
      isLastMessageFromMe: responseData.isLastMessageFromMe ?? responseData.IsLastMessageFromMe ?? false,
      createdAt: responseData.createdAt || responseData.CreatedAt || new Date().toISOString(),
      updatedAt: responseData.updatedAt || responseData.UpdatedAt || new Date().toISOString(),
    };
    
    console.log('[getOrCreateConversation] Normalized response:', JSON.stringify(normalizedResponse, null, 2));
    
    return normalizedResponse;
  } catch (error: any) {
    console.error('[getOrCreateConversation] Error:', error);
    console.error('[getOrCreateConversation] Error message:', error?.message);
    console.error('[getOrCreateConversation] Error type:', typeof error);
    
    // Network hatası kontrolü
    if (error.message === 'Network request failed' || error.message === 'Failed to fetch') {
      console.error('[getOrCreateConversation] Network error detected');
      throw new Error('İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
    }
    // Zaten bir Error objesi ise olduğu gibi fırlat
    if (error instanceof Error) {
      throw error;
    }
    // Diğer durumlar için genel hata mesajı
    throw new Error(error?.message || 'Konuşma oluşturulamadı');
  }
}

export async function deleteConversation(conversationId: string): Promise<{ message: string }> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

