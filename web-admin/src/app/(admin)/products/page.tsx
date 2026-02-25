'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProducts,
  getProductStatistics,
  deleteProduct,
  updateProduct,
  Product,
  ProductStatistics,
  GetProductsParams,
} from '@/lib/api/admin/products';
import { getCategories } from '@/lib/api/admin/categories';
import { Search, Package, Eye, EyeOff, MessageSquare, Heart, Bookmark, Star, Filter, Trash2, Edit, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

// Para birimi formatlama fonksiyonu
function formatPrice(price: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    'TRY': '₺',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
  };

  const locales: Record<string, string> = {
    'TRY': 'tr-TR',
    'USD': 'en-US',
    'EUR': 'de-DE',
    'GBP': 'en-GB',
    'JPY': 'ja-JP',
  };

  const symbol = currencySymbols[currency] || currency;
  const locale = locales[currency] || 'en-US';

  // JPY için ondalık basamak yok
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  };

  try {
    return new Intl.NumberFormat(locale, options).format(price);
  } catch {
    // Fallback: Sadece sembol ile göster
    return `${price.toLocaleString(locale)} ${symbol}`;
  }
}

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    userId?: string;
    categoryId?: string;
    isPublic?: boolean;
    createdDays?: number;
  }>({});
  const [sortBy, setSortBy] = useState<'createdAt' | 'title' | 'commentCount' | 'likeCount' | 'saveCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const queryClient = useQueryClient();

  const params: GetProductsParams = {
    page,
    pageSize,
    search: searchQuery || undefined,
    sortBy,
    sortOrder,
    ...filters,
  };

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', params],
    queryFn: () => getProducts(params),
  });

  const { data: statistics } = useQuery({
    queryKey: ['product-statistics'],
    queryFn: getProductStatistics,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-statistics'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-statistics'] });
    },
  });

  const handleDelete = async (product: Product) => {
    if (confirm(`"${product.title}" ürününü silmek istediğinize emin misiniz?`)) {
      try {
        await deleteMutation.mutateAsync(product.id);
        alert('Ürün başarıyla silindi');
      } catch (error: any) {
        alert(error.response?.data?.message || 'Ürün silinirken hata oluştu');
      }
    }
  };

  const handleTogglePublic = async (product: Product) => {
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        data: { isPublic: !product.isPublic },
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ürün güncellenirken hata oluştu');
    }
  };

  const handleToggleFeatured = async (product: Product) => {
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        data: { isFeatured: !product.isFeatured },
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ürün güncellenirken hata oluştu');
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || searchQuery.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Ürün Yönetimi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ürünleri görüntüleyin ve yönetin
          </p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
            <div className="flex items-center">
              <Package className="h-6 w-6 text-blue-500 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Ürün</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.totalProducts}</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setFilters({ ...filters, isPublic: filters.isPublic === true ? undefined : true });
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.isPublic === true ? 'ring-2 ring-green-500 dark:ring-green-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Eye className={`h-6 w-6 mr-3 ${filters.isPublic === true ? 'text-green-600 dark:text-green-400' : 'text-green-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Açık Ürünler</div>
                <div className={`mt-1 text-2xl font-bold ${filters.isPublic === true ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.publicProducts}
                </div>
                {filters.isPublic === true && (
                  <div className="mt-1 text-xs text-green-600 dark:text-green-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setFilters({ ...filters, isPublic: filters.isPublic === false ? undefined : false });
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.isPublic === false ? 'ring-2 ring-orange-500 dark:ring-orange-400' : ''
            }`}
          >
            <div className="flex items-center">
              <EyeOff className={`h-6 w-6 mr-3 ${filters.isPublic === false ? 'text-orange-600 dark:text-orange-400' : 'text-orange-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Özel Ürünler</div>
                <div className={`mt-1 text-2xl font-bold ${filters.isPublic === false ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.privateProducts}
                </div>
                {filters.isPublic === false && (
                  <div className="mt-1 text-xs text-orange-600 dark:text-orange-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              // Son 5 günde eklenen filtresi (default 5 gün). Alt taraftaki select ile değiştirilebilir.
              setFilters({ ...filters, createdDays: filters.createdDays ? undefined : 5 });
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.createdDays ? 'ring-2 ring-purple-500 dark:ring-purple-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Package className={`h-6 w-6 mr-3 ${filters.createdDays ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Son 5 Gün Eklenen</div>
                <div className={`mt-1 text-2xl font-bold ${filters.createdDays ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.last5DaysProducts}
                </div>
                {filters.createdDays && (
                  <div className="mt-1 text-xs text-purple-600 dark:text-purple-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4">
            <div className="flex items-center">
              <Star className="h-6 w-6 text-yellow-500 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Öne Çıkan</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{statistics.featuredProducts}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Başlık, açıklama, hashtag veya @kullanıcı adı ile ara..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kategori:</label>
              <select
                value={filters.categoryId || ''}
                onChange={(e) => {
                  setFilters({ ...filters, categoryId: e.target.value || undefined });
                  setPage(1);
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tüm Kategoriler</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Eklenme:</label>
              <select
                value={filters.createdDays || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  setFilters({ ...filters, createdDays: value });
                  setPage(1);
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Eklenme Gün Filtresi</option>
                <option value="1">Son 1 Gün Eklenen</option>
                <option value="5">Son 5 Gün Eklenen</option>
                <option value="7">Son 7 Gün Eklenen</option>
                <option value="10">Son 10 Gün Eklenen</option>
                <option value="30">Son 30 Gün Eklenen</option>
                <option value="90">Son 90 Gün Eklenen</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sırala:</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as 'createdAt' | 'title' | 'commentCount' | 'likeCount' | 'saveCount';
                  setSortBy(next);
                  // Etkileşim filtreleri her zaman "çoktan aza" (desc)
                  if (next === 'commentCount' || next === 'likeCount' || next === 'saveCount') {
                    setSortOrder('desc');
                  }
                  setPage(1);
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt">Oluşturulma Tarihi</option>
                <option value="title">Başlık</option>
                <option value="commentCount">Yorum alan ürünler (çoktan aza)</option>
                <option value="likeCount">Beğeni alan ürünler (çoktan aza)</option>
                <option value="saveCount">Kayıt alan ürünler (çoktan aza)</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as 'asc' | 'desc');
                  setPage(1);
                }}
                disabled={sortBy === 'commentCount' || sortBy === 'likeCount' || sortBy === 'saveCount'}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Azalan</option>
                <option value="asc">Artan</option>
              </select>
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
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Ürünler yükleniyor...
          </div>
        ) : productsData && productsData.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ürün
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Kullanıcı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İstatistikler
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {productsData.items.map((product) => (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        !product.isPublic 
                          ? 'bg-orange-50 dark:bg-orange-900/10 border-l-4 border-orange-500' 
                          : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {product.firstPhotoUrl ? (
                            <img
                              src={product.firstPhotoUrl}
                              alt={product.title}
                              className="h-16 w-16 object-cover rounded-md mr-4"
                            />
                          ) : (
                            <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center mr-4">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {product.title}
                            </div>
                            {/* Hiyerarşik kategori - başlığın altında, küçük font (sadece kategori seçiliyse) */}
                            {product.categoryPath && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {product.categoryPath}
                              </div>
                            )}
                            {product.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                {product.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(product.createdAt).toLocaleDateString('tr-TR')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {product.userDisplayName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {product.userEmail}
                        </div>
                        {product.price && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {formatPrice(product.price, product.userCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white space-y-1">
                          <div className="flex items-center">
                            <Heart className="h-4 w-4 mr-1 text-red-500" />
                            {product.likeCount} beğeni
                          </div>
                          <div className="flex items-center">
                            <MessageSquare className="h-4 w-4 mr-1 text-blue-500" />
                            {product.commentCount} yorum
                          </div>
                          <div className="flex items-center">
                            <Bookmark className="h-4 w-4 mr-1 text-yellow-500" />
                            {product.saveCount} kayıt
                          </div>
                          <div className="flex items-center">
                            <ImageIcon className="h-4 w-4 mr-1 text-gray-500" />
                            {product.photoCount} fotoğraf
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {product.isPublic ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                              <Eye className="h-3 w-3 mr-1" />
                              Açık
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Özel
                            </span>
                          )}
                          {product.isFeatured && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                              <Star className="h-3 w-3 mr-1" />
                              Öne Çıkan
                            </span>
                          )}
                          {!product.commentsEnabled && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Yorum Kapalı
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleTogglePublic(product)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              product.isPublic
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={product.isPublic ? 'Özel yap' : 'Açık yap'}
                          >
                            {product.isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleToggleFeatured(product)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              product.isFeatured
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={product.isFeatured ? 'Öne çıkanı kaldır' : 'Öne çıkan yap'}
                          >
                            <Star className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="px-3 py-1 text-xs rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {productsData.total > pageSize && (
              <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= productsData.total}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Sonraki
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Toplam <span className="font-medium">{productsData.total}</span> ürünlerden{' '}
                      <span className="font-medium">{(page - 1) * pageSize + 1}</span> -{' '}
                      <span className="font-medium">{Math.min(page * pageSize, productsData.total)}</span> arası gösteriliyor
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Önceki
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Sayfa {page} / {Math.ceil(productsData.total / pageSize)}
                      </span>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= productsData.total}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Sonraki
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Ürün bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
