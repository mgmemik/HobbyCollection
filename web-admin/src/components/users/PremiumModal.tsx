'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Crown, Gift, Trash2, Clock, Calendar, Check, AlertCircle } from 'lucide-react';
import {
  getUserPlan,
  grantPremium,
  revokePremium,
  extendPremium,
  type UserPlanResponse,
  type EntitlementHistory,
} from '@/lib/api/admin/premium';

interface PremiumModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  AdminGrant: 'Admin',
  PromoCode: 'Promo',
  AppStore: 'App Store',
  PlayStore: 'Play Store',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Active: { label: 'Aktif', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  Expired: { label: 'Süresi Dolmuş', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  Cancelled: { label: 'İptal Edilmiş', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  Grace: { label: 'Grace Period', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  Paused: { label: 'Duraklatıldı', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
};

const DURATION_PRESETS = [
  { label: '1 Hafta', days: 7 },
  { label: '1 Ay', days: 30 },
  { label: '3 Ay', days: 90 },
  { label: '6 Ay', days: 180 },
  { label: '1 Yıl', days: 365 },
  { label: 'Süresiz', days: null },
];

export default function PremiumModal({ userId, userName, isOpen, onClose }: PremiumModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'grant' | 'history'>('status');
  const [grantDays, setGrantDays] = useState<number | null>(30);
  const [grantNotes, setGrantNotes] = useState('');
  const [extendDays, setExtendDays] = useState(30);
  const [extendNotes, setExtendNotes] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  const queryClient = useQueryClient();

  const { data: planData, isLoading, refetch } = useQuery({
    queryKey: ['user-plan', userId],
    queryFn: () => getUserPlan(userId),
    enabled: isOpen,
  });

  const grantMutation = useMutation({
    mutationFn: () => grantPremium(userId, { durationDays: grantDays, notes: grantNotes || undefined }),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setGrantNotes('');
      setActiveTab('status');
    },
  });

  const extendMutation = useMutation({
    mutationFn: () => extendPremium(userId, { days: extendDays, notes: extendNotes || undefined }),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setExtendNotes('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokePremium(userId, { reason: revokeReason || undefined }),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setRevokeReason('');
    },
  });

  if (!isOpen) return null;

  const isPremium = planData?.plan?.isPremium ?? false;
  const isLifetime = isPremium && !planData?.plan?.endsAtUtc;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <Crown className={`h-5 w-5 ${isPremium ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Premium Yönetimi</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{userName || userId}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {(['status', 'grant', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'status' && 'Durum'}
                {tab === 'grant' && 'Premium Ver'}
                {tab === 'history' && 'Geçmiş'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            )}

            {!isLoading && activeTab === 'status' && planData && (
              <div className="space-y-4">
                {/* Current Status */}
                <div className={`p-4 rounded-lg ${isPremium ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className={`h-8 w-8 ${isPremium ? 'text-amber-500' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {isPremium ? 'Premium' : 'Standard'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {isPremium
                            ? isLifetime
                              ? 'Süresiz premium'
                              : `${planData.plan.daysRemaining} gün kaldı`
                            : 'Ücretsiz plan'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {planData.plan.monthlyAICredits}
                      </p>
                      <p className="text-xs text-gray-500">Aylık AI Kredi</p>
                    </div>
                  </div>

                  {isPremium && planData.plan.endsAtUtc && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Calendar className="h-4 w-4" />
                      Bitiş: {new Date(planData.plan.endsAtUtc).toLocaleDateString('tr-TR')}
                    </div>
                  )}

                  {isPremium && planData.plan.source && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Gift className="h-4 w-4" />
                      Kaynak: {SOURCE_LABELS[planData.plan.source] || planData.plan.source}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isPremium && (
                  <div className="space-y-4">
                    {/* Extend */}
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Süreyi Uzat</h4>
                      <div className="flex gap-2 mb-3">
                        {[7, 30, 90, 365].map((d) => (
                          <button
                            key={d}
                            onClick={() => setExtendDays(d)}
                            className={`px-3 py-1 text-xs rounded-full ${
                              extendDays === d
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {d} gün
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Not (opsiyonel)"
                        value={extendNotes}
                        onChange={(e) => setExtendNotes(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm mb-3"
                      />
                      <button
                        onClick={() => extendMutation.mutate()}
                        disabled={extendMutation.isPending}
                        className="w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm"
                      >
                        {extendMutation.isPending ? 'Uzatılıyor...' : `${extendDays} Gün Uzat`}
                      </button>
                    </div>

                    {/* Revoke */}
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <h4 className="font-medium text-red-800 dark:text-red-300 mb-3">Premium İptal Et</h4>
                      <input
                        type="text"
                        placeholder="İptal nedeni (opsiyonel)"
                        value={revokeReason}
                        onChange={(e) => setRevokeReason(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm mb-3"
                      />
                      <button
                        onClick={() => {
                          if (confirm('Premium iptal edilecek. Emin misiniz?')) {
                            revokeMutation.mutate();
                          }
                        }}
                        disabled={revokeMutation.isPending}
                        className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {revokeMutation.isPending ? 'İptal Ediliyor...' : 'Premium İptal Et'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === 'grant' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Premium Süresi</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setGrantDays(preset.days)}
                        className={`px-3 py-2 text-sm rounded-md transition-colors ${
                          grantDays === preset.days
                            ? 'bg-amber-500 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Not</label>
                  <textarea
                    placeholder="Premium verme nedeni..."
                    value={grantNotes}
                    onChange={(e) => setGrantNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-sm"
                  />
                </div>

                {grantMutation.isError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Premium verilemedi
                  </div>
                )}

                {grantMutation.isSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Premium başarıyla verildi
                  </div>
                )}

                <button
                  onClick={() => grantMutation.mutate()}
                  disabled={grantMutation.isPending}
                  className="w-full py-3 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  <Crown className="h-5 w-5" />
                  {grantMutation.isPending
                    ? 'Veriliyor...'
                    : grantDays === null
                    ? 'Süresiz Premium Ver'
                    : `${grantDays} Günlük Premium Ver`}
                </button>
              </div>
            )}

            {!isLoading && activeTab === 'history' && planData && (
              <div className="space-y-2">
                {planData.history.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Geçmiş kayıt yok</p>
                )}
                {planData.history.map((item: EntitlementHistory) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_LABELS[item.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[item.status]?.label || item.status}
                        </span>
                        <span className="text-xs text-gray-500">{SOURCE_LABELS[item.source] || item.source}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAtUtc).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    {item.endsAtUtc && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {new Date(item.startsAtUtc).toLocaleDateString('tr-TR')} - {new Date(item.endsAtUtc).toLocaleDateString('tr-TR')}
                      </div>
                    )}
                    {item.notes && (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
