'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/api/admin/dashboard';
import { 
  Users, 
  Package, 
  FolderTree, 
  Heart, 
  MessageSquare, 
  Bookmark, 
  TrendingUp, 
  TrendingDown,
  UserCheck,
  Shield,
  Eye,
  EyeOff,
  Calendar,
  Activity,
  LogIn,
  AlertCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 60000, // Her 1 dakikada bir yenile
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getTrendPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Veri yüklenirken hata oluştu
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Lütfen sayfayı yenileyip tekrar deneyin
          </p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const productTrend7Days = stats.trends.dailyProductCounts.slice(-7);
  const productTrend30Days = stats.trends.dailyProductCounts;
  const avgProductsLast7Days = productTrend7Days.reduce((sum, d) => sum + d.count, 0) / 7;
  const avgProductsLast30Days = productTrend30Days.reduce((sum, d) => sum + d.count, 0) / 30;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sistem genel bakış ve istatistikler
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Activity className="h-4 w-4" />
          <span>Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Kullanıcı</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.users.total.toLocaleString('tr-TR')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.users.emailConfirmed} onaylı
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Ürün</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.products.total.toLocaleString('tr-TR')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Bugün: {stats.products.today}
                </span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Package className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Kategoriler</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.categories.total}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Package className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.categories.withProducts} aktif
                </span>
              </div>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FolderTree className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Engagement */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Etkileşim</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {(stats.engagement.totalLikes + stats.engagement.totalComments + stats.engagement.totalSaves).toLocaleString('tr-TR')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.engagement.totalLikes} beğeni
                </span>
              </div>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Heart className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* User Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kullanıcı İstatistikleri
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Admin Kullanıcılar</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.users.admin}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Email Onaylı</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.users.emailConfirmed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Son 30 Gün Aktif</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.users.activeLast30Days}
              </span>
            </div>
          </div>
          <Link
            href="/users"
            className="mt-4 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            Tüm kullanıcıları görüntüle
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Product Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ürün İstatistikleri
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Herkese Açık</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.products.public}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Özel</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.products.private}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Son 7 Gün</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.products.last7Days}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Son 30 Gün</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.products.last30Days}
              </span>
            </div>
          </div>
          <Link
            href="/products"
            className="mt-4 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            Tüm ürünleri görüntüle
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Engagement Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Etkileşim İstatistikleri
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Toplam Beğeni</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.engagement.totalLikes.toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Toplam Yorum</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.engagement.totalComments.toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Toplam Kayıt</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.engagement.totalSaves.toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Bugün</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stats.engagement.likesToday} beğeni
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">
                  {stats.engagement.commentsToday} yorum
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Bugünkü Aktivite
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Today's Confirmed Users */}
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Onaylı Kullanıcı</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.users.emailConfirmedToday}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Products */}
          <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Yeni Ürün</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.products.today}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Likes */}
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Beğeni</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.engagement.likesToday}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Comments */}
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Yorum</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.engagement.commentsToday}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Saves */}
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Bookmark className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Kayıt</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.engagement.savesToday}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Trends */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Products */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Son Eklenen Ürünler
          </h3>
          <div className="space-y-3">
            {stats.recentProducts.length > 0 ? (
              stats.recentProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(product.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {product.isPublic ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Henüz ürün eklenmemiş
              </p>
            )}
          </div>
          <Link
            href="/products"
            className="mt-4 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            Tüm ürünleri görüntüle
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Recent Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Son Kayıt Olan Kullanıcılar
          </h3>
          <div className="space-y-3">
            {stats.recentUsers.length > 0 ? (
              stats.recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.displayName || user.email || 'Bilinmeyen'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {user.isAdmin && (
                      <Shield className="h-4 w-4 text-purple-500" />
                    )}
                    {user.emailConfirmed ? (
                      <UserCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Henüz kullanıcı yok
              </p>
            )}
          </div>
          <Link
            href="/users"
            className="mt-4 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            Tüm kullanıcıları görüntüle
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Son 30 Günlük Ürün Ekleme Trendi
        </h3>
        <div className="space-y-4">
          <div className="flex items-end justify-between h-48 gap-1">
            {stats.trends.dailyProductCounts.map((day, index) => {
              const maxCount = Math.max(...stats.trends.dailyProductCounts.map(d => d.count), 1);
              const height = (day.count / maxCount) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-500 dark:bg-purple-600 rounded-t transition-all hover:bg-purple-600 dark:hover:bg-purple-500"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${day.date}: ${day.count} ürün`}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 transform -rotate-45 origin-top-left whitespace-nowrap">
                    {new Date(day.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Ortalama (7 gün): <span className="font-semibold text-gray-900 dark:text-white">{avgProductsLast7Days.toFixed(1)}</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Ortalama (30 gün): <span className="font-semibold text-gray-900 dark:text-white">{avgProductsLast30Days.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
