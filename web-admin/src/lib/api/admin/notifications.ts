import { apiClient } from '../client';

export type AdminNotificationTarget = 'all' | 'filtered';

export type AdminNotificationFilters = {
  search?: string;
  isAdmin?: boolean;
  emailConfirmed?: boolean;
  isPrivateAccount?: boolean;
  activeDays?: number;
  loginDays?: number;
  hasProducts?: boolean;

  // Bildirim/push odaklı filtreler
  hasNotificationPermission?: boolean;
  hasPushToken?: boolean;
  minActivePushTokensLast30Days?: number;
};

export type SendAdminNotificationRequest = {
  title: string;
  message?: string | null;
  sendInApp: boolean;
  sendPush: boolean;
  target: AdminNotificationTarget;
  filters?: AdminNotificationFilters;
  dryRun?: boolean;
};

export type SendAdminNotificationResponse = {
  recipientCount: number;
  inAppCreatedCount: number;
  pushEnqueued: boolean;
};

export async function sendAdminNotification(
  payload: SendAdminNotificationRequest
): Promise<SendAdminNotificationResponse> {
  const response = await apiClient.post<SendAdminNotificationResponse>('/api/admin/notifications/send', payload);
  return response.data;
}

