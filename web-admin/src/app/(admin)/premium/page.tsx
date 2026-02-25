'use client';

import { useState, useEffect } from 'react';
import { getPremiumUsersCategorized, PremiumUsersCategorizedResponse, PremiumUserDetail } from '@/lib/api/admin/premium';
import { Crown, AlertTriangle, XCircle, User, Eye, EyeOff, Lock, Unlock, Zap } from 'lucide-react';

export default function PremiumPage() {
  const [data, setData] = useState<PremiumUsersCategorizedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'premium' | 'expiringSoon' | 'expired' | 'standard'>('premium');
  const [standardPage, setStandardPage] = useState(1);
  const pageSize = 50;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getPremiumUsersCategorized({ page: standardPage, pageSize });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [standardPage]);

  const renderUserRow = (user: PremiumUserDetail) => (
    <tr key={user.userId} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {user.userName}
            </div>
            {user.email && (
              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm">
            {user.isPrivateAccount ? (
              <>
                <Lock className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400">Gizli</span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Açık</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm">
            {user.isWebProfilePublic === true ? (
              <>
                <Eye className="h-4 w-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Açık</span>
              </>
            ) : user.isWebProfilePublic === false ? (
              <>
                <EyeOff className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400">Kapalı</span>
              </>
            ) : (
              <>
                <span className="text-gray-400">-</span>
              </>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {user.privateProductCount}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {user.aiCreditBalance}
          </span>
        </div>
      </td>
      {user.daysRemaining !== undefined && user.daysRemaining !== null && (
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`text-sm font-medium ${
            user.daysRemaining <= 7 
              ? 'text-red-600 dark:text-red-400' 
              : user.daysRemaining <= 30 
              ? 'text-orange-600 dark:text-orange-400' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {user.daysRemaining} gün
          </span>
        </td>
      )}
      {user.expiredAt && (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {new Date(user.expiredAt).toLocaleDateString('tr-TR')}
        </td>
      )}
    </tr>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          onClick={loadData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Premium Yönetimi</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Premium kullanıcıları, düşecek kullanıcıları ve standart kullanıcıları yönetin
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('premium')}
            className={`${
              activeTab === 'premium'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Crown className="h-5 w-5" />
            Premium Kullanıcılar ({data.premium.totalCount})
          </button>
          <button
            onClick={() => setActiveTab('expiringSoon')}
            className={`${
              activeTab === 'expiringSoon'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <AlertTriangle className="h-5 w-5" />
            Düşecek Kullanıcılar ({data.expiringSoon.totalCount})
          </button>
          <button
            onClick={() => setActiveTab('expired')}
            className={`${
              activeTab === 'expired'
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <XCircle className="h-5 w-5" />
            Düşmüş Kullanıcılar ({data.expired.totalCount})
          </button>
          <button
            onClick={() => setActiveTab('standard')}
            className={`${
              activeTab === 'standard'
                ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <User className="h-5 w-5" />
            Standart Kullanıcılar ({data.standard.totalCount})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kullanıcı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Profil Görünümü
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gizli Ürün
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  AI Kredi
                </th>
                {(activeTab === 'premium' || activeTab === 'expiringSoon') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kalan Gün
                  </th>
                )}
                {activeTab === 'expired' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Düşme Tarihi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {activeTab === 'premium' && data.premium.items.map(renderUserRow)}
              {activeTab === 'expiringSoon' && data.expiringSoon.items.map(renderUserRow)}
              {activeTab === 'expired' && data.expired.items.map(renderUserRow)}
              {activeTab === 'standard' && data.standard.items.map(renderUserRow)}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {((activeTab === 'premium' && data.premium.items.length === 0) ||
          (activeTab === 'expiringSoon' && data.expiringSoon.items.length === 0) ||
          (activeTab === 'expired' && data.expired.items.length === 0) ||
          (activeTab === 'standard' && data.standard.items.length === 0)) && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Henüz kullanıcı bulunmuyor</p>
          </div>
        )}

        {/* Pagination for Standard Users */}
        {activeTab === 'standard' && data.standard.totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setStandardPage(p => Math.max(1, p - 1))}
                disabled={standardPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Önceki
              </button>
              <button
                onClick={() => setStandardPage(p => Math.min(data.standard.totalPages, p + 1))}
                disabled={standardPage === data.standard.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sonraki
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Toplam <span className="font-medium">{data.standard.totalCount}</span> kullanıcıdan{' '}
                  <span className="font-medium">
                    {(standardPage - 1) * pageSize + 1}
                  </span>{' '}
                  -{' '}
                  <span className="font-medium">
                    {Math.min(standardPage * pageSize, data.standard.totalCount)}
                  </span>{' '}
                  arası gösteriliyor
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setStandardPage(p => Math.max(1, p - 1))}
                    disabled={standardPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Önceki
                  </button>
                  {Array.from({ length: Math.min(5, data.standard.totalPages) }, (_, i) => {
                    let pageNum;
                    if (data.standard.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (standardPage <= 3) {
                      pageNum = i + 1;
                    } else if (standardPage >= data.standard.totalPages - 2) {
                      pageNum = data.standard.totalPages - 4 + i;
                    } else {
                      pageNum = standardPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setStandardPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          standardPage === pageNum
                            ? 'z-10 bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setStandardPage(p => Math.min(data.standard.totalPages, p + 1))}
                    disabled={standardPage === data.standard.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sonraki
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
