import { apiClient } from '../client';

export interface ContentReport {
  id: string;
  reporterUserId: string;
  reporter: {
    id: string;
    email: string;
    username: string;
  } | null;
  contentType: 'product' | 'user' | 'comment';
  contentId: string;
  content: any; // Product, User, veya Comment bilgisi
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedBy: {
    id: string;
    email: string;
    username: string;
  } | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface GetContentReportsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  contentType?: string;
  reason?: string;
}

export interface GetContentReportsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ContentReport[];
}

export interface ContentReportStatistics {
  total: number;
  pending: number;
  reviewed: number;
  resolved: number;
  rejected: number;
  byContentType: Array<{
    contentType: string;
    count: number;
  }>;
  byReason: Array<{
    reason: string;
    count: number;
  }>;
}

export interface ReviewReportRequest {
  status: 'reviewed' | 'resolved' | 'rejected';
  adminNote?: string;
}

/**
 * Şikayetleri listele
 */
export async function getContentReports(params: GetContentReportsParams = {}): Promise<GetContentReportsResponse> {
  const response = await apiClient.get<GetContentReportsResponse>('/api/admin/content-reports', { params });
  return response.data;
}

/**
 * Şikayet detayını getir
 */
export async function getContentReport(id: string): Promise<ContentReport> {
  const response = await apiClient.get<ContentReport>(`/api/admin/content-reports/${id}`);
  return response.data;
}

/**
 * Şikayeti değerlendir
 */
export async function reviewContentReport(id: string, request: ReviewReportRequest): Promise<{ id: string; status: string; message: string }> {
  const response = await apiClient.post(`/api/admin/content-reports/${id}/review`, request);
  return response.data;
}

/**
 * Şikayet istatistiklerini getir
 */
export async function getContentReportStatistics(params: { startDate?: string; endDate?: string } = {}): Promise<ContentReportStatistics> {
  const response = await apiClient.get<ContentReportStatistics>('/api/admin/content-reports/statistics', { params });
  return response.data;
}
