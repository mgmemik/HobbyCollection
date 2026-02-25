import { apiClient } from '../client';

export interface SearchLog {
  id: string;
  userId: string | null;
  searchType: string;
  query: string | null;
  categoryId: string | null;
  resultCount: number;
  ipAddress: string;
  userAgent: string | null;
  language: string | null;
  createdAtUtc: string;
}

export interface GetSearchLogsParams {
  page?: number;
  pageSize?: number;
  searchType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetSearchLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: SearchLog[];
}

export interface SearchStatistics {
  totalSearches: number;
  productSearches: number;
  userSearches: number;
  anonymousSearches: number;
  authenticatedSearches: number;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
  topCategories: Array<{
    categoryId: string | null;
    categoryName: string;
    count: number;
  }>;
  dailySearchCounts: Array<{
    date: string;
    count: number;
  }>;
  dailySearchByType: Array<{
    date: string;
    products: number;
    users: number;
  }>;
  avgResultCount: number;
}

export interface GetSearchStatisticsParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Arama loglarını getir
 */
export async function getSearchLogs(params: GetSearchLogsParams = {}): Promise<GetSearchLogsResponse> {
  const response = await apiClient.get<GetSearchLogsResponse>('/api/admin/reports/search-logs', { params });
  return response.data;
}

/**
 * Arama istatistiklerini getir
 */
export async function getSearchStatistics(params: GetSearchStatisticsParams = {}): Promise<SearchStatistics> {
  const response = await apiClient.get<SearchStatistics>('/api/admin/reports/search-statistics', { params });
  return response.data;
}

