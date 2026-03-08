'use client';

import type { Citation } from '@/lib/tafseer';

interface CitationPanelProps {
  title: string;
  empty: string;
  citations: Citation[];
  labels?: {
    volumeShort: string;
    pageShort: string;
  };
}

export function CitationPanel({ title, empty, citations, labels }: CitationPanelProps) {
  const volumeShort = labels?.volumeShort || 'Vol';
  const pageShort = labels?.pageShort || 'p.';

  return (
    <section className="ui-panel-strong overflow-hidden">
      <div className="space-y-3 px-4 py-5 sm:p-6">
        <h3 className="ui-title text-base font-semibold">{title}</h3>
        {!citations.length && <p className="ui-muted text-sm">{empty}</p>}
        <div className="space-y-2">
          {citations.map((citation, index) => (
            <article key={`${citation.scholarId}-${index}`} className="ui-panel rounded-xl p-3 text-sm">
              <p className="font-semibold text-[var(--text-strong)]">{citation.scholarName}</p>
              <p className="text-[var(--text-strong)]">{citation.sourceTitle}</p>
              <p className="ui-muted text-xs">
                {citation.sourceType}
                {citation.volume ? ` · ${volumeShort} ${citation.volume}` : ''}
                {citation.page ? ` · ${pageShort} ${citation.page}` : ''}
                {citation.edition ? ` · ${citation.edition}` : ''}
              </p>
              {citation.citationText && <p className="ui-muted mt-1 text-xs">{citation.citationText}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
