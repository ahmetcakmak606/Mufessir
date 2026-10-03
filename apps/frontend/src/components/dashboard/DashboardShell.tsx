"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/context/LangContext";
import { locales } from "@/locales";
import type { User } from "@/lib/auth";

interface DashboardShellProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

// Konular ve Semantik sayfaları henüz yer tutucu; menüde yalnızca çalışan ekranlar var.
const navConfig = [
  { href: "/dashboard/query", key: "navQuery" },
  { href: "/dashboard/runs", key: "navRuns" },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr"))
    .join("");
}

export function DashboardShell({
  user,
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const t = locales[lang].dashboardShell;
  const q = locales[lang].queryUi;
  const displayName = user.name || user.email;

  return (
    <div className="ui-shell">
      <div className="ui-container">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--border-soft)] py-4">
          <Link
            href="/dashboard/query"
            className="font-display text-[1.9rem] leading-none text-[var(--ink)]"
          >
            Mufessir<span className="text-[var(--gold-ink)]">AI</span>
          </Link>

          <nav className="order-3 flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1">
            {navConfig.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard/query" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`nav-${item.key}`}
                  aria-current={active ? "page" : undefined}
                  className={`px-2.5 py-1.5 text-[0.95rem] font-medium ${
                    active
                      ? "text-[var(--ink)] shadow-[inset_0_-2px_0_var(--gold)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {t[item.key]}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span
              className="ui-badge tabular-nums"
              title={t.quotaLabel}
            >
              {q.quotaLeft}: {user.dailyQuota}
            </span>
            <div
              role="group"
              aria-label={t.langLabel}
              className="flex overflow-hidden rounded-full border border-[var(--border-strong)]"
            >
              {(["tr", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`px-2.5 py-0.5 text-xs ${
                    lang === code
                      ? "bg-[var(--accent)] text-[var(--on-accent)]"
                      : ""
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <span
              className="font-display grid h-8 w-8 place-items-center rounded-full border border-[var(--gold)] text-[var(--ink)]"
              title={displayName}
              aria-hidden="true"
            >
              {initials(displayName) || "·"}
            </span>
            <button type="button" onClick={onLogout} className="ui-link text-sm">
              {t.logout}
            </button>
          </div>
        </header>

        <div className="pt-6">{children}</div>

        <footer className="mt-10 border-t border-[var(--border-soft)] pt-4 pb-6 text-center text-xs text-[var(--text-muted)]">
          {t.aiDisclaimer}
        </footer>
      </div>
    </div>
  );
}
