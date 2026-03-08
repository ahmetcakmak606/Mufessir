'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import type { User } from '@/lib/auth';

interface DashboardShellProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const navConfig = [
  { href: '/dashboard/query', key: 'navQuery' },
  { href: '/dashboard/runs', key: 'navRuns' },
  { href: '/dashboard/topics', key: 'navTopics' },
  { href: '/dashboard/semantic', key: 'navSemantic' },
] as const;

export function DashboardShell({ user, onLogout, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const t = locales[lang].dashboardShell;
  const brand = locales[lang].home.brand;

  return (
    <div className="ui-shell">
      <div className="pointer-events-none absolute -left-20 top-24 h-60 w-60 rounded-full bg-[rgba(14,122,105,0.14)] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-16 h-64 w-64 rounded-full bg-[rgba(12,57,61,0.14)] blur-3xl" />

      <div className="ui-container relative space-y-4 py-3 sm:py-5">
        <header className="ui-panel px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-display ui-title text-2xl sm:text-3xl">{brand}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="ui-badge">{t.userLabel}: {user.name || user.email}</span>
                <span className="ui-badge">{t.quotaLabel}: {user.dailyQuota}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="ui-panel flex items-center gap-1 rounded-full p-1">
                <span className="ui-muted px-2 text-xs">{t.langLabel}</span>
                <button onClick={() => setLang('tr')} className="ui-button-ghost" data-active={lang === 'tr'}>TR</button>
                <button onClick={() => setLang('en')} className="ui-button-ghost" data-active={lang === 'en'}>EN</button>
              </div>
              <button onClick={onLogout} className="ui-button-secondary px-4 py-2 text-sm">{t.logout}</button>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {navConfig.map((item) => {
              const active = pathname === item.href || (item.href !== '/dashboard/query' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`nav-${item.key}`}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                    active
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-white/60'
                  }`}
                >
                  {t[item.key]}
                </Link>
              );
            })}
          </nav>
        </header>

        {children}
      </div>
    </div>
  );
}
