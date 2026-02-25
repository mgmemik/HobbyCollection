'use client';

import { useState, useEffect } from 'react';
import { Category } from '@/lib/api/admin/categories';
import { X, ArrowRight, ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

interface MoveCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  categories: Category[];
  onMove: (categoryId: string, newParentId: string | null) => Promise<void>;
}

interface CategoryOptionProps {
  cat: Category;
  level: number;
  selectedId: string;
  onSelect: (id: string) => void;
  unavailableIds: string[];
  allCategories: Category[];
}

function CategoryOption({ cat, level, selectedId, onSelect, unavailableIds, allCategories }: CategoryOptionProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = allCategories.some((c) => c.parentId === cat.id);
  const isUnavailable = unavailableIds.includes(cat.id);
  const isSelected = selectedId === cat.id;

  const children = allCategories.filter((c) => c.parentId === cat.id);

  return (
    <div>
      <div
        className={`
          flex items-center py-2 px-3 rounded-md cursor-pointer transition-colors
          ${isUnavailable 
            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
            : isSelected
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
          }
        `}
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
        onClick={() => {
          if (!isUnavailable) {
            onSelect(cat.id);
          }
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="mr-2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        ) : (
          <div className="w-5 mr-2" />
        )}
        
        {level === 0 ? (
          <FolderOpen className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0" />
        )}
        
        <span className="flex-1 truncate">{cat.name}</span>
        
        {isSelected && (
          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">✓</span>
        )}
      </div>
      
      {hasChildren && expanded && (
        <div>
          {children
            .filter((child) => !unavailableIds.includes(child.id))
            .map((child) => (
              <CategoryOption
                key={child.id}
                cat={child}
                level={level + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                unavailableIds={unavailableIds}
                allCategories={allCategories}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function MoveCategoryModal({
  isOpen,
  onClose,
  category,
  categories,
  onMove,
}: MoveCategoryModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen && category) {
      setSelectedParentId(category.parentId || '');
      setIsDropdownOpen(false);
    }
  }, [isOpen, category]);

  if (!isOpen || !category) return null;

  // Circular reference kontrolü: Bu kategorinin alt kategorilerini ve kendisini seçilemez yap
  const getCategoryDescendants = (catId: string): string[] => {
    const descendants: string[] = [];
    const findChildren = (parentId: string) => {
      const children = categories.filter((c) => c.parentId === parentId);
      children.forEach((child) => {
        descendants.push(child.id);
        findChildren(child.id);
      });
    };
    findChildren(catId);
    return descendants;
  };

  const unavailableIds = [category.id, ...getCategoryDescendants(category.id)];

  // Seçilebilir kategoriler: Tüm kategoriler minus unavailable olanlar
  const availableCategories = categories.filter(
    (cat) => !unavailableIds.includes(cat.id)
  );

  // Root kategorileri (ana kategoriler)
  const rootCategories = availableCategories.filter((cat) => !cat.parentId);

  const selectedCategory = categories.find((c) => c.id === selectedParentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onMove(category.id, selectedParentId || null);
      onClose();
    } catch (error) {
      console.error('Move category error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Kategori Taşı
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <span className="font-medium text-gray-900 dark:text-white">
                "{category.name}"
              </span>{' '}
              kategorisini taşıyın
            </p>
          </div>

          <div className="mb-6">
            <label
              htmlFor="parentId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Yeni Üst Kategori
            </label>
            
            {/* Custom Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {selectedParentId ? (
                    selectedCategory ? (
                      <span className="flex items-center">
                        {selectedCategory.parentId ? (
                          <Folder className="h-4 w-4 mr-2 text-gray-400" />
                        ) : (
                          <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
                        )}
                        {selectedCategory.name}
                      </span>
                    ) : (
                      'Kategori seçin'
                    )
                  ) : (
                    <span className="flex items-center">
                      <span className="mr-2">📁</span>
                      Ana Kategori (Root)
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-96 overflow-y-auto">
                    {/* Ana Kategori Seçeneği */}
                    <div
                      className={`
                        flex items-center py-2 px-3 rounded-md cursor-pointer transition-colors
                        ${!selectedParentId
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                        }
                      `}
                      onClick={() => {
                        setSelectedParentId('');
                        setIsDropdownOpen(false);
                      }}
                    >
                      <span className="mr-2">📁</span>
                      <span>Ana Kategori (Root)</span>
                      {!selectedParentId && (
                        <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">✓</span>
                      )}
                    </div>

                    {/* Hiyerarşik Kategori Listesi */}
                    {rootCategories.map((rootCat) => (
                      <CategoryOption
                        key={rootCat.id}
                        cat={rootCat}
                        level={0}
                        selectedId={selectedParentId}
                        onSelect={(id) => {
                          setSelectedParentId(id);
                          setIsDropdownOpen(false);
                        }}
                        unavailableIds={unavailableIds}
                        allCategories={categories}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Ana kategori seçilirse kategori root seviyesine taşınır
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Taşınıyor...' : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Taşı
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

