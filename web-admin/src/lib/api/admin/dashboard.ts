import { apiClient } from '../client';

export interface DashboardStats {
  users: {
    total: number;
    admin: number;
    emailConfirmed: number;
    activeLast30Days: number;
    newToday: number;
    emailConfirmedToday: number;
  };
  products: {
    total: number;
    public: number; // Backend'de @public olarak döner ama JSON'da "public" olarak gelir
    private: number; // Backend'de @private olarak döner ama JSON'da "private" olarak gelir
    today: number;
    last7Days: number;
    last30Days: number;
  };
  categories: {
    total: number;
    withProducts: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalSaves: number;
    likesToday: number;
    commentsToday: number;
    savesToday: number;
  };
  recentProducts: Array<{
    id: number;
    title: string;
    userId: string;
    createdAt: string;
    isPublic: boolean;
  }>;
  recentUsers: Array<{
    id: string;
    email: string | null;
    displayName: string | null;
    isAdmin: boolean;
    emailConfirmed: boolean;
  }>;
  trends: {
    dailyProductCounts: Array<{
      date: string;
      count: number;
    }>;
    dailyLoginCounts: Array<{
      date: string;
      successful: number;
      failed: number;
    }>;
  };
}

/**
 * Dashboard istatistiklerini getir
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>('/api/admin/dashboard/stats');
  return response.data;
}

