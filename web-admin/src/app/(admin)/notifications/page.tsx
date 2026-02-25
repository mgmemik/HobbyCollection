'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Send, Users, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendAdminNotification, type AdminNotificationTarget, type SendAdminNotificationRequest } from '@/lib/api/admin/notifications';

type TargetMode = AdminNotificationTarget;

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<{ inApp: boolean; push: boolean }>({ inApp: true, push: false });
  const [targetMode, setTargetMode] = useState<TargetMode>('all');

  const [filters, setFilters] = useState<{
    search?: string;
    isAdmin?: boolean;
    emailConfirmed?: boolean;
    isPrivateAccount?: boolean;
    activeDays?: number;
    loginDays?: number;
    hasProducts?: boolean;
    hasNotificationPermission?: boolean;
    hasPushToken?: boolean;
    minActivePushTokensLast30Days?: number;
  }>({});

  const payload = useMemo<SendAdminNotificationRequest>(() => {
    return {
      title: title.trim(),
      message: message.trim() || null,
      sendInApp: channels.inApp,
      sendPush: channels.push,
      target: targetMode === 'all' ? 'all' : 'filtered',
      filters: targetMode === 'filtered' ? filters : undefined,
      dryRun: false,
    };
  }, [title, message, channels, targetMode, filters]);

  const mutation = useMutation({
    mutationFn: () => sendAdminNotification(payload),
  });

  const canSend = payload.title.length > 0 && (payload.sendInApp || payload.sendPush);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Genel veya filtreli kullanıcı grubuna in-app / push bildirim gönderin.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlık</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              placeholder="Örn: Yeni özellik yayında"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hedef</label>
            <select
              value={targetMode}
              onChange={(e) => setTargetMode(e.target.value as TargetMode)}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            >
              <option value="all">Genel (tüm kullanıcılar)</option>
              <option value="filtered">Grup (filtreli)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mesaj</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            placeholder="Opsiyonel"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kanal</span>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={channels.inApp}
                onChange={(e) => setChannels((p) => ({ ...p, inApp: e.target.checked }))}
              />
              In-app
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={channels.push}
                onChange={(e) => setChannels((p) => ({ ...p, push: e.target.checked }))}
              />
              Push
            </label>
          </div>

          <button
            disabled={!canSend || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-purple-600 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Gönder
          </button>
        </div>

        {targetMode === 'filtered' && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
              <Filter className="h-4 w-4" /> Kullanıcı Filtreleri
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Arama</label>
                <input
                  value={filters.search || ''}
                  onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="email / username / displayName"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Son X gün aktif (ürün ekleyen)</label>
                <input
                  type="number"
                  value={filters.activeDays ?? ''}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, activeDays: e.target.value ? Number(e.target.value) : undefined }))
                  }
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="Örn: 30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Son X gün login</label>
                <input
                  type="number"
                  value={filters.loginDays ?? ''}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, loginDays: e.target.value ? Number(e.target.value) : undefined }))
                  }
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="Örn: 30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.hasPushToken ?? false}
                  onChange={(e) => setFilters((p) => ({ ...p, hasPushToken: e.target.checked ? true : undefined }))}
                />
                Push token olanlar
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.hasNotificationPermission ?? false}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, hasNotificationPermission: e.target.checked ? true : undefined }))
                  }
                />
                Bildirim izni olanlar
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.hasProducts ?? false}
                  onChange={(e) => setFilters((p) => ({ ...p, hasProducts: e.target.checked ? true : undefined }))}
                />
                Ürünü olanlar
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.isAdmin ?? false}
                  onChange={(e) => setFilters((p) => ({ ...p, isAdmin: e.target.checked ? true : undefined }))}
                />
                Sadece admin
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.emailConfirmed ?? false}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, emailConfirmed: e.target.checked ? true : undefined }))
                  }
                />
                Email onaylı
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.isPrivateAccount ?? false}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, isPrivateAccount: e.target.checked ? true : undefined }))
                  }
                />
                Private hesap
              </label>
            </div>
          </div>
        )}

        {mutation.isSuccess && (
          <div className="flex items-start gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div className="text-sm">
              Gönderme isteği alındı. (Detaylar backend yanıtı ile gelecek)
            </div>
          </div>
        )}

        {mutation.isError && (
          <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div className="text-sm">
              Gönderim başarısız: {(mutation.error as any)?.response?.data?.message || (mutation.error as any)?.message}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Not: Push seçiliyse, backend push token’ı olmayan kullanıcıları otomatik atlayacak.
        </div>
      </div>
    </div>
  );
}

