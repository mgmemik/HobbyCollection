import { apiClient } from '../client';

export interface User {
  id: string;
  email: string | null;
  userName: string | null;
  username?: string | null; // Alias for consistency
  displayName: string | null;
  isAdmin: boolean;
  isPrivateAccount: boolean;
  isWebProfilePublic?: boolean;
  emailConfirmed: boolean;
  lockoutEnabled: boolean;
  lockoutEnd: string | null;
  createdAt: string;
  uiLanguage: string | null;
  aiLanguage: string | null;
  currency: string | null;
  productCount: number;
  likeCount: number;
  followerCount: number;
  followingCount: number;
  commentCount: number;

  // Bildirim durumu (admin listesinde hızlı görünüm)
  notificationDeviceCount?: number;
  notificationHasPermission?: boolean;
  notificationHasPushToken?: boolean;
  notificationActiveTokenCount?: number;
  notificationLastUpdatedUtc?: string | null;

  // Premium durumu
  isPremium?: boolean;
  
  // Plan durumu: "standard" veya "premium"
  planStatus?: 'standard' | 'premium';
}

export interface LoginLog {
  id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string | null;
  isSuccessful: boolean;
  failureReason: string | null;
  createdAtUtc: string;
}

export interface DeviceInfo {
  id: string;
  platform: string;
  osVersion?: string | null;
  appVersion?: string | null;
  buildNumber?: string | null;
  deviceModel?: string | null;
  deviceManufacturer?: string | null;
  deviceName?: string | null;
  hasNotificationPermission: boolean;
  hasPushToken: boolean;
  pushTokenMasked?: string | null;
  ipAddress?: string |null;
  userAgent?: string | null;
  lastUpdatedUtc: string;
  createdAtUtc: string;
  isActive: boolean;
}

export interface UserDetail extends User {
  saveCount: number;
  lastActivity: string | null;
  loginLogs?: LoginLog[];
  deviceInfos?: DeviceInfo[];
}

export interface GetLoginLogsParams {
  page?: number;
  pageSize?: number;
  isSuccessful?: boolean;
}

export interface GetLoginLogsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: LoginLog[];
}

export interface UserStatistics {
  totalUsers: number;
  adminUsers: number;
  emailConfirmedUsers: number;
  privateAccountUsers: number;
  usersWithProducts: number;
  activeUsersLast30Days: number;
  loggedInUsersLast30Days: number;
  premiumUsers: number;
}

export interface UserActivity {
  userId: string;
  totalProducts: number;
  publicProducts: number;
  privateProducts: number;
  productsWithPrice: number;
  productsWithCategory: number;
  featuredProducts: number;
  firstProductDate: string | null;
  lastProductDate: string | null;
  daysSinceFirstProduct: number;
  daysSinceLastProduct: number;
  productsLast30Days: number;
  userCreatedDate: string;
  activatedDate: string | null;
  lastLoginDate: string | null;
  categoryDistribution: Array<{
    categoryId: string | null;
    categoryName: string;
    count: number;
    percentage: number;
  }>;
  priceStatistics: {
    min: number;
    max: number;
    avg: number;
    total: number;
    count: number;
  } | null;
  /** Kullanıcının para birimi (fiyat istatistikleri bu para birimindedir) */
  priceCurrency?: string | null;
  badgeUsage: {
    rare: number;
    mint: number;
    graded: number;
    signed: number;
    limited: number;
  };
  engagement: {
    totalLikesReceived: number;
    totalCommentsReceived: number;
    totalSavesReceived: number;
    avgLikesPerProduct: number;
    avgCommentsPerProduct: number;
  };
  usagePattern: 'normal' | 'collector' | 'seller' | 'casual' | 'active';
  patternReasons: string[];
}

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isAdmin?: boolean;
  emailConfirmed?: boolean;
  isPrivateAccount?: boolean;
  activeDays?: number;
  loginDays?: number;
  hasProducts?: boolean;
  planStatus?: 'all' | 'standard' | 'premium';
}

export interface GetUsersResponse {
  total: number;
  page: number;
  pageSize: number;
  items: User[];
}

export interface UpdateUserRequest {
  isAdmin?: boolean;
  isPrivateAccount?: boolean;
  isWebProfilePublic?: boolean;
  emailConfirmed?: boolean;
  lockoutEnabled?: boolean;
  username?: string;
}

/**
 * Kullanıcıları listele
 */
export async function getUsers(params: GetUsersParams = {}): Promise<GetUsersResponse> {
  const response = await apiClient.get<GetUsersResponse>('/api/admin/users', { params });
  return response.data;
}

/**
 * Kullanıcı detayını getir
 */
