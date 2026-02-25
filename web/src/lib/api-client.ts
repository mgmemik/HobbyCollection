/**
 * API Client for Save All Backend
 */

// API Base URL
// Development modunda localhost, production modunda production URL kullan
const DEFAULT_PORT = 5015;
const PRODUCTION_API_URL = 'https://api.save-all.com';
const LOCAL_API_URL = `http://localhost:${DEFAULT_PORT}`;

// Development/production kontrolü
const isDevelopment = process.env.NODE_ENV !== 'production';

const API_BASE_URL = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) || 
  (isDevelopment ? LOCAL_API_URL : PRODUCTION_API_URL);

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface CategoryPathItem {
  id: string;
  name: string;
  slug: string;
}

export interface ProductPhoto {
  id: string;
  blobUrl: string;
  order: number;
}

export interface Product {
  id: string;
  title?: string; // Backend field
  name?: string; // Web field
  description?: string;
  categoryId?: string;
  category?: string; // Backend field
  categoryName?: string; // Web field
  categoryPath?: CategoryPathItem[];
  purchasePrice?: number;
  estimatedValue?: number;
  isPublic?: boolean;
  firstPhotoUrl?: string; // Backend field
  imageUrl?: string; // Web field
  photos?: ProductPhoto[]; // Tüm fotoğraflar
  userId: string;
  user?: string;
  userName?: string; // Username slug
  userDisplayName?: string;
  userAvatarUrl?: string;
  canViewProfile?: boolean; // Profil görüntülenebilir mi?
  isWebProfilePublic?: boolean; // Web profili herkese açık mı?
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
  updatedAt?: string;
  badges?: ProductBadge[];
}

export interface ProductBadge {
  badgeType: string;
  displayName: string;
}

export interface Category {
  id: string | number;
  name: string;
  children?: Category[];
  productCount?: number;
}

export interface UserProfile {
  userId: string;
  username?: string; // Username slug
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  productCount?: number;
  followerCount?: number;
  followingCount?: number;
  planStatus?: 'standard' | 'premium';
  isPremium?: boolean;
}

export interface FeedResponse {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
}

class ApiClient {
  private baseUrl: string;
  private useProxy: boolean;

  constructor(baseUrl: string = API_BASE_URL, useProxy: boolean = true) {
    // Client-side'da Next.js API route'larını kullan (CORS sorunlarını önler)
    // Server-side'da direkt backend API'yi kullan
    if (typeof window !== 'undefined' && useProxy) {
      // Client-side: Next.js API route'ları üzerinden proxy
      this.baseUrl = '';
      this.useProxy = true;
    } else {
      // Server-side: Direkt backend API
      this.baseUrl = baseUrl;
      this.useProxy = false;
    }
  }

