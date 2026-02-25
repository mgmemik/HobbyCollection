import axiosInstance from './interceptor';
import { Platform } from 'react-native';

/**
 * Apple App Store receipt validation request
 */
export interface ValidateAppleReceiptRequest {
  receiptData: string;
  isSandbox?: boolean;
}

/**
 * Google Play Store purchase validation request
 */
export interface ValidateGooglePurchaseRequest {
  packageName: string;
  subscriptionId: string;
  purchaseToken: string;
}

/**
 * Subscription validation response
 */
export interface SubscriptionValidationResponse {
  message: string;
  entitlement?: {
    id: string;
    expiresAt: string | null;
    autoRenews: boolean;
  };
}

/**
 * Subscription status response
 */
export interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  source?: string;
  productId?: string;
  subscriptionId?: string;
  expiresAt?: string | null;
  autoRenews?: boolean;
  cancelAtPeriodEnd?: boolean;
  status?: string;
  message?: string;
}

/**
 * Apple App Store receipt'i validate et ve backend'e gönder
 */
export async function validateAppleReceipt(
  receiptData: string,
  isSandbox?: boolean
): Promise<SubscriptionValidationResponse> {
  const response = await axiosInstance.post<SubscriptionValidationResponse>(
    '/api/subscriptions/apple/validate',
    {
      receiptData,
      isSandbox,
    }
  );
  return response.data;
}

/**
 * Google Play Store purchase'ı validate et ve backend'e gönder
 */
export async function validateGooglePurchase(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
): Promise<SubscriptionValidationResponse> {
  const response = await axiosInstance.post<SubscriptionValidationResponse>(
    '/api/subscriptions/google/validate',
    {
      packageName,
      subscriptionId,
      purchaseToken,
    }
  );
  return response.data;
}

/**
 * Kullanıcının mevcut subscription durumunu getir
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
  const response = await axiosInstance.get<SubscriptionStatusResponse>(
    '/api/subscriptions/status'
  );
  return response.data;
}