export async function getUser(id: string): Promise<UserDetail> {
  const response = await apiClient.get<UserDetail>(`/api/admin/users/${id}`);
  return response.data;
}

/**
 * Kullanıcı bilgilerini güncelle
 */
export async function updateUser(id: string, data: UpdateUserRequest): Promise<void> {
  await apiClient.put(`/api/admin/users/${id}`, data);
}

export interface UserCreditSummary {
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  lastRechargeDate: string;
  nextRechargeDate: string;
  packageName: string;
  monthlyCredits: number;
  daysUntilNextRecharge: number;
}

export interface AICreditTransaction {
  id: number;
  userId: string;
  transactionType: string; // "Charge", "Spend", "Refund"
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  operationType?: string;
  description?: string;
  productId?: number;
  isSuccessful: boolean;
  createdAt: string;
}

export interface AIOperationCost {
  id: number;
  operationType: string;
  description?: string;
  creditCost: number;
}

export interface UserAICreditsResponse {
  summary: UserCreditSummary;
  transactions: AICreditTransaction[];
  operationCosts: AIOperationCost[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Kullanıcının AI kredi bilgilerini getir (admin için)
 */
export async function getUserAICredits(id: string, page: number = 1, pageSize: number = 50): Promise<UserAICreditsResponse> {
  const response = await apiClient.get<UserAICreditsResponse>(`/api/admin/users/${id}/ai-credits`, {
    params: { page, pageSize },
  });
  return response.data;
}

export type ManualAICreditChargeReason = 'support' | 'promo' | 'test' | 'refund' | 'adjustment';

export interface ManualAICreditChargeRequest {
  amount: 50 | 100 | 200 | 300;
  reason: ManualAICreditChargeReason;
}

export interface ManualAICreditChargeResponse {
  message: string;
  transactionId: number;
  amount: number;
  balanceAfter: number;
}

/**
 * Admin: Kullanıcıya manuel AI kredisi yükle
 */
export async function manualChargeUserAICredits(
  id: string,
  data: ManualAICreditChargeRequest
): Promise<ManualAICreditChargeResponse> {
  const response = await apiClient.post<ManualAICreditChargeResponse>(
    `/api/admin/users/${id}/ai-credits/manual-charge`,
    { Amount: data.amount, Reason: data.reason }
  );
  return response.data;
}

/**
 * Kullanıcı istatistiklerini getir
 */
export async function getUserStatistics(): Promise<UserStatistics> {
  const response = await apiClient.get<UserStatistics>('/api/admin/users/statistics');
  return response.data;
}

/**
 * Kullanıcı aktivite analizini getir
 */
export async function getUserActivity(id: string): Promise<UserActivity> {
  const response = await apiClient.get<UserActivity>(`/api/admin/users/${id}/activity`);
  return response.data;
}

/**
 * Kullanıcının login loglarını getir
 */
export async function getUserLoginLogs(id: string, params: GetLoginLogsParams = {}): Promise<GetLoginLogsResponse> {
  const response = await apiClient.get<GetLoginLogsResponse>(`/api/admin/users/${id}/login-logs`, { params });
  return response.data;
}

export interface SendTestPushRequest {
  title?: string;
  body?: string;
}

export interface DevicePushResult {
  tokenMasked: string;
  platform: string;
  status: string;
  errorMessage?: string;
  expoTicketId?: string;
}

export interface SendTestPushResponse {
  sent: boolean;
  activeTokenCount: number;
  totalDevices: number;
  sentCount: number;
  failedCount: number;
  message: string;
  errorMessage?: string;
  expoApiResponse?: string;
  deviceResults: DevicePushResult[];
}

/**
 * Kullanıcıya test push gönder (admin)
 */
export async function sendUserTestPush(id: string, data: SendTestPushRequest): Promise<SendTestPushResponse> {
  const response = await apiClient.post<SendTestPushResponse>(`/api/admin/users/${id}/test-push`, data);
  return response.data;
}

export interface UpdateNotificationPermissionRequest {
  enabled: boolean;
}

export interface UpdateNotificationPermissionResponse {
  updated: number;
  enabled: boolean;
  message: string;
}

/**
 * Kullanıcının notification permission'ını manuel olarak enable/disable yap (admin)
 */
export async function updateUserNotificationPermission(
  id: string,
  data: UpdateNotificationPermissionRequest
): Promise<UpdateNotificationPermissionResponse> {
  const response = await apiClient.post<UpdateNotificationPermissionResponse>(
    `/api/admin/users/${id}/notification-permission`,
    { Enabled: data.enabled }
  );
  return response.data;
}

