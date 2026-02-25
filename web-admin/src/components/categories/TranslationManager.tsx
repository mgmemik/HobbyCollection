'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  upsertCategoryTranslation,
  deleteCategoryTranslation,
  Category,
  UpsertTranslationRequest,
} from '@/lib/api/admin/categories';
import { Plus, X, Globe, Check, AlertCircle } from 'lucide-react';

interface TranslationManagerProps {
  category: Category;
}

export default function TranslationManager({ category }: TranslationManagerProps) {
  const queryClient = useQueryClient();
  const [editingLang, setEditingLang] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const languages = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'İngilizce', flag: '🇬🇧' },
  ];

  const existingTranslations = category.translations || [];
  const availableLanguages = languages.filter(
    (lang) => !existingTranslations.some((t) => t.languageCode === lang.code)
  );

  const upsertMutation = useMutation({
    mutationFn: (data: UpsertTranslationRequest) =>
      upsertCategoryTranslation(category.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category', category.id] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingLang(null);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (languageCode: string) =>
      deleteCategoryTranslation(category.id, languageCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category', category.id] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const handleEdit = (translation: { languageCode: string; name: string; description?: string }) => {
    setEditingLang(translation.languageCode);
    setFormData({
      name: translation.name,
      description: translation.description || '',
    });
  };

  const handleSave = async (languageCode: string) => {
    if (!formData.name.trim()) {
      alert('Çeviri adı gereklidir');
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        languageCode,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Çeviri kaydedilirken hata oluştu');
    }
  };

  const handleDelete = async (languageCode: string) => {
    if (confirm('Bu çeviriyi silmek istediğinize emin misiniz?')) {
      try {
        await deleteMutation.mutateAsync(languageCode);
      } catch (error: any) {
        alert(error.response?.data?.message || 'Çeviri silinirken hata oluştu');
      }
    }
  };

  const handleAddNew = (languageCode: string) => {
    setEditingLang(languageCode);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Globe className="h-5 w-5 mr-2" />
          Çeviriler
        </h3>
        {availableLanguages.length > 0 && (
          <div className="flex gap-2">
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleAddNew(lang.code)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
              >
                <Plus className="h-4 w-4 mr-1" />
                {lang.flag} {lang.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mevcut Çeviriler */}
      <div className="space-y-3">
        {existingTranslations.map((translation) => {
          const lang = languages.find((l) => l.code === translation.languageCode);
          const isEditing = editingLang === translation.languageCode;

          return (
            <div
              key={translation.languageCode}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{lang?.flag}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {lang?.name}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(translation.languageCode)}
                        disabled={upsertMutation.isPending}
                        className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        title="Kaydet"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingLang(null);
                          setFormData({ name: '', description: '' });
                        }}
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="İptal"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ad
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Çeviri adı"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Açıklama (Opsiyonel)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Çeviri açıklaması"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{lang?.flag}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {lang?.name}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(translation)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Düzenle"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(translation.languageCode)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Sil"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="pl-8">
                    <p className="text-gray-900 dark:text-white font-medium">{translation.name}</p>
                    {translation.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {translation.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Yeni Çeviri Ekleme Formu */}
        {editingLang && !existingTranslations.some((t) => t.languageCode === editingLang) && (
          <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">
                    {languages.find((l) => l.code === editingLang)?.flag}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {languages.find((l) => l.code === editingLang)?.name}
                  </span>
                  <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    Yeni
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditingLang(null);
                    setFormData({ name: '', description: '' });
                  }}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="İptal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ad *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Çeviri adı"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Çeviri açıklaması"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => handleSave(editingLang)}
                  disabled={upsertMutation.isPending || !formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {upsertMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Çeviri Yoksa */}
        {existingTranslations.length === 0 && !editingLang && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
            <Globe className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Henüz çeviri eklenmemiş. Yukarıdaki butonlardan çeviri ekleyebilirsiniz.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

