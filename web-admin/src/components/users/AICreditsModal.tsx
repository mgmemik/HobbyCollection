'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserAICredits, manualChargeUserAICredits, ManualAICreditChargeReason, AICreditTransaction } from '@/lib/api/admin/users';
import { X, Sparkles, TrendingUp, TrendingDown, RotateCcw, Loader2, PlusCircle } from 'lucide-react';

interface AICreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string | null;
  userDisplayName: string;
}

export default function AICreditsModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  userDisplayName,
}: AICreditsModalProps) {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [manualAmount, setManualAmount] = useState<50 | 100 | 200 | 300>(50);
  const [manualReason, setManualReason] = useState<ManualAICreditChargeReason>('support');

  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user-ai-credits', userId, page],
    queryFn: () => getUserAICredits(userId, page, pageSize),
    enabled: isOpen && !!userId,
  });

  const manualChargeMutation = useMutation({
    mutationFn: (payload: { amount: 50 | 100 | 200 | 300; reason: ManualAICreditChargeReason }) =>
      manualChargeUserAICredits(userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-ai-credits', userId] });
      await queryClient.invalidateQueries({ queryKey: ['users'] }); // kullanıcı listesi / istatistikleri etkilenebilir
    },
  });

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setManualAmount(50);
      setManualReason('support');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'Charge':
        return { icon: TrendingUp, color: 'text-green-600 dark:text-green-400' };
      case 'Spend':
        return { icon: TrendingDown, color: 'text-red-600 dark:text-red-400' };
      case 'Refund':
        return { icon: RotateCcw, color: 'text-blue-600 dark:text-blue-400' };
      default:
        return { icon: Sparkles, color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getTransactionDescription = (transaction: AICreditTransaction): string => {
    const description = transaction.description || '';
    const lowerDescription = description.toLowerCase();

    // Hesap açılış kredisi
    if (lowerDescription.includes('hesap açılış') || 
        lowerDescription.includes('account opening') ||
        lowerDescription.includes('açılış kredisi')) {
      return 'Hesap açılış kredisi';
    }
    
    // Aylık kredi yüklemesi
    if (lowerDescription.includes('aylık kredi') || 
        lowerDescription.includes('monthly credit') ||
        lowerDescription.includes('kredi yüklemesi') ||
        lowerDescription.includes('credit recharge')) {
      const packageMatch = description.match(/\(([^)]+)\)/);
      const packageName = packageMatch ? packageMatch[1] : '';
      const baseText = 'Aylık kredi yüklemesi';
      return packageName ? `${baseText} (${packageName})` : baseText;
    }
    
    // Operation type varsa
    if (transaction.operationType) {
      const operationTypeNames: Record<string, string> = {
        ProductRecognition: 'Ürün Tanıma',
        PriceDetection: 'Fiyat Tahmini',
      };
      const operationTypeName = operationTypeNames[transaction.operationType] || transaction.operationType;
      
      if (transaction.transactionType === 'Spend') {
        return `${operationTypeName} işlemi`;
      } else if (transaction.transactionType === 'Refund') {
        return `${operationTypeName} işlemi iadesi`;
      }
    }
    
    // Fallback
    const transactionTypeNames: Record<string, string> = {
      Charge: 'Kredi Yükleme',
      Spend: 'Kredi Harcama',
      Refund: 'Kredi İadesi',
    };
    
    return transactionTypeNames[transaction.transactionType] || description || transaction.transactionType;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  AI Kredi Takibi
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {userDisplayName} {userEmail && `(${userEmail})`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 dark:text-red-400">Veri yüklenirken hata oluştu</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Summary Card */}
                {data.summary && (
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                    {/* Balance */}
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <Sparkles className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                        <span className="text-5xl font-bold text-gray-900 dark:text-white">
                          {data.summary.currentBalance}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">Mevcut AI Kredisi</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Kazanılan</p>
                        <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                          +{data.summary.totalEarned}
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Harcanan</p>
                        <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                          -{data.summary.totalSpent}
                        </p>
                      </div>
                    </div>

                    {/* Package Info */}
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mevcut Paket</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {data.summary.packageName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {data.summary.monthlyCredits} aylık kredi
                      </p>
                    </div>

                    {/* Next Recharge */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Sonraki yükleme</span>
                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {data.summary.daysUntilNextRecharge} gün
                      </span>
                    </div>

                    {/* Manual Charge (Admin) */}
                    <div className="mt-6 pt-6 border-t border-purple-200 dark:border-purple-800">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Manuel Kredi Ekle
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={manualAmount}
                          onChange={(e) => setManualAmount(parseInt(e.target.value, 10) as 50 | 100 | 200 | 300)}
                          className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value={50}>50 kredi</option>
                          <option value={100}>100 kredi</option>
                          <option value={200}>200 kredi</option>
                          <option value={300}>300 kredi</option>
                        </select>

                        <select
                          value={manualReason}
                          onChange={(e) => setManualReason(e.target.value as ManualAICreditChargeReason)}
                          className="flex-[2] px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="support">Destek / telafi</option>
                          <option value="promo">Kampanya / promosyon</option>
                          <option value="test">Test / deneme</option>
                          <option value="refund">Hata telafisi</option>
                          <option value="adjustment">Manuel düzeltme</option>
                        </select>

                        <button
                          onClick={async () => {
                            if (!confirm(`${userDisplayName} kullanıcısına ${manualAmount} kredi eklemek istiyor musunuz?`)) return;
                            try {
                              await manualChargeMutation.mutateAsync({ amount: manualAmount, reason: manualReason });
                              await refetch();
                            } catch (e: any) {
                              alert(e?.response?.data?.message || 'Kredi eklenirken hata oluştu');
                            }
                          }}
                          disabled={manualChargeMutation.isPending}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {manualChargeMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlusCircle className="h-4 w-4" />
                          )}
                          Kredi Ekle
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Not: Yalnızca 50 / 100 / 200 / 300 kredi ve hazır açıklamalar kullanılabilir.
                      </p>
                    </div>
                  </div>
                )}

                {/* Operation Costs */}
                {data.operationCosts && data.operationCosts.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      AI İşlem Maliyetleri
                    </h3>
                    <div className="space-y-3">
                      {data.operationCosts.map((cost) => {
                        const operationTypeNames: Record<string, string> = {
                          ProductRecognition: 'Ürün Tanıma',
                          PriceDetection: 'Fiyat Tahmini',
                        };
                        return (
                          <div
                            key={cost.id}
                            className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {operationTypeNames[cost.operationType] || cost.operationType}
                              </p>
                              {cost.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {cost.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg px-3 py-1">
                              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              <span className="font-semibold text-purple-600 dark:text-purple-400">
                                {cost.creditCost}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Transaction History */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    İşlem Geçmişi
                  </h3>
                  {data.transactions.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Henüz işlem yok
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {data.transactions.map((transaction) => {
                        const { icon: Icon, color } = getTransactionIcon(transaction.transactionType);
                        return (
                          <div
                            key={transaction.id}
                            className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <div className={`${color} mt-1`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {getTransactionDescription(transaction)}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {formatDate(transaction.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`font-semibold ${
                                  transaction.amount > 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {transaction.amount > 0 ? '+' : ''}
                                {transaction.amount}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Bakiye: {transaction.balanceAfter}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination */}
                  {data.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sayfa {data.page} / {data.totalPages} (Toplam {data.totalCount} işlem)
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Önceki
                        </button>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={page >= data.totalPages}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sonraki
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

