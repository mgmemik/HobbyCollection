'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAppVersions, updateVersionValidity, AppVersion, AppVersionUser } from '@/lib/api/admin/app-versions';
import { Smartphone, CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react';

export default function AppVersionsPage() {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['app-versions'],
    queryFn: getAppVersions,
  });

  const updateMutation = useMutation({
    mutationFn: ({ versionId, isValid }: { versionId: string; isValid: boolean }) =>
      updateVersionValidity(versionId, { isValid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-versions'] });
    },
  });

  const toggleVersion = (versionId: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  };

  const toggleValidity = async (version: AppVersion) => {
    if (confirm(`Sürüm ${version.version} geçerliliğini ${version.isValid ? 'geçersiz' : 'geçerli'} yapmak istediğinize emin misiniz?`)) {
      await updateMutation.mutateAsync({ versionId: version.id, isValid: !version.isValid });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">
          {error instanceof Error ? error.message : 'Veri yüklenirken hata oluştu'}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sürüm Yönetimi</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Uygulama sürümlerini görüntüleyin ve geçerlilik durumlarını yönetin
        </p>
      </div>

      {/* Sürümler */}
      <div className="space-y-4">
        {data.versions.map((version) => (
          <div
            key={version.id}
            className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {version.version}
                  </h2>
                  {version.isValid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Geçerli
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                      <XCircle className="h-3 w-3" />
                      Geçersiz
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({version.userCount} kullanıcı)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleValidity(version)}
                    disabled={updateMutation.isPending}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      version.isValid
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {version.isValid ? 'Geçersiz Yap' : 'Geçerli Yap'}
                  </button>
                  {version.userCount > 0 && (
                    <button
                      onClick={() => toggleVersion(version.id)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                      {expandedVersions.has(version.id) ? 'Gizle' : 'Göster'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {expandedVersions.has(version.id) && version.users && version.users.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                <div className="space-y-2">
                  {version.users.map((user: any) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {user.userName || 'Kullanıcı adı yok'}
                        </div>
                        {user.email && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sürümü Bilinmeyen Kullanıcılar */}
      {data.unknownVersion.userCount > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sürümü Bilinmeyen Kullanıcılar
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({data.unknownVersion.userCount} kullanıcı)
                </span>
              </div>
              <button
                onClick={() => toggleVersion('unknown')}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {expandedVersions.has('unknown') ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </div>
          {expandedVersions.has('unknown') && data.unknownVersion.users.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
              <div className="space-y-2">
                {data.unknownVersion.users.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.userName || 'Kullanıcı adı yok'}
                      </div>
                      {user.email && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {data.versions.length === 0 && data.unknownVersion.userCount === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Henüz sürüm bilgisi bulunmuyor</p>
        </div>
      )}
    </div>
  );
}
