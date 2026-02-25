import { API_BASE_URL } from './auth';
import i18n from '../i18n';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper function to get language parameter
const getLanguageParam = () => {
  const language = i18n.language || 'en';
  return language === 'tr' ? 'tr' : 'en';
};

export type CreateProductRequest = {
  title: string;
  description?: string;
  hashtags?: string; // boşlukla ayrılmış #etiketler
  categoryId?: string | null; // Guid
  price?: number | null;
  isPublic?: boolean;
  commentsEnabled?: boolean;
  photos: Array<{ uri: string; name?: string; type?: string }>;
  // Badge fields
  isRare?: boolean;
  isMint?: boolean;
  isGraded?: boolean;
  isSigned?: boolean;
  isLimited?: boolean;
  isFeatured?: boolean;
};

export type UserProduct = {
  id: string;
  title: string;
  description?: string;
  hashtags?: string;
  createdAt: string;
  category?: string;
  categoryId?: string;
  firstPhotoUrl: string;
  photoCount: number;
  price?: number | null;
  badges?: number[]; // ProductBadge enum values
};

export type CategoryPathItem = {
  id: string;
  name: string;
  slug: string;
};

export type ProductDetail = {
  id: string;
  title: string;
  description?: string;
  hashtags?: string;
  price?: number | null;
  isPublic?: boolean;
  commentsEnabled?: boolean;
  createdAt: string;
  category?: string;
  categoryId?: string;
  categoryPath?: CategoryPathItem[];
  likeCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  photos: { blobUrl: string; order: number }[];
  userId?: string;
  user?: string;
  badges?: number[]; // ProductBadge enum values
  // Badge boolean fields
  isRare?: boolean;
  isMint?: boolean;
  isGraded?: boolean;
  isSigned?: boolean;
  isLimited?: boolean;
  isFeatured?: boolean;
};

