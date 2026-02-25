'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { updateUser } from '@/lib/api/admin/users';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUsername: string | null;
}

export default function UsernameModal({ isOpen, onClose, userId, currentUsername }: UsernameModalProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      setUsername(currentUsername || '');
      setError(null);
    }
  }, [isOpen, currentUsername]);

  const updateMutation = useMutation({
    mutationFn: (newUsername: string) => updateUser(userId, { username: newUsername }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      const errorMessage = err?.response?.data?.message || err?.message || 'Kullanıcı adı güncellenirken bir hata oluştu';
      setError(errorMessage);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Kullanıcı adı boş olamaz');
      return;
    }

    // Temizle: @ işaretini ve özel karakterleri kaldır
    const cleaned = username.trim().replace(/@/g, '').toLowerCase();
    
    if (cleaned === currentUsername) {
      setError('Yeni kullanıcı adı mevcut kullanıcı adıyla aynı');
      return;
    }

    updateMutation.mutate(cleaned);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Kullanıcı Adı Değiştir
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Yeni Kullanıcı Adı
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="kullanici_adi"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Mevcut kullanıcı adı: <span className="font-mono">{currentUsername || 'Yok'}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Kullanıcı adı küçük harf, rakam ve alt çizgi içerebilir. @ işareti otomatik kaldırılacaktır.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Güncelleniyor...' : 'Güncelle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
