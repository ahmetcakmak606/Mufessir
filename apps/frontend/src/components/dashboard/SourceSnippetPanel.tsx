"use client";

import { formatScholarName } from "@/lib/metadata-labels";
import type { SourceExcerpt } from "@/lib/tafseer";

interface SourceSnippetPanelProps {
  title: string;
  empty: string;
  excerpts: SourceExcerpt[];
}

export function SourceSnippetPanel({
  title,
  empty,
  excerpts,
}: SourceSnippetPanelProps) {
  return (
    <section className="ui-panel-strong overflow-hidden">
      <div className="space-y-3 px-4 py-5 sm:p-6">
        <h3 className="ui-title text-base font-semibold">{title}</h3>
        {!excerpts.length && <p className="ui-muted text-sm">{empty}</p>}
        <div className="space-y-2">
          {excerpts.map((excerpt, index) => (
            <article
              key={`${excerpt.scholarId}-${index}`}
              className="ui-panel rounded-xl p-3"
            >
              <p className="ui-muted mb-1 text-xs font-semibold">
                {formatScholarName(excerpt.scholarName)}
              </p>
              <p className="whitespace-pre-wrap text-sm text-[var(--text-strong)]">
                {excerpt.excerpt}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
