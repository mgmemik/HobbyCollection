'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getCategory,
  updateCategory,
  getCategories,
  UpdateCategoryRequest,
} from '@/lib/api/admin/categories';
import { ArrowLeft, Info, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import TranslationManager from '@/components/categories/TranslationManager';

const categorySchema = z.object({
  name: z.string().min(1, 'Kategori adı gereklidir'),
  parentId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.id as string;

  const { data: category, isLoading } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => getCategory(categoryId),
    enabled: !!categoryId,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  const selectedParentId = watch('parentId');

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        parentId: category.parentId ? String(category.parentId) : '',
        description: category.description || '',
        isActive: category.isActive,
      });
    }
  }, [category, reset]);

  // Kategori path'ini oluştur (breadcrumb için)
  const getCategoryPath = (catId: string | undefined, allCats: typeof categories): string[] => {
    if (!catId || !allCats) return [];
    const path: string[] = [];
    let currentId: string | undefined = catId;
    
    while (currentId) {
      const cat = allCats.find((c) => c.id === currentId);
      if (!cat) break;
      path.unshift(cat.name);
      currentId = cat.parentId;
    }
    
    return path;
  };

  // Kategorinin tüm alt kategorilerini (descendants) bul
  const getCategoryDescendants = (catId: string, allCats: typeof categories): string[] => {
    if (!allCats) return [];
    const descendants: string[] = [];
    const findChildren = (parentId: string) => {
      const children = allCats.filter((c) => c.parentId === parentId);
      children.forEach((child) => {
        descendants.push(child.id);
        findChildren(child.id); // Recursive olarak alt kategorileri bul
      });
    };
    findChildren(catId);
    return descendants;
  };

  // Seçilebilir parent kategorileri filtrele (circular reference önleme)
  const availableParents = categories?.filter((cat) => {
    if (cat.id === categoryId) return false; // Kendisini seçemez
    
    // Circular reference kontrolü: Bu kategorinin alt kategorisi olamaz
    const descendants = getCategoryDescendants(categoryId, categories);
    if (descendants.includes(cat.id)) return false; // Bu kategori, düzenlenen kategorinin alt kategorisi
    
    return true;
  }) || [];

  // Mevcut parent kategoriyi bul
  const currentParent = category?.parentId 
    ? availableParents.find((cat) => cat.id === category.parentId)
    : null;

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCategoryRequest) => updateCategory(categoryId, data),
    onSuccess: () => {
      router.push('/categories');
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    try {
      await updateMutation.mutateAsync({
        name: data.name,
        parentId: data.parentId || undefined,
        description: data.description || undefined,
        isActive: data.isActive,
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Kategori güncellenirken hata oluştu');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Yükleniyor...
      </div>
    );
  }

  if (!category) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Kategori bulunamadı
      </div>
    );
  }

  const categoryPath = getCategoryPath(category.parentId, categories);

  return (
    <div className="space-y-6">
      <Link
        href="/categories"
        className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Kategorilere Dön
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Kategori Düzenle
        </h1>
        {categoryPath.length > 0 && (
          <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
            <span>Konum:</span>
            {categoryPath.map((name, index) => (
              <span key={index} className="mx-1">
                {name}
                {index < categoryPath.length - 1 && ' / '}
              </span>
            ))}
            <span className="mx-1">/ {category.name}</span>
          </div>
        )}
      </div>

      {/* Category Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Ürün Sayısı</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {category.productCount}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Alt Kategori Sayısı</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {category.childrenCount}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Durum</div>
          <div className="mt-1">
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                category.isActive
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
              }`}
            >
              {category.isActive ? 'Aktif' : 'Pasif'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Kategori Adı *
            </label>
            <input
              {...register('name')}
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Üst Kategori
            </label>
            <select
              {...register('parentId')}
              value={watch('parentId')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Ana Kategori</option>
              {availableParents
                .filter((cat) => !cat.parentId) // Sadece root kategorileri göster (ana kategoriler)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              {/* Mevcut parent'ı da göster (eğer varsa ve root değilse) */}
              {currentParent && currentParent.parentId && (
                <option value={currentParent.id}>
                  {currentParent.name}
                </option>
              )}
            </select>
            {category.childrenCount > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium">Bu kategorinin {category.childrenCount} alt kategorisi var</p>
                    <p className="mt-1 text-yellow-600 dark:text-yellow-400">
                      Üst kategori değiştirilirse alt kategoriler de taşınır.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Açıklama
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center">
            <input
              {...register('isActive')}
              type="checkbox"
              id="isActive"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Kategori aktif
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/categories"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              İptal
            </Link>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </div>
      </form>

      {/* Çeviri Yönetimi */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <TranslationManager category={category} />
      </div>
    </div>
  );
}
