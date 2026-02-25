import { apiClient } from '../client';

export interface Product {
  id: string;
  title: string;
  description: string | null;
  hashtags: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** Hiyerarşik kategori yolu (örn: "Saat - Kol Saati") */
  categoryPath: string | null;
  price: number | null;
  userCurrency: string; // Kullanıcının para birimi tercihi
  isPublic: boolean;
  commentsEnabled: boolean;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  userDisplayName: string;
  photoCount: number;
  firstPhotoUrl: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  isRare: boolean;
  isMint: boolean;
  isGraded: boolean;
  isSigned: boolean;
  isLimited: boolean;
  isFeatured: boolean;
}

export interface ProductDetail extends Product {
  photos: Array<{
    id: string;
    blobUrl: string;
    order: number;
    contentType: string;
    sizeBytes: number;
  }>;
  badges: Array<{
    badge: string;
    expiresAt: string | null;
  }>;
}

export interface ProductStatistics {
  totalProducts: number;
  publicProducts: number;
  privateProducts: number;
  todayProducts: number;
  last5DaysProducts: number;
  last7DaysProducts: number;
  last30DaysProducts: number;
  productsWithPhotos: number;
  productsWithPrice: number;
  featuredProducts: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  topLikedProducts: Array<{
    productId: string;
    title: string;
    userId: string | null;
    likeCount: number;
  }>;
}

export interface GetProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  userId?: string;
  categoryId?: string;
  isPublic?: boolean;
  createdDays?: number;
  sortBy?: 'createdAt' | 'title' | 'commentCount' | 'likeCount' | 'saveCount';
  sortOrder?: 'asc' | 'desc';
}

export interface GetProductsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Product[];
}

export interface UpdateProductRequest {
  isPublic?: boolean;
  commentsEnabled?: boolean;
  categoryId?: string | null;
  isFeatured?: boolean;
}

/**
 * Ürünleri listele
 */
export async function getProducts(params: GetProductsParams = {}): Promise<GetProductsResponse> {
  const response = await apiClient.get<GetProductsResponse>('/api/admin/products', { params });
  return response.data;
}

/**
 * Ürün detayını getir
 */
export async function getProduct(id: string): Promise<ProductDetail> {
  const response = await apiClient.get<ProductDetail>(`/api/admin/products/${id}`);
  return response.data;
}

/**
 * Ürün bilgilerini güncelle
 */
export async function updateProduct(id: string, data: UpdateProductRequest): Promise<void> {
  await apiClient.put(`/api/admin/products/${id}`, data);
}

/**
 * Ürünü sil
 */
export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/products/${id}`);
}

/**
 * Ürün istatistiklerini getir
 */
export async function getProductStatistics(): Promise<ProductStatistics> {
  const response = await apiClient.get<ProductStatistics>('/api/admin/products/statistics');
  return response.data;
}

