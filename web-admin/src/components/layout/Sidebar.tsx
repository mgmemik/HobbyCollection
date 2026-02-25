'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderTree, Users, Package, BarChart3, Bell, Settings, Flag, Crown, Smartphone } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kategoriler', href: '/categories', icon: FolderTree },
  { name: 'Kullanıcılar', href: '/users', icon: Users },
  { name: 'Premium', href: '/premium', icon: Crown },
  { name: 'Ürünler', href: '/products', icon: Package },
  { name: 'Raporlar', href: '/reports', icon: BarChart3 },
  { name: 'Şikayetler', href: '/content-reports', icon: Flag },
  { name: 'Sürümler', href: '/app-versions', icon: Smartphone },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Ayarlar', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col grow bg-gray-800 dark:bg-gray-900 pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center shrink-0 px-4">
          <h1 className="text-xl font-bold text-white">Save All Admin</h1>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <item.icon className="mr-3 shrink-0 h-6 w-6" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

