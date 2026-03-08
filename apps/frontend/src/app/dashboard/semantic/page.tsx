'use client';

import Link from 'next/link';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';

export default function SemanticPlaceholderPage() {
  const { lang } = useLang();
  const t = locales[lang].dashboardPlaceholders;

  return (
    <section className="ui-panel-strong overflow-hidden">
      <div className="space-y-3 px-4 py-5 sm:px-5 sm:py-6">
        <h2 className="ui-title text-xl font-semibold">{t.semanticTitle}</h2>
        <p className="ui-muted text-sm">{t.semanticBody}</p>
        <Link href="/dashboard/query" className="ui-button-secondary w-fit px-3 py-2 text-sm">
          {t.backToQuery}
        </Link>
      </div>
    </section>
  );
}
