import { API_BASE_URL } from './auth';

export type PreferencesDto = {
  uiLanguage: string;
  aiLanguage: string;
  username?: string | null;
  currency?: string | null;
  isPrivateAccount?: boolean | null;
  isWebProfilePublic?: boolean | null;
  avatarUrl?: string | null;
  isPremium?: boolean;
  webProfileUrl?: string | null; // Deprecated - frontend'de username ile oluşturulmalı
};

export async function fetchUserPreferences(token: string): Promise<PreferencesDto> {
  const res = await fetch(`${API_BASE_URL}/api/userpreferences`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const raw = await res.json();
  // Backend bazen PascalCase (UiLanguage/AvatarUrl) bazen camelCase döndürebiliyor.
  const uiLanguage = raw?.uiLanguage ?? raw?.UiLanguage ?? 'en';
  const aiLanguage = raw?.aiLanguage ?? raw?.AiLanguage ?? 'en';
  const username = raw?.username ?? raw?.Username ?? null;
  const currency = raw?.currency ?? raw?.Currency ?? null;
  const isPrivateAccount = raw?.isPrivateAccount ?? raw?.IsPrivateAccount ?? null;
  const isWebProfilePublic = raw?.isWebProfilePublic ?? raw?.IsWebProfilePublic ?? false;
  const avatarUrl = raw?.avatarUrl ?? raw?.AvatarUrl ?? null;
  const isPremium = raw?.isPremium ?? raw?.IsPremium ?? false;
  // webProfileUrl artık backend'den gelmiyor - frontend'de username ile oluşturulacak

  return {
    uiLanguage,
    aiLanguage,
    username,
    currency,
    isPrivateAccount,
    isWebProfilePublic,
    avatarUrl,
    isPremium,
    webProfileUrl: null, // Artık kullanılmıyor - frontend'de username ile oluşturulmalı
  };
}

export async function updateUserPreferences(token: string, prefs: PreferencesDto): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/userpreferences`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(await res.text());
}
