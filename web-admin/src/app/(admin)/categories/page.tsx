'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCategories,
  getCategoryStatistics,
  deleteCategory,
  moveCategory,
  Category,
  CategoryStatistics,
} from '@/lib/api/admin/categories';
import { Plus, Search, Filter, Download } from 'lucide-react';
import Link from 'next/link';
import CategoryTree from '@/components/categories/CategoryTree';
import MoveCategoryModal from '@/components/categories/MoveCategoryModal';

export default function CategoriesPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [categoryToMove, setCategoryToMove] = useState<Category | null>(null);
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', selectedLanguage],
    queryFn: () => getCategories(selectedLanguage || undefined),
  });

  const { data: statistics } = useQuery({
    queryKey: ['category-statistics'],
    queryFn: getCategoryStatistics,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-statistics'] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ categoryId, newParentId }: { categoryId: string; newParentId: string | null }) =>
      moveCategory(categoryId, { newParentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-statistics'] });
      alert('Kategori başarıyla taşındı');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Kategori taşınırken hata oluştu');
    },
  });

  const handleDelete = async (id: string, name: string, hasChildren: boolean) => {
    // Alt kategoriler varsa uyarı göster ve silme işlemini engelle
    if (hasChildren) {
      alert(`"${name}" kategorisini silmek için önce alt kategorilerini silmeniz gerekiyor.\n\nBu kategoriye bağlı alt kategoriler bulunmaktadır.`);
      return;
    }

    // Ürün sayısını kontrol et
    const category = categories?.find((cat) => cat.id === id);
    const productCount = category?.productCount || 0;
    
    let confirmMessage = `"${name}" kategorisini silmek istediğinizden emin misiniz?`;
    if (productCount > 0) {
      confirmMessage += `\n\nBu kategoriye bağlı ${productCount} ürün bulunmaktadır. Ürünlerin kategori bilgisi temizlenecek ve kategori silinecektir.`;
    }

    if (confirm(confirmMessage)) {
      try {
        const response = await deleteMutation.mutateAsync(id);
        if ((response as any)?.productsCleared > 0) {
          alert(`Kategori başarıyla silindi. ${(response as any).productsCleared} ürünün kategori bilgisi temizlendi.`);
        } else {
          alert('Kategori başarıyla silindi');
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || 'Kategori silinirken hata oluştu';
        alert(errorMessage);
      }
    }
  };

  // Kategori path'ini oluştur (breadcrumb için)
  const getCategoryPath = (catId: string | undefined, allCats: typeof categories): Array<{ id: string; name: string }> => {
    if (!catId || !allCats) return [];
    const path: Array<{ id: string; name: string }> = [];
    let currentId: string | undefined = catId;
    
    while (currentId) {
      const cat = allCats.find((c) => c.id === currentId);
      if (!cat) break;
      path.unshift({ id: cat.id, name: cat.name });
      currentId = cat.parentId;
    }
    
    return path;
  };

  // Arama filtresi - alt kategorileri de arar ve eşleşen kategorileri bulur
  const filteredCategories = categories?.filter((cat) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Kategori adı, açıklama veya slug'da arama
    const matchesCategory = (
      cat.name.toLowerCase().includes(query) ||
      cat.description?.toLowerCase().includes(query) ||
      cat.slug?.toLowerCase().includes(query)
    );
    
    // Eğer bu kategori eşleşiyorsa, tüm üst kategorilerini de dahil et
    if (matchesCategory) {
      return true;
    }
    
    // Alt kategorilerinde arama yap
    const hasMatchingChild = categories.some((child) => {
      if (child.parentId === cat.id) {
        const childMatches = (
          child.name.toLowerCase().includes(query) ||
          child.description?.toLowerCase().includes(query) ||
          child.slug?.toLowerCase().includes(query)
        );
        return childMatches;
      }
      return false;
    });
    
    return hasMatchingChild;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Kategori Yönetimi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kategorileri hiyerarşik olarak görüntüleyin ve yönetin
          </p>
        </div>
        <Link
          href="/categories/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Ana Kategori
        </Link>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.totalCategories}
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Toplam Kategori
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.rootCategories}
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Ana Kategori
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.categoriesWithProducts}
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Ürünlü Kategori
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.categoriesWithTranslations}
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Çevirili Kategori
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kategori ara..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tüm Diller</option>
              <option value="tr">Türkçe</option>
              <option value="en">İngilizce</option>
            </select>
          </div>
        </div>
      </div>

      {/* Categories Tree/List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Yükleniyor...
          </div>
        ) : filteredCategories.length > 0 ? (
          <CategoryTree 
            categories={filteredCategories} 
            onDelete={handleDelete}
            onMove={(category) => {
              setCategoryToMove(category);
              setMoveModalOpen(true);
            }}
            searchQuery={searchQuery}
            getCategoryPath={(catId) => getCategoryPath(catId, categories || [])}
          />
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Arama sonucu bulunamadı' : 'Kategori bulunamadı'}
          </div>
        )}
      </div>

      {/* Move Category Modal */}
      <MoveCategoryModal
        isOpen={moveModalOpen}
        onClose={() => {
          setMoveModalOpen(false);
          setCategoryToMove(null);
        }}
        category={categoryToMove}
        categories={categories || []}
        onMove={async (categoryId, newParentId) => {
          await moveMutation.mutateAsync({ categoryId, newParentId });
        }}
      />
    </div>
  );
}
