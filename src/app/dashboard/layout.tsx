'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useSyncUser } from '@/hooks/use-sync-user';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  useSyncUser();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>
      <header
        className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        role="banner"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
            aria-label="Scrum & Tell - Home"
          >
            Scrum & Tell
          </Link>
          <nav className="flex items-center gap-6" aria-label="Main navigation">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${
                isActive('/dashboard') && !isActive('/dashboard/rooms')
                  ? 'text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
              aria-current={isActive('/dashboard') && !isActive('/dashboard/rooms') ? 'page' : undefined}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/rooms"
              className={`text-sm font-medium transition-colors ${
                isActive('/dashboard/rooms')
                  ? 'text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
              aria-current={isActive('/dashboard/rooms') ? 'page' : undefined}
            >
              Rooms
            </Link>
            <UserButton />
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        role="main"
      >
        {children}
      </main>
    </div>
  );
}
