import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './auth';

export type ReportReason = {
  value: string;
  label: {
    en: string;
    tr: string;
  };
};

export type CreateReportRequest = {
  contentType: 'product' | 'user' | 'comment';
  contentId: string;
  reason: string;
  description?: string;
};

export type CreateReportResponse = {
  id: string;
  message: string;
};

/// <summary>
/// Şikayet sebeplerini getirir
/// </summary>
export async function getReportReasons(): Promise<ReportReason[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reports/reasons`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (error: any) {
    console.error('getReportReasons error:', error);
    throw error;
  }
}

/// <summary>
/// Yeni şikayet oluşturur
/// </summary>
export async function createReport(request: CreateReportRequest): Promise<CreateReportResponse> {
  const token = (await AsyncStorage.getItem('auth_token')) || '';
  if (!token) throw new Error('Auth required');
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `HTTP ${res.status}`);
    }
    
    return res.json();
  } catch (error: any) {
    console.error('createReport error:', error);
    throw error;
  }
}
