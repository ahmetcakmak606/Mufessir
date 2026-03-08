'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { lang } = useLang();
  const loadingLabel = locales[lang].dashboard.loading;

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="ui-shell flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[rgba(14,122,105,0.2)] border-t-[var(--brand)]" />
          <p className="ui-muted mt-4 text-sm">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <DashboardShell user={user} onLogout={handleLogout}>
      {children}
    </DashboardShell>
  );
}
