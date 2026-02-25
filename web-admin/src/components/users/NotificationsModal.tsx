import React, { useMemo, useState } from 'react';
import { Bell, Send, X, Power } from 'lucide-react';
import { sendUserTestPush, updateUserNotificationPermission } from '@/lib/api/admin/users';
import type { DeviceInfo } from '@/lib/api/admin/users';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userDisplayName: string;
  devices: DeviceInfo[];
  onUpdate?: () => void;
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export default function NotificationsModal({
  isOpen,
  onClose,
  userId,
  userDisplayName,
  devices,
  onUpdate,
}: NotificationsModalProps) {
  const [title, setTitle] = useState('Test Bildirimi');
  const [body, setBody] = useState('Bu bir test push bildirimi.');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ 
    type: 'success' | 'error'; 
    text: string;
    details?: {
      totalDevices: number;
      sentCount: number;
      failedCount: number;
      deviceResults: Array<{
        tokenMasked: string;
        platform: string;
        status: string;
        errorMessage?: string;
        expoTicketId?: string;
      }>;
      expoApiResponse?: string;
    };
  } | null>(null);
  const [isUpdatingPermission, setIsUpdatingPermission] = useState(false);

  const summary = useMemo(() => {
    const deviceCount = devices.length;
    const hasPermission = devices.some((d) => d.hasNotificationPermission);
    const hasPushToken = devices.some((d) => d.hasPushToken);
    const activeTokenCount = devices.filter((d) => d.isActive && d.hasPushToken && d.hasNotificationPermission).length;
    const lastUpdatedUtc = devices
      .map((d) => d.lastUpdatedUtc)
      .sort()
      .slice(-1)[0];
    return { deviceCount, hasPermission, hasPushToken, activeTokenCount, lastUpdatedUtc };
  }, [devices]);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsSending(true);
    setResult(null);
    try {
      const res = await sendUserTestPush(userId, { title, body });
      setResult({ 
        type: res.sent ? 'success' : 'error', 
        text: res.message,
        details: {
          totalDevices: res.totalDevices,
          sentCount: res.sentCount,
          failedCount: res.failedCount,
          deviceResults: res.deviceResults,
          expoApiResponse: res.expoApiResponse
        }
      });
    } catch (e: any) {
      console.error('Test push error:', e);
      let errorMessage = 'Gönderim başarısız';
      
      if (e?.code === 'ERR_NETWORK' || e?.message?.includes('Network Error') || e?.message?.includes('network')) {
        errorMessage = 'Ağ hatası: Backend\'e bağlanılamadı. API URL\'ini kontrol edin.';
      } else if (e?.response?.status === 404) {
        errorMessage = 'Endpoint bulunamadı. Backend\'in güncel olduğundan emin olun.';
      } else if (e?.response?.status === 500) {
        errorMessage = `Sunucu hatası: ${e?.response?.data?.message || 'Bilinmeyen hata'}`;
      } else if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.message) {
        errorMessage = e.message;
      }
      
      setResult({ type: 'error', text: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  const handleTogglePermission = async (enabled: boolean) => {
    setIsUpdatingPermission(true);
    setResult(null);
    try {
      const res = await updateUserNotificationPermission(userId, { enabled });
      setResult({ type: 'success', text: res.message });
      // Parent component'e güncelleme sinyali gönder
      if (onUpdate) {
        setTimeout(() => {
          onUpdate();
        }, 1000);
      }
    } catch (e: any) {
      setResult({ type: 'error', text: e?.response?.data?.message || e?.message || 'İzin durumu güncellenemedi' });
    } finally {
      setIsUpdatingPermission(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-amber-500" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Bildirimler - {userDisplayName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {summary.deviceCount} cihaz • aktif token: {summary.activeTokenCount}
                {summary.lastUpdatedUtc ? ` • son güncelleme: ${formatDate(summary.lastUpdatedUtc)}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${summary.hasPermission ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
              İzin: {summary.hasPermission ? 'Var' : 'Yok'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${summary.hasPushToken ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
              Token: {summary.hasPushToken ? 'Var' : 'Yok'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${summary.activeTokenCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
              Aktif Token: {summary.activeTokenCount}
            </span>
          </div>

          {/* Manual Enable/Disable */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Power className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Bildirim İzni Yönetimi</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Tüm cihazlarda bildirim iznini manuel olarak aç/kapat
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${summary.hasPermission ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {summary.hasPermission ? 'Açık' : 'Kapalı'}
                </span>
                <button
                  onClick={() => handleTogglePermission(!summary.hasPermission)}
                  disabled={isUpdatingPermission}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                    summary.hasPermission
                      ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                      : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                  }`}
                >
                  {isUpdatingPermission ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Güncelleniyor...
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4" />
                      {summary.hasPermission ? 'Kapat' : 'Aç'}
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Not: Bu işlem kullanıcının tüm cihazlarında bildirim iznini {summary.hasPermission ? 'kapatır' : 'açar'}. 
              Kullanıcı telefon ayarlarından manuel olarak değiştirebilir.
            </div>
          </div>

          {/* Test push */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Test Bildirimi Gönder</div>
              <button
                onClick={handleSend}
                disabled={isSending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Gönder
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Başlık</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mesaj</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              {result && (
                <div className="space-y-3">
                  <div className={`text-sm font-semibold ${result.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {result.text}
                  </div>
                  
                  {result.details && (
                    <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded">
                          <div className="text-gray-500 dark:text-gray-400">Toplam Cihaz</div>
                          <div className="font-semibold text-gray-900 dark:text-white">{result.details.totalDevices}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                          <div className="text-green-600 dark:text-green-400">Başarılı</div>
                          <div className="font-semibold text-green-700 dark:text-green-300">{result.details.sentCount}</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          <div className="text-red-600 dark:text-red-400">Başarısız</div>
                          <div className="font-semibold text-red-700 dark:text-red-300">{result.details.failedCount}</div>
                        </div>
                      </div>

                      {result.details.deviceResults.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cihaz Detayları:</div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {result.details.deviceResults.map((device, idx) => (
                              <div key={idx} className={`text-xs p-2 rounded border ${
                                device.status === 'ok' 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${device.status === 'ok' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                      {device.status === 'ok' ? '✓' : '✗'}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300">{device.platform}</span>
                                    <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">{device.tokenMasked}</span>
                                  </div>
                                  {device.expoTicketId && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">ID: {device.expoTicketId}</span>
                                  )}
                                </div>
                                {device.errorMessage && (
                                  <div className="mt-1 text-red-600 dark:text-red-400 text-[10px]">{device.errorMessage}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.details.expoApiResponse && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                            Expo API Response (detaylar için tıklayın)
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-[10px] overflow-x-auto font-mono">
                            {JSON.stringify(JSON.parse(result.details.expoApiResponse), null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not: Push gönderimi için kullanıcının en az 1 aktif cihazında (son 30 gün) token + izin olmalı.
              </div>
            </div>
          </div>

          {/* Device details table (reuse style) */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm font-semibold text-gray-900 dark:text-white">
              Cihaz / Bildirim Detayları
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-white dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Platform</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Versiyon</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">İzin</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Token</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aktif</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Son Güncelleme</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {devices.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                        Cihaz kaydı yok
                      </td>
                    </tr>
                  ) : (
                    devices.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">{d.platform}</td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {d.appVersion || '-'}{d.buildNumber ? ` (${d.buildNumber})` : ''} • {d.osVersion || '-'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`${d.hasNotificationPermission ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-semibold`}>
                            {d.hasNotificationPermission ? 'Var' : 'Yok'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {d.hasPushToken ? (d.pushTokenMasked || 'Kayıtlı') : 'Yok'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`${d.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'} font-semibold`}>
                            {d.isActive ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatDate(d.lastUpdatedUtc)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


