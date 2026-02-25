'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createCategory, getCategories, getCategory, CreateCategoryRequest, upsertCategoryTranslation } from '@/lib/api/admin/categories';
import { ArrowLeft, Info, Globe } from 'lucide-react';
import Link from 'next/link';

const categorySchema = z.object({
  nameTr: z.string().min(1, 'Türkçe kategori adı gereklidir'),
  nameEn: z.string().min(1, 'İngilizce kategori adı gereklidir'),
  descriptionTr: z.string().optional(),
  descriptionEn: z.string().optional(),
  parentId: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function NewCategoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentIdParam = searchParams.get('parentId');
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      parentId: parentIdParam || '',
    },
  });

  const selectedParentId = watch('parentId');

  // URL'den gelen parentId'yi form'a set et
  useEffect(() => {
    if (parentIdParam) {
      setValue('parentId', parentIdParam);
    }
  }, [parentIdParam, setValue]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const { data: parentCategory } = useQuery({
    queryKey: ['category', selectedParentId],
    queryFn: () => getCategory(selectedParentId!),
    enabled: !!selectedParentId,
  });

  // Seçilebilir parent kategorileri (sadece root kategoriler ve mevcut parent)
  const availableParents = categories?.filter((cat) => {
    // Sadece root kategorileri göster (ana kategoriler)
    return !cat.parentId;
  }) || [];

  // Mevcut parent kategoriyi bul (eğer URL'den geliyorsa)
  const currentParentFromUrl = parentIdParam 
    ? categories?.find((cat) => cat.id === parentIdParam)
    : null;

  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      // Önce kategoriyi oluştur (Türkçe isimle)
      const category = await createCategory({
        name: data.nameTr,
        parentId: data.parentId || undefined,
        description: data.descriptionTr || undefined,
      });
      
      // Sonra çevirileri ekle
      await upsertCategoryTranslation(category.id, {
        languageCode: 'tr',
        name: data.nameTr,
        description: data.descriptionTr || undefined,
      });
      
      await upsertCategoryTranslation(category.id, {
        languageCode: 'en',
        name: data.nameEn,
        description: data.descriptionEn || undefined,
      });
      
      return category;
    },
    onSuccess: () => {
      router.push('/categories');
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    try {
      await createMutation.mutateAsync(data);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Kategori oluşturulurken hata oluştu');
    }
  };

  return (
    <div>
      <Link
        href="/categories"
        className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Kategorilere Dön
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Yeni Kategori
      </h1>

      {/* Bilgi Kutusu */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Dil Gereksinimleri</p>
            <p>Kategori eklerken <strong>Türkçe</strong> ve <strong>İngilizce</strong> isimler zorunludur.</p>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              Not: Şu ana kadar kategoriler Türkçe isimle oluşturuluyordu, çeviriler sonradan ekleniyordu. Artık her iki dil de zorunlu.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="space-y-6">
          {/* Türkçe Bölümü */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-2">🇹🇷</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Türkçe</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="nameTr" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Kategori Adı (Türkçe) *
                </label>
                <input
                  {...register('nameTr')}
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Örn: Antika Objeler"
                />
                {errors.nameTr && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nameTr.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="descriptionTr" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Açıklama (Türkçe)
                </label>
                <textarea
                  {...register('descriptionTr')}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Kategori açıklaması (opsiyonel)"
                />
              </div>
            </div>
          </div>

          {/* İngilizce Bölümü */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-2">🇬🇧</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">İngilizce</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Kategori Adı (İngilizce) *
                </label>
                <input
                  {...register('nameEn')}
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Örn: Antique Objects"
                />
                {errors.nameEn && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nameEn.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="descriptionEn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Açıklama (İngilizce)
                </label>
                <textarea
                  {...register('descriptionEn')}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Category description (optional)"
                />
              </div>
            </div>
          </div>

          {/* Üst Kategori */}
          <div>
            <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Üst Kategori (Opsiyonel)
            </label>
            <select
              {...register('parentId')}
              value={watch('parentId')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Ana Kategori</option>
              {availableParents.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
              {/* Mevcut parent'ı da göster (eğer root değilse) */}
              {currentParentFromUrl && currentParentFromUrl.parentId && (
                <option value={currentParentFromUrl.id}>
                  {currentParentFromUrl.name} (Mevcut Parent)
                </option>
              )}
            </select>
            {parentCategory && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium">"{parentCategory.name}" altına kategori ekleniyor</p>
                    {parentCategory.description && (
                      <p className="mt-1 text-blue-600 dark:text-blue-400">{parentCategory.description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Link
              href="/categories"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              İptal
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
