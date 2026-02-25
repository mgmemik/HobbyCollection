'use client';

import { useEffect, useState } from 'react';
import { X, Eye, EyeOff, Globe, AlertCircle, Crown, CheckCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser, updateUser } from '@/lib/api/admin/users';

interface ProfileVisibilityModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function ProfileVisibilityModal({
  userId,
  userName,
  isOpen,
  onClose,
  onUpdate,
}: ProfileVisibilityModalProps) {
  const queryClient = useQueryClient();
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [isWebProfilePublic, setIsWebProfilePublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kullanıcı detaylarını çek
  const { data: userDetail, isLoading } = useQuery({
    queryKey: ['user-detail-visibility', userId],
    queryFn: () => getUser(userId),
    enabled: isOpen && !!userId,
  });

  // State'leri güncelle
  useEffect(() => {
    if (userDetail) {
      setIsPrivateAccount(userDetail.isPrivateAccount || false);
      setIsWebProfilePublic(userDetail.isWebProfilePublic || false);
      // userName veya username kullan (backend farklı fieldlarla dönebilir)
      userDetail.username = userDetail.username || userDetail.userName;
    }
  }, [userDetail]);

  const updateMutation = useMutation({
    mutationFn: ({ data }: { data: any }) => updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail-visibility', userId] });
      if (onUpdate) onUpdate();
      setError(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Güncelleme sırasında bir hata oluştu';
      setError(errorMessage);
    },
  });

  const handleTogglePrivateAccount = async () => {
    // Standart kullanıcı için uyarı
    if (!isPremium && !isPrivateAccount) {
      setError('⚠️ Standart kullanıcıların profili her zaman görünür olmalıdır. Premium olmayan kullanıcılar profilini gizleyemez.');
      return;
    }
    
    const newValue = !isPrivateAccount;
    setError(null);
    
    try {
      // Eğer profil kapatılıyorsa, web profili de otomatik kapanacak (backend otomatik yapar)
      await updateMutation.mutateAsync({
        data: {
          isPrivateAccount: newValue,
          // Web profili de kapatılsın
          ...(newValue && isWebProfilePublic ? { isWebProfilePublic: false } : {}),
        },
      });
      
      setIsPrivateAccount(newValue);
      if (newValue) {
        setIsWebProfilePublic(false);
      }
    } catch (err) {
      // Error zaten mutation'da handle ediliyor
    }
  };

  const handleToggleWebProfile = async () => {
    const newValue = !isWebProfilePublic;
    setError(null);

    // İstemci tarafı kontrolü
    if (newValue && isPrivateAccount) {
      setError('⚠️ Önce uygulama profilini herkese açık yapmalısınız');
      return;
    }

    if (newValue && userDetail?.planStatus !== 'premium') {
      setError('⚠️ Web profil görünürlüğü sadece premium üyeler için kullanılabilir. Standart kullanıcılar web profilini açamaz.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        data: { isWebProfilePublic: newValue },
      });
      setIsWebProfilePublic(newValue);
    } catch (err) {
      // Error zaten mutation'da handle ediliyor
    }
  };

  if (!isOpen) return null;

  const isPremium = userDetail?.planStatus === 'premium';
  const webProfileDisabled = isPrivateAccount || !isPremium;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Profil Görünürlüğü Ayarları
            </h2>
            {userName && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {userName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Yükleniyor...</p>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Premium Status Info */}
              {!isPremium && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <Crown className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-300">
                    <p className="font-semibold">Standart Kullanıcı</p>
                    <p className="mt-1">Web profil görünürlüğü sadece premium üyeler için kullanılabilir.</p>
                  </div>
                </div>
              )}

              {/* Uygulama Profili Görünürlüğü */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!isPrivateAccount ? (
                        <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <EyeOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      )}
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Uygulama Profili
                      </h3>
                      {!isPremium && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                          Standart
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {!isPremium
                        ? 'Standart kullanıcı - Profil her zaman görünür'
                        : !isPrivateAccount
                        ? 'Görünür - Herkes profilini görebilir'
                        : 'Gizli - Sadece onaylı takipçiler görebilir'}
                    </p>
                  </div>
                  <button
                    onClick={handleTogglePrivateAccount}
                    disabled={!isPremium || updateMutation.isPending} // Standart kullanıcılar için disabled
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      !isPrivateAccount
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-orange-600 dark:bg-orange-500'
                    } ${!isPremium || updateMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        !isPrivateAccount ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {!isPrivateAccount ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      <Eye className="h-3 w-3 mr-1" />
                      Görünür
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Gizli
                    </span>
                  )}
                </div>
              </div>

              {/* Web Profili Görünürlüğü */}
              <div className={`bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 space-y-4 ${
                webProfileDisabled ? 'opacity-60' : ''
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className={`h-5 w-5 ${
                        isWebProfilePublic
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-400 dark:text-gray-600'
                      }`} />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Web Profili
                      </h3>
                      {!isPremium && (
                        <Crown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {webProfileDisabled
                        ? isPrivateAccount
                          ? 'Uygulama profili açık olmalı'
                          : 'Premium üyelik gerekli'
                        : isWebProfilePublic
                        ? 'Web üzerinde herkese açık profil sayfası aktif'
                        : 'Web üzerinde profil sayfası kapalı'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleWebProfile}
                    disabled={webProfileDisabled || updateMutation.isPending}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isWebProfilePublic && !webProfileDisabled
                        ? 'bg-green-600 dark:bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    } ${webProfileDisabled || updateMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isWebProfilePublic && !webProfileDisabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {isWebProfilePublic && !webProfileDisabled ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      Kapalı
                    </span>
                  )}
                </div>

                {/* Web Profile URL */}
                {isWebProfilePublic && !webProfileDisabled && userDetail?.username && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Web Profil Linki:
                    </p>
                    <a
                      href={`https://www.save-all.com/u/${userDetail.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      https://www.save-all.com/u/{userDetail.username}
                    </a>
                  </div>
                )}
              </div>

              {/* Rules Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                  📋 Kurallar
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li>• <strong>Standart kullanıcı:</strong> Uygulama profili her zaman görünür (kapatılamaz), Web profili kapalı (açılamaz)</li>
                  <li>• <strong>Premium kullanıcı:</strong> Uygulama profilini kapatabilir, Web profilini (uygulama profili açıksa) açıp kapatabilir</li>
                  <li>• Uygulama profili kapatıldığında web profili otomatik kapanır</li>
                  <li>• Premium satın alındığında web profili otomatik açılır</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
