'use client';

import { UserActivity } from '@/lib/api/admin/users';
import { X, Package, Eye, EyeOff, DollarSign, Folder, Star, TrendingUp, Calendar, BarChart3, Heart, MessageSquare, Bookmark } from 'lucide-react';

interface UserActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: UserActivity | undefined;
  userEmail: string | null;
  userDisplayName: string;
}

export default function UserActivityModal({
  isOpen,
  onClose,
  activity,
  userEmail,
  userDisplayName,
}: UserActivityModalProps) {
  if (!isOpen || !activity) return null;

  const currency = (activity.priceCurrency ?? 'TRY').toUpperCase();
  const formatPrice = (value: number) => {
    const locales: Record<string, string> = {
      'TRY': 'tr-TR', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'JPY': 'ja-JP',
    };
    const locale = locales[currency] || 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
      }).format(value);
    } catch {
      return `${value.toLocaleString(locale)} ${currency}`;
    }
  };

  const getPatternColor = (pattern: string) => {
    switch (pattern) {
      case 'seller':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'collector':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'active':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'casual':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPatternLabel = (pattern: string) => {
    switch (pattern) {
      case 'seller':
        return 'Satıcı';
      case 'collector':
        return 'Koleksiyoncu';
      case 'active':
        return 'Aktif Kullanıcı';
      case 'casual':
        return 'Gündelik Kullanıcı';
      default:
        return 'Normal Kullanıcı';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Kullanıcı Aktivite Analizi
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {userDisplayName} ({userEmail})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Kullanım Pattern */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Kullanım Pattern'i
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPatternColor(activity.usagePattern)}`}>
                {getPatternLabel(activity.usagePattern)}
              </span>
            </div>
            {activity.patternReasons.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Neden:</strong> {activity.patternReasons.join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Genel İstatistikler */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Genel İstatistikler
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Package className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Ürün</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.totalProducts}</div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Eye className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Açık Ürün</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.publicProducts}</div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <EyeOff className="h-5 w-5 text-orange-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Özel Ürün</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.privateProducts}</div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Star className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Öne Çıkan</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.featuredProducts}</div>
              </div>
            </div>
          </div>

          {/* Kullanıcı Tarih Bilgileri */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Kullanıcı Tarih Bilgileri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Calendar className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Hesap Oluşturulma</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {activity.userCreatedDate 
                    ? new Date(activity.userCreatedDate).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Bilinmiyor'}
                </div>
                {activity.userCreatedDate && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.floor((new Date().getTime() - new Date(activity.userCreatedDate).getTime()) / (1000 * 60 * 60 * 24))} gün önce
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Calendar className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Aktifleştirilme</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {activity.activatedDate 
                    ? new Date(activity.activatedDate).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Henüz aktifleştirilmemiş'}
                </div>
                {activity.activatedDate && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.floor((new Date().getTime() - new Date(activity.activatedDate).getTime()) / (1000 * 60 * 60 * 24))} gün önce
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Calendar className="h-5 w-5 text-purple-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Son Giriş</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {activity.lastLoginDate 
                    ? new Date(activity.lastLoginDate).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Henüz giriş yapmamış'}
                </div>
                {activity.lastLoginDate && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.floor((new Date().getTime() - new Date(activity.lastLoginDate).getTime()) / (1000 * 60 * 60 * 24))} gün önce
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Aktivite Zamanlaması */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Aktivite Zamanlaması
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Calendar className="h-5 w-5 text-purple-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">İlk Ürün</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {activity.firstProductDate 
                    ? new Date(activity.firstProductDate).toLocaleDateString('tr-TR')
                    : 'Henüz ürün yok'}
                </div>
                {activity.daysSinceFirstProduct > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {activity.daysSinceFirstProduct} gün önce
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Calendar className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Son Ürün</span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {activity.lastProductDate 
                    ? new Date(activity.lastProductDate).toLocaleDateString('tr-TR')
                    : 'Henüz ürün yok'}
                </div>
                {activity.daysSinceLastProduct > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {activity.daysSinceLastProduct} gün önce
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Son 30 Gün</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.productsLast30Days}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">ürün eklendi</div>
              </div>
            </div>
          </div>

          {/* Kategori Dağılımı */}
          {activity.categoryDistribution.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Kategori Dağılımı
              </h3>
              <div className="space-y-2">
                {activity.categoryDistribution.map((cat, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Folder className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{cat.count} ürün</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{cat.percentage}%</span>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fiyat İstatistikleri */}
          {activity.priceStatistics && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Fiyat İstatistikleri <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({currency})</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center mb-2">
                    <DollarSign className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Min</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatPrice(activity.priceStatistics.min)}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center mb-2">
                    <DollarSign className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Max</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatPrice(activity.priceStatistics.max)}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center mb-2">
                    <BarChart3 className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ortalama</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatPrice(Math.round(activity.priceStatistics.avg * 100) / 100)}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center mb-2">
                    <DollarSign className="h-5 w-5 text-purple-500 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatPrice(Math.round(activity.priceStatistics.total * 100) / 100)}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center mb-2">
                    <Package className="h-5 w-5 text-gray-500 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Fiyatlı</span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {activity.priceStatistics.count}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Badge Kullanımı */}
          {(activity.badgeUsage.rare > 0 || activity.badgeUsage.mint > 0 || activity.badgeUsage.graded > 0 || 
            activity.badgeUsage.signed > 0 || activity.badgeUsage.limited > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Badge Kullanımı
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {activity.badgeUsage.rare > 0 && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Nadir</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{activity.badgeUsage.rare}</div>
                  </div>
                )}
                {activity.badgeUsage.mint > 0 && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Mint</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{activity.badgeUsage.mint}</div>
                  </div>
                )}
                {activity.badgeUsage.graded > 0 && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Graded</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{activity.badgeUsage.graded}</div>
                  </div>
                )}
                {activity.badgeUsage.signed > 0 && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">İmzalı</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{activity.badgeUsage.signed}</div>
                  </div>
                )}
                {activity.badgeUsage.limited > 0 && (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Limited</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{activity.badgeUsage.limited}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Etkileşim İstatistikleri */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Etkileşim İstatistikleri
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Heart className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Beğeni</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.engagement.totalLikesReceived}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Ort: {activity.engagement.avgLikesPerProduct.toFixed(1)}/ürün
                </div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <MessageSquare className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Yorum</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.engagement.totalCommentsReceived}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Ort: {activity.engagement.avgCommentsPerProduct.toFixed(1)}/ürün
                </div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-2">
                  <Bookmark className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Kayıt</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{activity.engagement.totalSavesReceived}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

