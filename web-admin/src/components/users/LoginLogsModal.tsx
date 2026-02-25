'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserLoginLogs, LoginLog, GetLoginLogsParams } from '@/lib/api/admin/users';
import { X, CheckCircle, XCircle, LogIn, Loader2, AlertCircle } from 'lucide-react';

interface LoginLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string | null;
  userDisplayName: string;
}

export default function LoginLogsModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userDisplayName,
}: LoginLogsModalProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [successFilter, setSuccessFilter] = useState<boolean | undefined>(undefined);

  const params: GetLoginLogsParams = {
    page,
    pageSize,
    isSuccessful: successFilter,
  };

  const { data: loginLogsData, isLoading, error, refetch } = useQuery({
    queryKey: ['user-login-logs', userId, params],
    queryFn: () => getUserLoginLogs(userId, params),
    enabled: isOpen && !!userId,
    retry: 2,
  });

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setSuccessFilter(undefined);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
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
  };

  const formatUserAgent = (userAgent: string | null) => {
    if (!userAgent) return 'Bilinmiyor';
    // Basit user agent parsing
    if (userAgent.includes('Mobile')) return 'Mobil Cihaz';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    return userAgent.substring(0, 50) + (userAgent.length > 50 ? '...' : '');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-5xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <LogIn className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Login Logları
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {userDisplayName} {userEmail && `(${userEmail})`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">

            {/* Filters */}
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => {
                  setSuccessFilter(undefined);
                  setPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  successFilter === undefined
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => {
                  setSuccessFilter(true);
                  setPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  successFilter === true
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                Başarılı
              </button>
              <button
                onClick={() => {
                  setSuccessFilter(false);
                  setPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  successFilter === false
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <XCircle className="h-4 w-4" />
                Başarısız
              </button>
            </div>

            {/* Login Logs Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Veri yüklenirken hata oluştu</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : loginLogsData && loginLogsData.items.length > 0 ? (
              <>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Tarih
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Durum
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            IP Adresi
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Cihaz
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Hata Mesajı
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loginLogsData.items.map((log: LoginLog) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatDate(log.createdAtUtc)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {log.isSuccessful ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                  <CheckCircle className="h-3 w-3 mr-1.5" />
                                  Başarılı
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                  <XCircle className="h-3 w-3 mr-1.5" />
                                  Başarısız
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900/50 rounded">
                              {log.ipAddress}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                              {formatUserAgent(log.userAgent)}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                              {log.failureReason ? (
                                <span className="text-red-600 dark:text-red-400">{log.failureReason}</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {loginLogsData.total > pageSize && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Toplam <span className="font-medium">{loginLogsData.total}</span> kayıttan{' '}
                      <span className="font-medium">{(page - 1) * pageSize + 1}</span> -{' '}
                      <span className="font-medium">{Math.min(page * pageSize, loginLogsData.total)}</span> arası gösteriliyor
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Önceki
                      </button>
                      <span className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                        Sayfa {page} / {Math.ceil(loginLogsData.total / pageSize)}
                      </span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= loginLogsData.total}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : loginLogsData && loginLogsData.items.length === 0 ? (
              <div className="text-center py-12">
                <LogIn className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Login logu bulunamadı</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bu kullanıcı için henüz login kaydı yok.
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Veri yüklenemedi</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Lütfen sayfayı yenileyip tekrar deneyin.
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

