import React from 'react';
import { X, Smartphone, Monitor, Tablet } from 'lucide-react';

export interface DeviceInfo {
  id: string;
  platform: string;
  osVersion?: string | null;
  appVersion?: string | null;
  buildNumber?: string | null;
  deviceModel?: string | null;
  deviceManufacturer?: string | null;
  deviceName?: string | null;
  hasNotificationPermission: boolean;
  hasPushToken: boolean;
  pushTokenMasked?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastUpdatedUtc: string;
  createdAtUtc: string;
  isActive: boolean;
}

interface DeviceInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceInfo[];
  userDisplayName: string;
}

export default function DeviceInfoModal({
  isOpen,
  onClose,
  devices,
  userDisplayName,
}: DeviceInfoModalProps) {
  if (!isOpen) return null;

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

  const getPlatformIcon = (platform: string) => {
    if (platform.toLowerCase().includes('ios')) return <Monitor className="h-5 w-5 text-blue-500" />;
    if (platform.toLowerCase().includes('android')) return <Smartphone className="h-5 w-5 text-green-500" />;
    return <Tablet className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Cihaz Bilgileri - {userDisplayName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {devices.length} cihaz kayıtlı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {devices.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center">
              <Smartphone className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-lg">Cihaz bilgisi bulunamadı</p>
              <p className="text-sm mt-2">Bu kullanıcı için henüz cihaz bilgisi kaydedilmemiş.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className={`p-4 rounded-lg border ${
                    device.isActive
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getPlatformIcon(device.platform)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {device.deviceName || device.deviceModel || device.platform}
                          </h4>
                          {device.isActive && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                              Aktif
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Platform:</span>
                            <span className="ml-2 text-gray-900 dark:text-white font-medium">
                              {device.platform}
                            </span>
                          </div>
                          
                          {device.osVersion && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">OS Versiyonu:</span>
                              <span className="ml-2 text-gray-900 dark:text-white font-medium">
                                {device.osVersion}
                              </span>
                            </div>
                          )}
                          
                          {device.appVersion && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Uygulama Versiyonu:</span>
                              <span className="ml-2 text-gray-900 dark:text-white font-medium">
                                {device.appVersion}
                                {device.buildNumber && ` (${device.buildNumber})`}
                              </span>
                            </div>
                          )}
                          
                          {device.deviceModel && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Cihaz Modeli:</span>
                              <span className="ml-2 text-gray-900 dark:text-white font-medium">
                                {device.deviceModel}
                              </span>
                            </div>
                          )}
                          
                          {device.deviceManufacturer && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Üretici:</span>
                              <span className="ml-2 text-gray-900 dark:text-white font-medium">
                                {device.deviceManufacturer}
                              </span>
                            </div>
                          )}
                          
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Bildirim İzni:</span>
                            <span className={`ml-2 font-medium ${
                              device.hasNotificationPermission
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {device.hasNotificationPermission ? 'Var' : 'Yok'}
                            </span>
                          </div>
                          
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Push Token:</span>
                            <span className={`ml-2 font-medium ${
                              device.hasPushToken
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {device.hasPushToken ? (device.pushTokenMasked || 'Kayıtlı') : 'Yok'}
                            </span>
                          </div>

                          {device.ipAddress && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">IP:</span>
                              <span className="ml-2 text-gray-900 dark:text-white font-medium">
                                {device.ipAddress}
                              </span>
                            </div>
                          )}
                        </div>

                        {device.userAgent && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-medium">User Agent:</span> {device.userAgent}
                          </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Son Güncelleme: {formatDate(device.lastUpdatedUtc)}</span>
                            <span>İlk Kayıt: {formatDate(device.createdAtUtc)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

