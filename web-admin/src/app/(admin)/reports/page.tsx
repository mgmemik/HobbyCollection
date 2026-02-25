'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSearchLogs, getSearchStatistics, GetSearchLogsParams, SearchLog } from '@/lib/api/admin/reports';
import { Search, TrendingUp, Users, Package, BarChart3, Calendar, Filter, Eye } from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'statistics' | 'logs'>('statistics');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState<GetSearchLogsParams>({
    searchType: undefined,
    userId: undefined,
    startDate: undefined,
    endDate: undefined,
  });

  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['search-statistics'],
    queryFn: () => getSearchStatistics(),
  });

  const params: GetSearchLogsParams = {
    page,
    pageSize,
    ...filters,
  };

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['search-logs', params],
    queryFn: () => getSearchLogs(params),
  });

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
    if (userAgent.includes('Mobile')) return 'Mobil Cihaz';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    return userAgent.substring(0, 50) + (userAgent.length > 50 ? '...' : '');
  };

  const clearFilters = () => {
    setFilters({
      searchType: undefined,
      userId: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Raporlar
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sistem raporları ve analitikler
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('statistics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'statistics'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <BarChart3 className="h-5 w-5 inline mr-2" />
            İstatistikler
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Search className="h-5 w-5 inline mr-2" />
            Arama Logları
          </button>
        </nav>
      </div>

      {/* Statistics Tab */}
      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Yükleniyor...
            </div>
          ) : statistics ? (
            <>
              {/* Main Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
                  <div className="flex items-center">
                    <Search className="h-6 w-6 text-blue-500 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Arama</div>
                      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalSearches}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
                  <div className="flex items-center">
                    <Package className="h-6 w-6 text-green-500 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Ürün Aramaları</div>
                      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.productSearches}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
                  <div className="flex items-center">
                    <Users className="h-6 w-6 text-purple-500 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Kullanıcı Aramaları</div>
                      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.userSearches}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
                  <div className="flex items-center">
                    <Eye className="h-6 w-6 text-orange-500 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Anonim Aramalar</div>
                      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.anonymousSearches}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
                  <div className="flex items-center">
                    <TrendingUp className="h-6 w-6 text-indigo-500 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Ort. Sonuç</div>
                      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.avgResultCount}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Queries */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  En Çok Aranan Sorgular
                </h2>
                <div className="space-y-2">
                  {statistics.topQueries.length > 0 ? (
                    statistics.topQueries.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {index + 1}. {item.query}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{item.count} arama</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Henüz arama yapılmamış</p>
                  )}
                </div>
              </div>

              {/* Top Categories */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  En Çok Aranan Kategoriler
                </h2>
                <div className="space-y-2">
                  {statistics.topCategories.length > 0 ? (
                    statistics.topCategories.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {index + 1}. {item.categoryName}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{item.count} arama</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Henüz kategori araması yapılmamış</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-red-500 dark:text-red-400">
              İstatistikler yüklenemedi
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Arama Tipi:</label>
                <select
                  value={filters.searchType || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, searchType: e.target.value || undefined });
                    setPage(1);
                  }}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tümü</option>
                  <option value="Products">Ürünler</option>
                  <option value="Users">Kullanıcılar</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Başlangıç:</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, startDate: e.target.value || undefined });
                    setPage(1);
                  }}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bitiş:</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, endDate: e.target.value || undefined });
                    setPage(1);
                  }}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1 text-sm rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <Filter className="h-4 w-4 inline mr-1" />
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
            {logsLoading ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                Yükleniyor...
              </div>
            ) : logsData && logsData.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tarih
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tip
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Sorgu
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Sonuç
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          IP
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cihaz
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {logsData.items.map((log: SearchLog) => (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(log.createdAtUtc)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.searchType === 'Products'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                            }`}>
                              {log.searchType === 'Products' ? 'Ürünler' : 'Kullanıcılar'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {log.query || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {log.resultCount} sonuç
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900/50 rounded-md">
                            {log.ipAddress}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatUserAgent(log.userAgent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsData.total > pageSize && (
                  <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Toplam <span className="font-medium">{logsData.total}</span> kayıttan{' '}
                      <span className="font-medium">{(page - 1) * pageSize + 1}</span> -{' '}
                      <span className="font-medium">{Math.min(page * pageSize, logsData.total)}</span> arası gösteriliyor
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Önceki
                      </button>
                      <span className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        Sayfa {page} / {Math.ceil(logsData.total / pageSize)}
                      </span>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= logsData.total}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                Arama logu bulunamadı
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