export async function createProduct(payload: CreateProductRequest): Promise<{ id: string; title: string; photos: string[] }> {
  console.log('[createProduct API] === PAYLOAD ===');
  console.log('[createProduct API] payload.description (raw):', JSON.stringify(payload.description));
  console.log('[createProduct API] payload.description length:', payload.description?.length);
  console.log('[createProduct API] payload.description newlines:', payload.description ? (payload.description.match(/\n/g) || []).length : 0);
  
  const form = new FormData();
  form.append('title', payload.title);
  if (payload.description) {
    console.log('[createProduct API] FormData\'ye description ekleniyor:', JSON.stringify(payload.description));
    form.append('description', payload.description);
  }
  if (payload.hashtags) form.append('hashtags', payload.hashtags);
  if (payload.categoryId) form.append('categoryId', String(payload.categoryId));
  if (typeof payload.price === 'number') form.append('price', String(payload.price));
  if (typeof payload.isPublic === 'boolean') form.append('isPublic', String(payload.isPublic));
  if (typeof payload.commentsEnabled === 'boolean') form.append('commentsEnabled', String(payload.commentsEnabled));
  
  // Badge fields
  if (typeof payload.isRare === 'boolean') form.append('isRare', String(payload.isRare));
  if (typeof payload.isMint === 'boolean') form.append('isMint', String(payload.isMint));
  if (typeof payload.isGraded === 'boolean') form.append('isGraded', String(payload.isGraded));
  if (typeof payload.isSigned === 'boolean') form.append('isSigned', String(payload.isSigned));
  if (typeof payload.isLimited === 'boolean') form.append('isLimited', String(payload.isLimited));
  if (typeof payload.isFeatured === 'boolean') form.append('isFeatured', String(payload.isFeatured));

  payload.photos.forEach((p, i) => {
    const normalizedType = p.type && p.type.includes('/') ? p.type : 'image/jpeg';
    form.append('files', {
      uri: p.uri,
      name: p.name || `product_${Date.now()}_${i}.jpg`,
      type: normalizedType,
    } as any);
  });

  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }

  console.log('=== PRODUCT CREATE (axios) ===');
  console.log('URL:', `${API_BASE_URL}/api/products`);
  console.log('Photo count:', payload.photos.length);
  if (payload.photos[0]) {
    console.log('First photo:', {
      uri: payload.photos[0].uri?.substring(0, 80) + '...',
      type: payload.photos[0].type,
      name: payload.photos[0].name,
    });
  }

  // Axios ile multipart/form-data gönderimi (Android uyumluluğu için)
  try {
    const response = await axios.post(`${API_BASE_URL}/api/products`, form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 120 saniye timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response.data;
  } catch (error: any) {
    console.error('Create product error:', error?.response?.status, error?.message);
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

export async function getProduct(id: string, token: string): Promise<ProductDetail> {
  const lang = getLanguageParam();
  const res = await fetch(`${API_BASE_URL}/api/products/${id}?language=${lang}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPublicProduct(id: string, token?: string): Promise<ProductDetail> {
  const lang = getLanguageParam();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Token varsa Authorization header'ı ekle (beğenme durumu için gerekli)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_URL}/api/products/public/${id}?language=${lang}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProduct(id: string, token: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type UpdateProductRequest = {
  title?: string;
  description?: string;
  hashtags?: string;
  categoryId?: string | null;
  price?: number | null;
  isPublic?: boolean;
  commentsEnabled?: boolean;
  photos?: Array<{ uri: string; name?: string; type?: string }>;
  removePhotoIds?: string[]; // backend: virgülle ayrılmış GUID olarak gönderilir
  // Badge fields
  isRare?: boolean;
  isMint?: boolean;
  isGraded?: boolean;
  isSigned?: boolean;
  isLimited?: boolean;
  isFeatured?: boolean;
  isOnSale?: boolean;
  originalPrice?: number | null;
};

export async function updateProduct(id: string, payload: UpdateProductRequest, token: string): Promise<{ id: string; title: string }> {
  const form = new FormData();
  if (typeof payload.title === 'string') form.append('title', payload.title);
  if (typeof payload.description === 'string') form.append('description', payload.description);
  if (typeof payload.hashtags === 'string') form.append('hashtags', payload.hashtags);
  if (payload.categoryId) form.append('categoryId', String(payload.categoryId));
  if (typeof payload.price === 'number') form.append('price', String(payload.price));
  if (typeof payload.isPublic === 'boolean') form.append('isPublic', String(payload.isPublic));
  if (typeof payload.commentsEnabled === 'boolean') form.append('commentsEnabled', String(payload.commentsEnabled));
  if (payload.removePhotoIds && payload.removePhotoIds.length > 0) form.append('removePhotoIds', payload.removePhotoIds.join(','));
  
  // Badge fields
  if (typeof payload.isRare === 'boolean') form.append('isRare', String(payload.isRare));
  if (typeof payload.isMint === 'boolean') form.append('isMint', String(payload.isMint));
  if (typeof payload.isGraded === 'boolean') form.append('isGraded', String(payload.isGraded));
  if (typeof payload.isSigned === 'boolean') form.append('isSigned', String(payload.isSigned));
  if (typeof payload.isLimited === 'boolean') form.append('isLimited', String(payload.isLimited));
  if (typeof payload.isFeatured === 'boolean') form.append('isFeatured', String(payload.isFeatured));
  if (typeof payload.isOnSale === 'boolean') form.append('isOnSale', String(payload.isOnSale));
  if (typeof payload.originalPrice === 'number') form.append('originalPrice', String(payload.originalPrice));

  if (payload.photos && payload.photos.length > 0) {
    payload.photos.forEach((p, i) => {
      const normalizedType = p.type && p.type.includes('/') ? p.type : 'image/jpeg';
      form.append('files', {
        uri: p.uri,
        name: p.name || `product_${Date.now()}_${i}.jpg`,
        type: normalizedType,
      } as any);
    });
  }

  // Axios ile multipart/form-data gönderimi (Android uyumluluğu için)
  try {
    const response = await axios.put(`${API_BASE_URL}/api/products/${id}`, form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 120 saniye timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response.data;
  } catch (error: any) {
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

export async function getUserProducts(token: string): Promise<UserProduct[]> {
  const lang = getLanguageParam();
  const res = await fetch(`${API_BASE_URL}/api/products?language=${lang}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  return res.json();
}

export type FeedProduct = {
  id: string;
  title: string;
  description?: string;
  hashtags?: string;
  createdAt: string;
  userId: string;
  user: string;
  userAvatarUrl?: string | null;
  category?: string;
  firstPhotoUrl?: string;
  photoCount: number;
  photos?: { blobUrl: string; order: number }[];
  likeCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  commentCount?: number;
  commentsEnabled?: boolean;
  badges?: number[]; // ProductBadge enum values
};

export async function getFeedProducts(page: number = 1, pageSize: number = 20, token?: string): Promise<FeedProduct[]> {
  const lang = getLanguageParam();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Token varsa Authorization header'ı ekle (beğenme durumu için gerekli)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_URL}/api/products/feed?page=${page}&pageSize=${pageSize}&language=${lang}`, {
    method: 'GET',
    headers,
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  return res.json();
}

export type UserPublicProfile = {
  userId: string;
  displayName: string;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  isPrivateAccount?: boolean;
  canViewProducts?: boolean;
  products: UserProduct[];
};

export async function getUserPublicProducts(userId: string, page: number = 1, pageSize: number = 20): Promise<UserPublicProfile> {
  const lang = getLanguageParam();
  const res = await fetch(`${API_BASE_URL}/api/products/user/${userId}?page=${page}&pageSize=${pageSize}&language=${lang}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  const responseData = await res.json();
  console.log('[getUserPublicProducts] Response data:', JSON.stringify(responseData, null, 2));
  
  // Response formatını normalize et (hem camelCase hem PascalCase destekle)
  const normalizedResponse: UserPublicProfile = {
    userId: responseData.userId || responseData.UserId || userId,
    displayName: responseData.displayName || responseData.DisplayName || 'User',
    avatarUrl: responseData.avatarUrl || responseData.AvatarUrl || null,
    followerCount: responseData.followerCount ?? responseData.FollowerCount ?? 0,
    followingCount: responseData.followingCount ?? responseData.FollowingCount ?? 0,
    isFollowing: responseData.isFollowing ?? responseData.IsFollowing ?? false,
    isPrivateAccount: responseData.isPrivateAccount ?? responseData.IsPrivateAccount ?? false,
    canViewProducts: responseData.canViewProducts ?? responseData.CanViewProducts ?? true,
    products: (responseData.products || responseData.Products || []).map((p: any) => ({
      id: p.id || p.Id || '',
      title: p.title || p.Title || '',
      description: p.description || p.Description || null,
      hashtags: p.hashtags || p.Hashtags || null,
      createdAt: p.createdAt || p.CreatedAt || new Date().toISOString(),
      category: p.category || p.Category || null,
      categoryId: p.categoryId || p.CategoryId || null,
      firstPhotoUrl: p.firstPhotoUrl || p.FirstPhotoUrl || null,
      photoCount: p.photoCount ?? p.PhotoCount ?? 0,
      likeCount: p.likeCount ?? p.LikeCount ?? 0,
      isLiked: p.isLiked ?? p.IsLiked ?? false,
      commentCount: p.commentCount ?? p.CommentCount ?? 0,
      commentsEnabled: p.commentsEnabled ?? p.CommentsEnabled ?? true,
      badges: p.badges || p.Badges || [],
    })),
  };
  
  console.log('[getUserPublicProducts] Normalized response:', JSON.stringify(normalizedResponse, null, 2));
  
  return normalizedResponse;
}

export async function searchProducts(
  query?: string, 
  categoryId?: string, 
  page: number = 1, 
  pageSize: number = 20
): Promise<FeedProduct[]> {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (categoryId) params.append('categoryId', categoryId);
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  params.append('language', getLanguageParam());
  
  const res = await fetch(`${API_BASE_URL}/api/products/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  return res.json();
}

export async function likeProduct(id: string): Promise<{ likeCount: number; isLiked: boolean }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  const res = await fetch(`${API_BASE_URL}/api/products/${id}/like`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function unlikeProduct(id: string): Promise<{ likeCount: number; isLiked: boolean }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  const res = await fetch(`${API_BASE_URL}/api/products/${id}/like`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ProductLiker = { userId: string; displayName: string; likedAt: string }; // displayName artık username döndürüyor (backend'de GetUserDisplayName UserName döndürüyor)
export type ProductLikersResponse = { total: number; page: number; pageSize: number; items: ProductLiker[] };

export async function getProductLikers(id: string, page: number = 1, pageSize: number = 50): Promise<ProductLikersResponse> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  const headers: any = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE_URL}/api/products/${id}/likes?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveProduct(id: string): Promise<{ saved: boolean }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/products/${id}/save`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function unsaveProduct(id: string): Promise<{ saved: boolean }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/products/${id}/save`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSavedProducts(page: number = 1, pageSize: number = 20): Promise<FeedProduct[]> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const lang = getLanguageParam();
  const res = await fetch(`${API_BASE_URL}/api/products/saved?page=${page}&pageSize=${pageSize}&language=${lang}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Comments API
export type Comment = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  userId: string;
  user: string;
  likeCount: number;
  isLiked: boolean;
};

export type CommentsResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Comment[];
};

export async function getComments(productId: string, page: number = 1, pageSize: number = 50): Promise<CommentsResponse> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  const headers: any = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE_URL}/api/comments/${productId}?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createComment(productId: string, text: string): Promise<Comment> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/comments/${productId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteComment(commentId: string): Promise<{ message: string }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateComment(commentId: string, text: string): Promise<{ id: string; text: string; updatedAt: string }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function likeComment(commentId: string): Promise<{ likeCount: number; isLiked: boolean }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}/like`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function unlikeComment(commentId: string): Promise<{ likeCount: number; isLiked: boolean }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}/like`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Notifications API
export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string;
  relatedProductId?: string;
  relatedCommentId?: string;
  relatedConversationId?: string;
  relatedUserId?: string;
  relatedFollowId?: string; // Takip talebi için Follow ID (onay/reddetme için)
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Notification[];
};

export async function getNotifications(page: number = 1, pageSize: number = 50): Promise<NotificationsResponse> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    // Boş liste durumunda da geçerli bir response döndür
    return {
      total: data.total || 0,
      page: data.page || page,
      pageSize: data.pageSize || pageSize,
      items: data.items || []
    };
  } catch (error: any) {
    console.error('getNotifications error:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<{ message: string }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  const token = (await import('@react-native-async-storage/async-storage')).default.getItem('auth_token');
  const authToken = await token;
  if (!authToken) throw new Error('Auth required');
  const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } as any,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


