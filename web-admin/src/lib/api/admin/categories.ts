import apiClient from '../client';

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  isActive: boolean;
  parentId?: string;
  createdAtUtc: string;
  productCount: number;
  translations?: CategoryTranslation[];
}

export interface CategoryTranslation {
  languageCode: string;
  name: string;
  description?: string;
}

export interface CategoryDetail extends Category {
  childrenCount: number;
}

export interface CategoryStatistics {
  totalCategories: number;
  rootCategories: number;
  categoriesWithProducts: number;
  categoriesWithTranslations: number;
  topCategories: Array<{
    id: string;
    name: string;
    productCount: number;
  }>;
}

export interface CreateCategoryRequest {
  name: string;
  parentId?: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  parentId?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpsertTranslationRequest {
  languageCode: string;
  name: string;
  description?: string;
}

/**
 * Tüm kategorileri getir
 */
export async function getCategories(language?: string): Promise<Category[]> {
  const params = language ? { language } : {};
  const response = await apiClient.get<Category[]>('/api/admin/categories', { params });
  return response.data;
}

/**
 * Kategori detayını getir
 */
export async function getCategory(id: string): Promise<CategoryDetail> {
  const response = await apiClient.get<CategoryDetail>(`/api/admin/categories/${id}`);
  return response.data;
}

/**
 * Yeni kategori oluştur
 */
export async function createCategory(data: CreateCategoryRequest): Promise<Category> {
  const response = await apiClient.post<Category>('/api/admin/categories', data);
  return response.data;
}

/**
 * Kategoriyi güncelle
 */
export async function updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
  const response = await apiClient.put<Category>(`/api/admin/categories/${id}`, data);
  return response.data;
}

/**
 * Kategoriyi sil
 */
export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/categories/${id}`);
}

/**
 * Kategori çevirisi ekle/güncelle
 */
export async function upsertCategoryTranslation(
  categoryId: string,
  data: UpsertTranslationRequest
): Promise<void> {
  await apiClient.post(`/api/admin/categories/${categoryId}/translations`, data);
}

/**
 * Kategori çevirisini sil
 */
export async function deleteCategoryTranslation(
  categoryId: string,
  languageCode: string
): Promise<void> {
  await apiClient.delete(`/api/admin/categories/${categoryId}/translations/${languageCode}`);
}

/**
 * Kategori istatistiklerini getir
 */
export async function getCategoryStatistics(): Promise<CategoryStatistics> {
  const response = await apiClient.get<CategoryStatistics>('/api/admin/categories/statistics');
  return response.data;
}

export interface MoveCategoryRequest {
  newParentId?: string | null; // null = ana kategori olarak taşı
}

export const moveCategory = async (id: string, data: MoveCategoryRequest): Promise<void> => {
  await apiClient.put(`/api/admin/categories/${id}/move`, {
    newParentId: data.newParentId || null,
  });
};

