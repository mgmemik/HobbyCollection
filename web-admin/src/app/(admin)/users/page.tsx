'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers,
  getUserStatistics,
  getUserActivity,
  getUser,
  updateUser,
  User,
  GetUsersParams,
} from '@/lib/api/admin/users';
import { Search, Users, Shield, Mail, Lock, Eye, EyeOff, CheckCircle, XCircle, Filter, BarChart3, LogIn, Sparkles, Smartphone, Bell, Package, Crown } from 'lucide-react';
import Link from 'next/link';
import UserActivityModal from '@/components/users/UserActivityModal';
import LoginLogsModal from '@/components/users/LoginLogsModal';
import AICreditsModal from '@/components/users/AICreditsModal';
import DeviceInfoModal, { DeviceInfo } from '@/components/users/DeviceInfoModal';
import NotificationsModal from '@/components/users/NotificationsModal';
import PremiumModal from '@/components/users/PremiumModal';
import ProfileVisibilityModal from '@/components/users/ProfileVisibilityModal';
import UsernameModal from '@/components/users/UsernameModal';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    isAdmin?: boolean;
    emailConfirmed?: boolean;
    isPrivateAccount?: boolean;
    activeDays?: number;
    loginDays?: number;
    hasProducts?: boolean;
    planStatus?: 'all' | 'standard' | 'premium';
  }>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDeviceInfos, setSelectedUserDeviceInfos] = useState<DeviceInfo[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showLoginLogsModal, setShowLoginLogsModal] = useState(false);
  const [showAICreditsModal, setShowAICreditsModal] = useState(false);
  const [showDeviceInfoModal, setShowDeviceInfoModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showProfileVisibilityModal, setShowProfileVisibilityModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [selectedUserName, setSelectedUserName] = useState<string | undefined>();

  const queryClient = useQueryClient();

  const setFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K] | undefined) => {
    setFilters(prev => {
      const next: any = { ...prev };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const params: GetUsersParams = {
    page,
    pageSize,
    search: searchQuery || undefined,
    ...filters,
  };

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsers(params),
  });

  const { data: statistics } = useQuery({
    queryKey: ['user-statistics'],
    queryFn: getUserStatistics,
  });

  const { data: userActivity } = useQuery({
    queryKey: ['user-activity', selectedUserId],
    queryFn: () => getUserActivity(selectedUserId!),
    enabled: !!selectedUserId && showActivityModal,
  });

  const { data: userDetail } = useQuery({
    queryKey: ['user-detail', selectedUserId],
    queryFn: () => getUser(selectedUserId!),
    enabled: !!selectedUserId && (showDeviceInfoModal || showNotificationsModal),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-statistics'] });
    },
  });

  const handleToggleAdmin = async (user: User) => {
    if (confirm(`${user.email} kullanıcısının admin durumunu ${user.isAdmin ? 'kaldırmak' : 'vermek'} istediğinize emin misiniz?`)) {
      try {
        await updateMutation.mutateAsync({
          id: user.id,
          data: { isAdmin: !user.isAdmin },
        });
        alert('Kullanıcı güncellendi');
      } catch (error: any) {
        alert(error.response?.data?.message || 'Kullanıcı güncellenirken hata oluştu');
      }
    }
  };

  const handleTogglePrivate = async (user: User) => {
    // Modal'ı aç
    setSelectedUserId(user.id);
    setSelectedUserName(user.displayName || user.email || user.userName || undefined);
    setShowProfileVisibilityModal(true);
  };

  const handleToggleEmailConfirmed = async (user: User) => {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { emailConfirmed: !user.emailConfirmed },
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Kullanıcı güncellenirken hata oluştu');
    }
  };

  const handleToggleLockout = async (user: User) => {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { lockoutEnabled: !user.lockoutEnabled },
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Kullanıcı güncellenirken hata oluştu');
    }
  };

  const resetAllFilters = () => {
    setFilters({});
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    const hasAnyFilter = Object.keys(filters).length > 0;
    return hasSearch || hasAnyFilter;
  }, [filters, searchQuery]);

  const isTotalUsersActive = useMemo(() => !hasActiveFilters, [hasActiveFilters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Kullanıcı Yönetimi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kullanıcıları görüntüleyin ve yönetin
          </p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <button
            onClick={resetAllFilters}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              isTotalUsersActive ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Users className={`h-6 w-6 mr-3 ${isTotalUsersActive ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Kullanıcı</div>
                <div className={`mt-1 text-2xl font-bold ${isTotalUsersActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.totalUsers}
                </div>
                {isTotalUsersActive && (
                  <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">Tüm filtreler temiz</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setFilter('isAdmin', filters.isAdmin === true ? undefined : true);
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.isAdmin === true ? 'ring-2 ring-purple-500 dark:ring-purple-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Shield className={`h-6 w-6 mr-3 ${filters.isAdmin === true ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Admin</div>
                <div className={`mt-1 text-2xl font-bold ${filters.isAdmin === true ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.adminUsers}
                </div>
                {filters.isAdmin === true && (
                  <div className="mt-1 text-xs text-purple-600 dark:text-purple-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setFilter('emailConfirmed', filters.emailConfirmed === true ? undefined : true);
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.emailConfirmed === true ? 'ring-2 ring-green-500 dark:ring-green-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Mail className={`h-6 w-6 mr-3 ${filters.emailConfirmed === true ? 'text-green-600 dark:text-green-400' : 'text-green-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Onaylı</div>
                <div className={`mt-1 text-2xl font-bold ${filters.emailConfirmed === true ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.emailConfirmedUsers}
                </div>
                {filters.emailConfirmed === true && (
                  <div className="mt-1 text-xs text-green-600 dark:text-green-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setFilter('isPrivateAccount', filters.isPrivateAccount === true ? undefined : true);
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.isPrivateAccount === true ? 'ring-2 ring-orange-500 dark:ring-orange-400' : ''
            }`}
          >
            <div className="flex items-center">
              <EyeOff className={`h-6 w-6 mr-3 ${filters.isPrivateAccount === true ? 'text-orange-600 dark:text-orange-400' : 'text-orange-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Özel Hesap</div>
                <div className={`mt-1 text-2xl font-bold ${filters.isPrivateAccount === true ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.privateAccountUsers}
                </div>
                {filters.isPrivateAccount === true && (
                  <div className="mt-1 text-xs text-orange-600 dark:text-orange-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setFilter('hasProducts', filters.hasProducts === true ? undefined : true);
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.hasProducts === true ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Package className={`h-6 w-6 mr-3 ${filters.hasProducts === true ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Ürünlü Kullanıcı</div>
                <div className={`mt-1 text-2xl font-bold ${filters.hasProducts === true ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.usersWithProducts}
                </div>
                {filters.hasProducts === true && (
                  <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              // Eğer zaten 30 gün aktif filtresi varsa kaldır, yoksa ekle
              setFilter('activeDays', filters.activeDays === 30 ? undefined : 30);
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.activeDays === 30 ? 'ring-2 ring-teal-500 dark:ring-teal-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Users className={`h-6 w-6 mr-3 ${filters.activeDays === 30 ? 'text-teal-600 dark:text-teal-400' : 'text-teal-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Son 30 Gün Aktif</div>
                <div className={`mt-1 text-2xl font-bold ${filters.activeDays === 30 ? 'text-teal-600 dark:text-teal-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.activeUsersLast30Days}
                </div>
                {filters.activeDays === 30 && (
                  <div className="mt-1 text-xs text-teal-600 dark:text-teal-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setFilter('loginDays', filters.loginDays === 30 ? undefined : 30);
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.loginDays === 30 ? 'ring-2 ring-cyan-500 dark:ring-cyan-400' : ''
            }`}
          >
            <div className="flex items-center">
              <LogIn className={`h-6 w-6 mr-3 ${filters.loginDays === 30 ? 'text-cyan-600 dark:text-cyan-400' : 'text-cyan-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Son 30 Gün Giriş</div>
                <div className={`mt-1 text-2xl font-bold ${filters.loginDays === 30 ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.loggedInUsersLast30Days}
                </div>
                {filters.loginDays === 30 && (
                  <div className="mt-1 text-xs text-cyan-600 dark:text-cyan-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>

          {/* Premium Kullanıcılar */}
          <button
            onClick={() => {
              setFilter('planStatus', filters.planStatus === 'premium' ? undefined : 'premium');
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.planStatus === 'premium' ? 'ring-2 ring-amber-500 dark:ring-amber-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Crown className={`h-6 w-6 mr-3 ${filters.planStatus === 'premium' ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Premium</div>
                <div className={`mt-1 text-2xl font-bold ${filters.planStatus === 'premium' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.premiumUsers}
                </div>
                {filters.planStatus === 'premium' && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>

          {/* Standard Kullanıcılar */}
          <button
            onClick={() => {
              setFilter('planStatus', filters.planStatus === 'standard' ? undefined : 'standard');
              setPage(1);
            }}
            className={`bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-4 text-left transition-all hover:shadow-md ${
              filters.planStatus === 'standard' ? 'ring-2 ring-gray-500 dark:ring-gray-400' : ''
            }`}
          >
            <div className="flex items-center">
              <Users className={`h-6 w-6 mr-3 ${filters.planStatus === 'standard' ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500'}`} />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Standard</div>
                <div className={`mt-1 text-2xl font-bold ${filters.planStatus === 'standard' ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                  {statistics.totalUsers - statistics.premiumUsers}
                </div>
                {filters.planStatus === 'standard' && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">Filtre aktif</div>
                )}
              </div>
            </div>
          </button>
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
              placeholder="Email, kullanıcı adı veya görünen isim ile ara..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtreler:</span>
            
            <button
              onClick={() => {
                setFilter('isAdmin', filters.isAdmin === true ? undefined : true);
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.isAdmin === true
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Shield className="h-4 w-4 inline mr-1" />
              Admin
            </button>

            <button
              onClick={() => {
                setFilter('emailConfirmed', filters.emailConfirmed === true ? undefined : true);
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.emailConfirmed === true
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-1" />
              Email Onaylı
            </button>

            <button
              onClick={() => {
                setFilter('isPrivateAccount', filters.isPrivateAccount === true ? undefined : true);
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.isPrivateAccount === true
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <EyeOff className="h-4 w-4 inline mr-1" />
              Özel Hesap
            </button>

            <button
              onClick={() => {
                setFilter('hasProducts', filters.hasProducts === true ? undefined : true);
                setPage(1);
              }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.hasProducts === true
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Package className="h-4 w-4 inline mr-1" />
              Ürünlü
            </button>

            <div className="relative">
              <select
                value={filters.activeDays || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  setFilter('activeDays', value);
                  setPage(1);
                }}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
              >
                <option value="">Aktif Gün Filtresi</option>
                <option value="1">Son 1 Gün Aktif</option>
                <option value="5">Son 5 Gün Aktif</option>
                <option value="7">Son 7 Gün Aktif</option>
                <option value="10">Son 10 Gün Aktif</option>
                <option value="30">Son 30 Gün Aktif</option>
                <option value="90">Son 90 Gün Aktif</option>
              </select>
              {filters.activeDays && (
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-teal-600 dark:text-teal-400">
                  ✓
                </span>
              )}
            </div>

            <div className="relative">
              <select
                value={filters.loginDays || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  setFilter('loginDays', value);
                  setPage(1);
                }}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
              >
                <option value="">Giriş Gün Filtresi</option>
                <option value="1">Son 1 Gün Giriş</option>
                <option value="5">Son 5 Gün Giriş</option>
                <option value="7">Son 7 Gün Giriş</option>
                <option value="10">Son 10 Gün Giriş</option>
                <option value="30">Son 30 Gün Giriş</option>
                <option value="90">Son 90 Gün Giriş</option>
              </select>
              {filters.loginDays && (
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-cyan-600 dark:text-cyan-400">
                  ✓
                </span>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-3 py-1 text-sm rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <Filter className="h-4 w-4 inline mr-1" />
                Filtreleri Temizle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Kullanıcılar yükleniyor...
          </div>
        ) : usersData && usersData.items.length > 0 ? (
          <>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kullanıcı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    İstatistikler
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Bildirim
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
                {usersData.items.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <button
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setSelectedUserName(user.userName || user.displayName || undefined);
                              setShowUsernameModal(true);
                            }}
                            className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer hover:underline"
                            title="Kullanıcı adını değiştirmek için tıklayın"
                          >
                            {user.displayName || user.email || user.userName || 'İsimsiz'}
                          </button>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div>📦 {user.productCount} ürün</div>
                        <div>❤️ {user.likeCount} beğeni</div>
                        <div>👥 {user.followerCount} takipçi / {user.followingCount} takip</div>
                        <div>💬 {user.commentCount} yorum</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const active = (user.notificationActiveTokenCount || 0) > 0;
                        const hasPerm = !!user.notificationHasPermission;
                        const hasToken = !!user.notificationHasPushToken;
                        const deviceCount = user.notificationDeviceCount || 0;

                        let label = 'Bilinmiyor';
                        let cls = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                        if (active) {
                          label = `Aktif (${user.notificationActiveTokenCount})`;
                          cls = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
                        } else if (deviceCount === 0) {
                          label = 'Cihaz yok';
                          cls = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                        } else if (!hasPerm) {
                          label = 'İzin yok';
                          cls = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
                        } else if (!hasToken) {
                          label = 'Token yok';
                          cls = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
                        } else {
                          label = 'Pasif';
                          cls = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
                        }

                        return (
                          <button
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setShowNotificationsModal(true);
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors hover:opacity-90 ${cls}`}
                            title="Bildirim detayları ve test bildirimi"
                          >
                            <Bell className="h-4 w-4" />
                            {label}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {user.planStatus === 'premium' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            <Crown className="h-3 w-3 mr-1" />
                            Premium
                          </span>
                        )}
                        {user.isAdmin && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        )}
                        {user.emailConfirmed ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Email Onaylı
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            <XCircle className="h-3 w-3 mr-1" />
                            Email Onaysız
                          </span>
                        )}
                        {user.isPrivateAccount ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Özel
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            <Eye className="h-3 w-3 mr-1" />
                            Açık
                          </span>
                        )}
                        {user.lockoutEnabled && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            <Lock className="h-3 w-3 mr-1" />
                            Kilitli
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setSelectedUserName(user.displayName || user.email || user.userName || undefined);
                            setShowPremiumModal(true);
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                          title="Premium Yönetimi"
                        >
                          <Crown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowAICreditsModal(true);
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                          title="AI Kredi Takibi"
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowDeviceInfoModal(true);
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                          title="Cihaz Bilgileri"
                        >
                          <Smartphone className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowLoginLogsModal(true);
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          title="Login Logları"
                        >
                          <LogIn className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowActivityModal(true);
                          }}
                          className="px-3 py-1 text-xs rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          title="Aktivite analizi"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            user.isAdmin
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={user.isAdmin ? 'Admin yetkisini kaldır' : 'Admin yetkisi ver'}
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleTogglePrivate(user)}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            user.isPrivateAccount
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={user.isPrivateAccount ? 'Hesabı açık yap' : 'Hesabı özel yap'}
                        >
                          {user.isPrivateAccount ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleToggleEmailConfirmed(user)}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            user.emailConfirmed
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={user.emailConfirmed ? 'Email onayını kaldır' : 'Email onayını ver'}
                        >
                          {user.emailConfirmed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleToggleLockout(user)}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            user.lockoutEnabled
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={user.lockoutEnabled ? 'Kilidi aç' : 'Kilitle'}
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {usersData.total > pageSize && (
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
                    disabled={page * pageSize >= usersData.total}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Sonraki
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Toplam <span className="font-medium">{usersData.total}</span> kullanıcıdan{' '}
                      <span className="font-medium">{(page - 1) * pageSize + 1}</span> -{' '}
                      <span className="font-medium">{Math.min(page * pageSize, usersData.total)}</span> arası gösteriliyor
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
                        Sayfa {page} / {Math.ceil(usersData.total / pageSize)}
                      </span>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= usersData.total}
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
            Kullanıcı bulunamadı
          </div>
        )}
      </div>

      {/* User Activity Modal */}
      <UserActivityModal
        isOpen={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          setSelectedUserId(null);
        }}
        activity={userActivity}
        userEmail={usersData?.items.find(u => u.id === selectedUserId)?.email || null}
        userDisplayName={usersData?.items.find(u => u.id === selectedUserId)?.displayName || usersData?.items.find(u => u.id === selectedUserId)?.email || 'Bilinmeyen'}
      />

      {/* Login Logs Modal */}
      <LoginLogsModal
        isOpen={showLoginLogsModal}
        onClose={() => {
          setShowLoginLogsModal(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId || ''}
        userEmail={usersData?.items.find(u => u.id === selectedUserId)?.email || null}
        userDisplayName={usersData?.items.find(u => u.id === selectedUserId)?.displayName || usersData?.items.find(u => u.id === selectedUserId)?.email || 'Bilinmeyen'}
      />

      {/* AI Credits Modal */}
      <AICreditsModal
        isOpen={showAICreditsModal}
        onClose={() => {
          setShowAICreditsModal(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId || ''}
        userEmail={usersData?.items.find(u => u.id === selectedUserId)?.email || null}
        userDisplayName={usersData?.items.find(u => u.id === selectedUserId)?.displayName || usersData?.items.find(u => u.id === selectedUserId)?.email || 'Bilinmeyen'}
      />

      {/* Device Info Modal */}
      <DeviceInfoModal
        isOpen={showDeviceInfoModal}
        onClose={() => {
          setShowDeviceInfoModal(false);
          setSelectedUserId(null);
        }}
        devices={userDetail?.deviceInfos || []}
        userDisplayName={usersData?.items.find(u => u.id === selectedUserId)?.displayName || usersData?.items.find(u => u.id === selectedUserId)?.email || 'Bilinmeyen'}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => {
          setShowNotificationsModal(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId || ''}
        userDisplayName={usersData?.items.find(u => u.id === selectedUserId)?.displayName || usersData?.items.find(u => u.id === selectedUserId)?.email || 'Bilinmeyen'}
        devices={userDetail?.deviceInfos || []}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['user-detail', selectedUserId] });
          queryClient.invalidateQueries({ queryKey: ['users'] });
        }}
      />

      {/* Premium Modal */}
      <PremiumModal
        userId={selectedUserId || ''}
        userName={selectedUserName}
        isOpen={showPremiumModal}
        onClose={() => {
          setShowPremiumModal(false);
          setSelectedUserId(null);
          setSelectedUserName(undefined);
        }}
      />

      {/* Profile Visibility Modal */}
      <ProfileVisibilityModal
        userId={selectedUserId || ''}
        userName={selectedUserName}
        isOpen={showProfileVisibilityModal}
        onClose={() => {
          setShowProfileVisibilityModal(false);
          setSelectedUserId(null);
          setSelectedUserName(undefined);
        }}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['user-statistics'] });
        }}
      />

      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        onClose={() => {
          setShowUsernameModal(false);
          setSelectedUserId(null);
          setSelectedUserName(undefined);
        }}
        userId={selectedUserId || ''}
        currentUsername={selectedUserName || null}
      />
    </div>
  );
}
