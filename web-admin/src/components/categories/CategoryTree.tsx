'use client';

import { useState } from 'react';
import { Category } from '@/lib/api/admin/categories';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Edit, Trash2, Move } from 'lucide-react';
import Link from 'next/link';

interface CategoryTreeProps {
  categories: Category[];
  onDelete: (id: string, name: string, hasChildren: boolean) => void;
  onMove: (category: Category) => void;
  level?: number;
  parentId?: string;
  searchQuery?: string;
  getCategoryPath?: (catId: string | undefined) => Array<{ id: string; name: string }>;
}

export default function CategoryTree({ categories, onDelete, onMove, level = 0, parentId, searchQuery, getCategoryPath }: CategoryTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showActions, setShowActions] = useState<Record<string, boolean>>({});

  // Bu seviyedeki kategorileri filtrele
  const currentLevelCategories = categories.filter(
    (cat) => (parentId ? cat.parentId === parentId : !cat.parentId)
  );

  // Arama varsa, tüm eşleşen kategorileri ve parent'larını göster
  const shouldShowCategory = (cat: Category): boolean => {
    if (!searchQuery) return true;
    
    // Kategori eşleşiyorsa göster
    const query = searchQuery.toLowerCase();
    const matchesCategory = (
      cat.name.toLowerCase().includes(query) ||
      cat.description?.toLowerCase().includes(query) ||
      cat.slug?.toLowerCase().includes(query)
    );
    
    if (matchesCategory) return true;
    
    // Alt kategorilerinde eşleşme varsa göster
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
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleActions = (id: string) => {
    setShowActions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Arama varsa otomatik expand et
  if (searchQuery) {
    currentLevelCategories.forEach((cat) => {
      if (shouldShowCategory(cat) && !expanded[cat.id]) {
        setExpanded((prev) => ({ ...prev, [cat.id]: true }));
      }
    });
  }

  const filteredCategories = searchQuery 
    ? currentLevelCategories.filter(shouldShowCategory)
    : currentLevelCategories;

  if (filteredCategories.length === 0) {
    return null;
  }

  return (
    <div className={`${level > 0 ? 'ml-8 mt-2' : ''}`}>
      {currentLevelCategories.filter(shouldShowCategory).map((category) => {
        const hasChildren = categories.some((cat) => cat.parentId === category.id);
        const isExpanded = expanded[category.id];
        const showActionMenu = showActions[category.id];

        return (
          <div key={category.id} className="mb-2">
            <div
              className={`
                group flex items-center justify-between p-3 rounded-lg border
                ${level === 0 ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : ''}
                ${level === 1 ? 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600' : ''}
                ${level === 2 ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600' : ''}
                hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
              `}
              style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
            >
              <div className="flex items-center flex-1 min-w-0">
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="mr-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>
                ) : (
                  <div className="w-6 mr-2" />
                )}

                <div className="flex items-center flex-1 min-w-0">
                  {level === 0 ? (
                    <FolderOpen className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0" />
                  ) : level === 1 ? (
                    <Folder className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 mr-2 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {/* Arama sonuçlarında kategori path'i göster */}
                    {searchQuery && getCategoryPath && category.parentId && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                        {getCategoryPath(category.parentId).map((pathItem, idx) => (
                          <span key={pathItem.id}>
                            {pathItem.name}
                            {idx < getCategoryPath(category.parentId).length - 1 && ' / '}
                          </span>
                        ))}
                        {getCategoryPath(category.parentId).length > 0 && ' / '}
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {category.name}
                      </span>
                      {!category.isActive && (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          Pasif
                        </span>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {category.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      <span>{category.productCount} ürün</span>
                      {(category.translations && category.translations.length > 0) && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          Çevirili
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Link
                  href={`/categories/${category.id}/edit`}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  title="Düzenle"
                >
                  <Edit className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => onMove(category)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Taşı"
                >
                  <Move className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(category.id, category.name, hasChildren)}
                  className={`p-2 rounded transition-colors ${
                    hasChildren
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                  title={hasChildren ? 'Alt kategorileri olan kategori silinemez' : 'Sil'}
                  disabled={hasChildren}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href={`/categories/new?parentId=${category.id}`}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-md transition-colors"
                  title="Alt kategori ekle"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Alt Kategori</span>
                </Link>
              </div>
            </div>

            {/* Alt kategoriler */}
            {hasChildren && (isExpanded || searchQuery) && (
              <CategoryTree
                categories={categories}
                onDelete={onDelete}
                onMove={onMove}
                level={level + 1}
                parentId={category.id}
                searchQuery={searchQuery}
                getCategoryPath={getCategoryPath}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

