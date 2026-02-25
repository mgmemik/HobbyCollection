import { API_BASE_URL } from './auth';
import i18n from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Category = {
  id: string;
  name: string;
  parentId?: string | null;
};

export async function fetchRoots(): Promise<Category[]> {
  const language = i18n.language || 'en';
  const langParam = language === 'tr' ? 'tr' : 'en';
  const res = await fetch(`${API_BASE_URL}/api/categories/roots?language=${langParam}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchChildren(ancestorId: string): Promise<Category[]> {
  // Prefer direct children endpoint to show one level at a time, already sorted by API
  const language = i18n.language || 'en';
  const langParam = language === 'tr' ? 'tr' : 'en';
  const res = await fetch(`${API_BASE_URL}/api/categories/children/${ancestorId}?language=${langParam}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCategoryPath(categoryId: string): Promise<Category[]> {
  const language = i18n.language || 'en';
  const langParam = language === 'tr' ? 'tr' : 'en';
  const res = await fetch(`${API_BASE_URL}/api/categories/path/${categoryId}?language=${langParam}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type SuggestCategoryResponse = {
  success: boolean;
  categoryId?: string;
  categoryPath?: Array<{ id: string; name: string }>;
  confidence?: number | null;
  reasoning?: string | null;
  error?: string;
};

export async function suggestCategoryByAI(token: string, productText: string): Promise<SuggestCategoryResponse> {
  // AI dilini AsyncStorage'dan oku (AI Language ayarı)
  const aiLanguage = (await AsyncStorage.getItem('ai_lang')) || 'en';
  const langParam = aiLanguage === 'tr' ? 'tr' : 'en';
  const res = await fetch(`${API_BASE_URL}/api/categories/ai-suggest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productText,
      language: langParam,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


