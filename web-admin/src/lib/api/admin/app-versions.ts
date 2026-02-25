import { apiClient } from '../client';

export interface AppVersionUser {
  userId: string;
  userName: string | null;
  email: string | null;
}

export interface AppVersion {
  id: string;
  version: string;
  isValid: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  userCount: number;
  users: (AppVersionUser | any)[]; // Backend'den object[] olarak gelebilir
}

export interface AppVersionsResponse {
  versions: AppVersion[];
  unknownVersion: {
    userCount: number;
    users: AppVersionUser[];
  };
}

export interface UpdateVersionValidityRequest {
  isValid: boolean;
}

// Tüm sürümleri ve kullanan kullanıcıları getir
export async function getAppVersions(): Promise<AppVersionsResponse> {
  const response = await apiClient.get<AppVersionsResponse>('/api/admin/app-versions');
  return response.data;
}

// Sürümün geçerliliğini güncelle
export async function updateVersionValidity(
  versionId: string,
  request: UpdateVersionValidityRequest
): Promise<void> {
  await apiClient.put(`/api/admin/app-versions/${versionId}/validity`, request);
}
