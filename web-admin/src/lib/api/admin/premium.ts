import { apiClient } from '../client';

export type EntitlementSource = 'AdminGrant' | 'PromoCode' | 'AppStore' | 'PlayStore';
export type EntitlementStatus = 'Active' | 'Expired' | 'Cancelled' | 'Grace' | 'Paused';

export interface PlanDetails {
  plan: 'standard' | 'premium';
  isPremium: boolean;
  source?: EntitlementSource;
  startsAtUtc?: string;
  endsAtUtc?: string | null;
  autoRenews: boolean;
  cancelAtPeriodEnd: boolean;
  daysRemaining?: number | null;
  monthlyAICredits: number;
  features: string[];
}

export interface EntitlementHistory {
  id: string;
  entitlementType: string;
  source: EntitlementSource;
  status: EntitlementStatus;
  startsAtUtc: string;
  endsAtUtc: string | null;
  createdAtUtc: string;
  notes?: string;
  grantedByUserId?: string;
}

export interface UserPlanResponse {
  userId: string;
  displayName: string;
  email: string;
  plan: PlanDetails;
  activeEntitlementId?: string;
  history: EntitlementHistory[];
}

export interface PremiumUser {
  id: string;
  userId: string;
  displayName: string;
  email?: string;
  source: EntitlementSource;
  status: EntitlementStatus;
  startsAtUtc: string;
  endsAtUtc?: string | null;
  createdAtUtc: string;
  isLifetime: boolean;
  daysRemaining?: number | null;
}

export interface PremiumUsersResponse {
  items: PremiumUser[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GrantPremiumRequest {
  durationDays?: number | null;
  notes?: string;
}

export interface RevokePremiumRequest {
  reason?: string;
}

export interface ExtendPremiumRequest {
  days: number;
  notes?: string;
}

// Kullanıcının plan durumunu getir
export async function getUserPlan(userId: string): Promise<UserPlanResponse> {
  const response = await apiClient.get<UserPlanResponse>(`/api/admin/users/${userId}/plan`);
  return response.data;
}

// Kullanıcıya premium ver
export async function grantPremium(userId: string, request: GrantPremiumRequest): Promise<void> {
  await apiClient.post(`/api/admin/users/${userId}/plan/grant`, request);
}

// Kullanıcının premium hakkını iptal et
export async function revokePremium(userId: string, request?: RevokePremiumRequest): Promise<void> {
  await apiClient.post(`/api/admin/users/${userId}/plan/revoke`, request || {});
}

// Kullanıcının premium süresini uzat
export async function extendPremium(userId: string, request: ExtendPremiumRequest): Promise<void> {
  await apiClient.post(`/api/admin/users/${userId}/plan/extend`, request);
}

// Premium kullanıcı listesi
export async function getPremiumUsers(params: {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'expired' | 'cancelled' | 'all';
}): Promise<PremiumUsersResponse> {
  const response = await apiClient.get<PremiumUsersResponse>('/api/admin/premium-users', { params });
  return response.data;
}

export interface PremiumUserDetail {
  userId: string;
  userName: string;
  email?: string | null;
  isPrivateAccount: boolean;
  isWebProfilePublic: boolean | null;
  privateProductCount: number;
  aiCreditBalance: number;
  entitlementId?: string;
  source?: string;
  status?: string;
  startsAtUtc?: string;
  endsAtUtc?: string | null;
  isLifetime?: boolean;
  daysRemaining?: number | null;
  expiredAt?: string;
  category: 'active' | 'expiring_soon' | 'expired' | 'standard';
}

export interface PremiumUsersCategorizedResponse {
  premium: {
    items: PremiumUserDetail[];
    totalCount: number;
  };
  expiringSoon: {
    items: PremiumUserDetail[];
    totalCount: number;
  };
  expired: {
    items: PremiumUserDetail[];
    totalCount: number;
  };
  standard: {
    items: PremiumUserDetail[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// Premium kullanıcıları kategorize ederek getir
export async function getPremiumUsersCategorized(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PremiumUsersCategorizedResponse> {
  const response = await apiClient.get<PremiumUsersCategorizedResponse>('/api/admin/premium', { params });
  return response.data;
}
