import axiosInstance from './interceptor';

export type EntitlementSource = 'AdminGrant' | 'PromoCode' | 'AppStore' | 'PlayStore';

export interface PlanDetails {
  plan: 'standard' | 'premium';
  isPremium: boolean;
  source?: EntitlementSource | null;
  startsAt?: string | null;
  endsAt?: string | null;
  autoRenews: boolean;
  cancelAtPeriodEnd: boolean;
  daysRemaining?: number | null;
  monthlyAICredits: number;
  features: string[];
}

export interface FeatureAccessResponse {
  feature: string;
  hasAccess: boolean;
  requiresPremium: boolean;
}

export interface PlanComparisonItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: string | null;
  monthlyAICredits: number;
  features: string[];
}

export interface PlansComparisonResponse {
  plans: PlanComparisonItem[];
}

/**
 * Kullanıcının mevcut plan bilgilerini getirir
 */
export async function getMyPlan(): Promise<PlanDetails> {
  const response = await axiosInstance.get<PlanDetails>('/api/me/plan');
  return response.data;
}

/**
 * Kullanıcının belirli bir özelliğe erişimi var mı kontrol eder
 */
export async function checkFeatureAccess(feature: string): Promise<FeatureAccessResponse> {
  const response = await axiosInstance.get<FeatureAccessResponse>(`/api/me/plan/feature/${feature}`);
  return response.data;
}

/**
 * Plan karşılaştırma bilgilerini getirir (public endpoint)
 */
export async function getPlansComparison(): Promise<PlansComparisonResponse> {
  const response = await axiosInstance.get<PlansComparisonResponse>('/api/plans');
  return response.data;
}