  private get useProxyMode(): boolean {
    return this.useProxy;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Proxy kullanılıyorsa (client-side), Next.js API route'larını kullan
    // Değilse (server-side), direkt backend API'yi kullan
    let url: string;
    
    if (this.useProxyMode) {
      // Client-side: Next.js API route'ları üzerinden
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      url = cleanEndpoint;
    } else {
      // Server-side: Direkt backend API
      const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      url = `${cleanBaseUrl}${cleanEndpoint}`;
    }
    
    // Debug logging
    console.log(`[API Client] Requesting: ${url}`);
    console.log(`[API Client] Base URL: ${this.baseUrl}`);
    console.log(`[API Client] Endpoint: ${endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        mode: 'cors', // CORS mode'u açıkça belirt
        credentials: 'omit', // Credentials gönderme (CORS için)
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Client] Error response: ${response.status} ${response.statusText}`, errorText);
        throw new Error(errorText || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`[API Client] Request timeout for ${endpoint}`);
          throw new Error('Request timeout - API yanıt vermiyor');
        }
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.error(`[API Client] Network error for ${endpoint}`);
          console.error(`[API Client] This usually means:`);
          console.error(`  - API server is down or unreachable`);
          console.error(`  - CORS configuration issue`);
          console.error(`  - SSL certificate problem`);
          console.error(`[API Client] Full URL was: ${url}`);
          throw new Error(`Network error: API'ye erişilemiyor. URL: ${url}`);
        }
      }
      
      console.error(`[API Client] Request failed for ${endpoint}:`, error);
      console.error(`[API Client] Full URL was: ${url}`);
      console.error(`[API Client] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // Products
  async getPublicFeed(page: number = 1, pageSize: number = 20): Promise<FeedResponse> {
    try {
      // Next.js API route üzerinden proxy kullan (CORS sorunlarını önler)
      const result = await this.request<Product[] | FeedResponse>(`/api/products/feed?page=${page}&pageSize=${pageSize}`);
      
      // Backend direkt array dönüyor, normalize et
      if (Array.isArray(result)) {
        const normalizedProducts = result.map(p => this.normalizeProduct(p));
        return {
          products: normalizedProducts,
          totalCount: normalizedProducts.length,
          page,
          pageSize,
        };
      }
      
      // Veya obje formatında
      return {
        products: (result?.products || []).map(p => this.normalizeProduct(p)),
        totalCount: result?.totalCount || 0,
        page: result?.page || page,
        pageSize: result?.pageSize || pageSize,
      };
    } catch (error) {
      return {
        products: [],
        totalCount: 0,
        page,
        pageSize,
      };
    }
  }

  private normalizeProduct(p: any): Product {
    // Fotoğraf URL'ini bul: önce imageUrl, sonra firstPhotoUrl, sonra photos array'inden ilk fotoğraf
    let imageUrl = p.imageUrl || p.firstPhotoUrl;
    
    // Photos array'ini normalize et (hem Photos hem photos kontrol et)
    let photos: ProductPhoto[] = [];
    const photosArray = p.Photos || p.photos;
    
    if (photosArray && Array.isArray(photosArray) && photosArray.length > 0) {
      photos = photosArray.map((photo: any, index: number) => {
        const blobUrl = photo.BlobUrl || photo.blobUrl || photo.url || photo;
        if (!blobUrl) return null;
        
        return {
          id: photo.Id || photo.id || `photo-${index}`,
          blobUrl: blobUrl,
          order: photo.Order || photo.order || index,
        };
      }).filter((photo: ProductPhoto | null): photo is ProductPhoto => photo !== null);
    }
    
    // İlk fotoğrafı imageUrl olarak kullan (eğer imageUrl yoksa)
    if (!imageUrl && photos.length > 0) {
      imageUrl = photos[0].blobUrl;
    }
    
    // canViewProfile kontrolü - backend'den gelmeli
    const canViewProfile = p.canViewProfile ?? p.CanViewProfile;
    
    // Debug: canViewProfile değerini logla
    if (canViewProfile === undefined) {
      console.warn('[normalizeProduct] canViewProfile undefined for product:', p.id, 'user:', p.userId);
    }
    
    return {
      ...p,
      id: p.id || p.Id?.toString() || '',
      name: p.name || p.title || p.Title,
      title: p.title || p.Title || p.name,
      imageUrl: imageUrl || p.FirstPhotoUrl || p.firstPhotoUrl,
      photos: photos.length > 0 ? photos : undefined, // Sadece fotoğraf varsa ekle
      categoryName: p.categoryName || p.category,
      userName: p.userName || p.UserName, // Username slug mapping
      userDisplayName: p.userDisplayName || p.User || p.user,
      canViewProfile: canViewProfile ?? false, // Default false - profil görünürlüğü kontrolü gerekli
      isWebProfilePublic: p.isWebProfilePublic ?? p.IsWebProfilePublic ?? false,
      // CommentCount alanını normalize et (backend'den CommentCount veya commentCount gelebilir)
      commentCount: p.commentCount ?? p.CommentCount ?? 0,
      likeCount: p.likeCount ?? p.LikeCount ?? 0,
    };
  }

  async getProductById(id: string | number): Promise<Product> {
    // Public endpoint kullan (auth gerekmez)
    const result = await this.request<Product>(`/api/products/public/${id}`);
    return this.normalizeProduct(result);
  }

  async searchProducts(query: string, page: number = 1): Promise<FeedResponse> {
    try {
      const result = await this.request<Product[] | FeedResponse>(`/api/products/search?query=${encodeURIComponent(query)}&page=${page}`);
      
      if (Array.isArray(result)) {
        const normalizedProducts = result.map(p => this.normalizeProduct(p));
        return {
          products: normalizedProducts,
          totalCount: normalizedProducts.length,
          page,
          pageSize: 20,
        };
      }
      
      return {
        products: (result?.products || []).map(p => this.normalizeProduct(p)),
        totalCount: result?.totalCount || 0,
        page: result?.page || page,
        pageSize: result?.pageSize || 20,
      };
    } catch (error) {
      return {
        products: [],
        totalCount: 0,
        page,
        pageSize: 20,
      };
    }
  }

  async getProductsByCategory(categoryId: string | number, page: number = 1): Promise<FeedResponse & { categoryName?: string }> {
    try {
      const result = await this.request<Product[] | (FeedResponse & { categoryName?: string })>(`/api/products/category/${categoryId}?page=${page}`);
      
      if (Array.isArray(result)) {
        const normalizedProducts = result.map(p => this.normalizeProduct(p));
        return {
          products: normalizedProducts,
          totalCount: normalizedProducts.length,
          page,
          pageSize: 20,
        };
      }
      
      return {
        products: (result?.products || []).map(p => this.normalizeProduct(p)),
        totalCount: result?.totalCount || 0,
        page: result?.page || page,
        pageSize: result?.pageSize || 20,
        categoryName: (result as any)?.categoryName,
      };
    } catch (error) {
      return {
        products: [],
        totalCount: 0,
        page,
        pageSize: 20,
      };
    }
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    try {
      const result = await this.request<Category[]>('/api/categories/roots');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      return [];
    }
  }

  async getCategoryChildren(parentId: number): Promise<Category[]> {
    try {
      const result = await this.request<Category[]>(`/api/categories/${parentId}/children`);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      return [];
    }
  }

  // Users
  async getUserProfile(userId: string): Promise<UserProfile> {
    return this.request(`/api/users/${userId}/profile`);
  }

  async getUserProducts(userId: string, page: number = 1): Promise<FeedResponse> {
    try {
      const result = await this.request<Product[] | FeedResponse>(`/api/users/${userId}/products?page=${page}`);
      
      if (Array.isArray(result)) {
        const normalizedProducts = result.map(p => this.normalizeProduct(p));
        return {
          products: normalizedProducts,
          totalCount: normalizedProducts.length,
          page,
          pageSize: 20,
        };
      }
      
      return {
        products: (result?.products || []).map(p => this.normalizeProduct(p)),
        totalCount: result?.totalCount || 0,
        page: result?.page || page,
        pageSize: result?.pageSize || 20,
      };
    } catch (error) {
      return {
        products: [],
        totalCount: 0,
        page,
        pageSize: 20,
      };
    }
  }

  // Stats for homepage
  async getHomeStats(): Promise<{
    totalProducts: number;
    totalUsers: number;
    totalCategories: number;
  }> {
    // Bu endpoint backend'de yoksa mock data dönebiliriz
    try {
      return this.request('/api/stats/public');
    } catch {
      return {
        totalProducts: 0,
        totalUsers: 0,
        totalCategories: 0,
      };
    }
  }
}

export const apiClient = new ApiClient();
