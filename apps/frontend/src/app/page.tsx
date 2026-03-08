'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { lang, setLang } = useLang();
  const t = locales[lang].home;

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="ui-shell flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[rgba(14,122,105,0.2)] border-t-[var(--brand)]"></div>
          <p className="ui-muted mt-4 text-sm">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="ui-shell overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-16 h-56 w-56 rounded-full bg-[rgba(14,122,105,0.18)] blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-20 h-64 w-64 rounded-full bg-[rgba(12,57,61,0.16)] blur-3xl" />
      <main className="ui-container relative flex min-h-screen flex-col py-4 sm:py-6">
        <header className="mb-8 flex items-center justify-between gap-3 sm:mb-12">
          <Link href="/" className="font-display text-[1.15rem] font-bold text-[var(--text-strong)] sm:text-[1.35rem]">
            {t.brand}
          </Link>
          <div className="ui-panel flex items-center gap-1 rounded-full p-1">
            <button
              onClick={() => setLang('tr')}
              className="ui-button-ghost"
              data-active={lang === 'tr'}
            >
              TR
            </button>
            <button
              onClick={() => setLang('en')}
              className="ui-button-ghost"
              data-active={lang === 'en'}
            >
              EN
            </button>
          </div>
        </header>

        <section className="grid flex-1 items-start gap-6 pb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="ui-fade-up space-y-6">
            <span className="ui-badge">{t.heroBadge}</span>
            <h1 className="ui-title font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
              {t.title}
            </h1>
            <p className="ui-muted max-w-2xl text-base leading-relaxed sm:text-lg">{t.subtitle}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="ui-button px-5 py-3 text-sm sm:text-base">
                {t.getStarted}
              </Link>
              <Link href="/login" className="ui-button-secondary px-5 py-3 text-sm sm:text-base">
                {t.signIn}
              </Link>
            </div>
            <p className="ui-muted text-sm">{t.foot}</p>
          </div>

          <div className="ui-fade-up space-y-3">
            <div className="ui-panel p-4 sm:p-5">
              <h2 className="font-display text-xl font-semibold text-[var(--text-strong)]">{t.insightTitle}</h2>
              <p className="ui-muted mt-2 text-sm sm:text-base">
                {t.insightText}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <article className="ui-panel-strong p-4 sm:p-5">
                <p className="ui-muted text-xs font-semibold">01</p>
                <h3 className="mt-2 text-base font-semibold text-[var(--text-strong)]">{t.card1Title}</h3>
                <p className="ui-muted mt-1 text-sm">{t.card1Text}</p>
              </article>
              <article className="ui-panel-strong p-4 sm:p-5">
                <p className="ui-muted text-xs font-semibold">02</p>
                <h3 className="mt-2 text-base font-semibold text-[var(--text-strong)]">{t.card2Title}</h3>
                <p className="ui-muted mt-1 text-sm">{t.card2Text}</p>
              </article>
              <article className="ui-panel-strong p-4 sm:p-5">
                <p className="ui-muted text-xs font-semibold">03</p>
                <h3 className="mt-2 text-base font-semibold text-[var(--text-strong)]">{t.card3Title}</h3>
                <p className="ui-muted mt-1 text-sm">{t.card3Text}</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
