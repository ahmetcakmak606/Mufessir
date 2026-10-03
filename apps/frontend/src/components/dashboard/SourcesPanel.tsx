"use client";

import { useState } from "react";
import { formatScholarName } from "@/lib/metadata-labels";
import type { Citation, SourceExcerpt } from "@/lib/tafseer";

interface SourcesPanelProps {
  citations: Citation[];
  excerpts: SourceExcerpt[];
  labels: {
    title: string;
    summary: string;
    empty: string;
    showAll: string;
    showFewer: string;
    more: string;
    noExcerpt: string;
    volumeShort: string;
    pageShort: string;
  };
}

interface SourceEntry {
  scholarId: string;
  scholarName: string;
  citation?: Citation;
  excerpts: string[];
}

const COLLAPSED_COUNT = 6;

// Atıflar ve alıntılar backend'den ayrı listeler olarak geliyor; okuyucu için
// aynı müfessire ait künye ve alıntıyı tek satırda birleştiriyoruz.
export function mergeSources(
  citations: Citation[],
  excerpts: SourceExcerpt[],
): SourceEntry[] {
  const entries = new Map<string, SourceEntry>();
  for (const citation of citations) {
    const id = String(citation.scholarId);
    if (!entries.has(id)) {
      entries.set(id, {
        scholarId: id,
        scholarName: citation.scholarName,
        citation,
        excerpts: [],
      });
    }
  }
  for (const excerpt of excerpts) {
    const id = String(excerpt.scholarId);
    const entry = entries.get(id);
    if (entry) entry.excerpts.push(excerpt.excerpt);
    else
      entries.set(id, {
        scholarId: id,
        scholarName: excerpt.scholarName,
        excerpts: [excerpt.excerpt],
      });
  }
  return Array.from(entries.values());
}

function isArabic(text: string) {
  return /[؀-ۿ]/.test(text.slice(0, 80));
}

export function SourcesPanel({ citations, excerpts, labels }: SourcesPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const entries = mergeSources(citations, excerpts);
  const visible = showAll ? entries : entries.slice(0, COLLAPSED_COUNT);
  const hidden = entries.length - visible.length;

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="sources-title">
      <h2 id="sources-title" className="font-display text-[1.45rem]">
        {labels.title}
      </h2>
      {entries.length === 0 ? (
        <p className="ui-muted mt-1 text-sm">{labels.empty}</p>
      ) : (
        <>
          <p className="ui-muted mb-3 mt-1 text-sm">
            {labels.summary.replace("{n}", String(entries.length))}
          </p>
          <ol className="border-t border-[var(--border-soft)]">
            {visible.map((entry, index) => {
              const open = openIds.has(entry.scholarId);
              const c = entry.citation;
              const meta = [
                c?.sourceTitle,
                c?.volume ? `${labels.volumeShort} ${c.volume}` : null,
                c?.page ? `${labels.pageShort} ${c.page}` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={entry.scholarId}
                  className="border-b border-[var(--border-soft)]"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(entry.scholarId)}
                    className="grid w-full grid-cols-[1.6rem_1fr_auto] items-baseline gap-2 px-1 py-3 text-left"
                  >
                    <span className="text-xs font-semibold tabular-nums text-[var(--gold-ink)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 font-semibold">
                      {formatScholarName(entry.scholarName)}
                      {meta && (
                        <span className="block text-[0.82rem] font-normal text-[var(--text-muted)]">
                          {meta}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-90" : ""}`}
                    >
                      ›
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-3 pb-4 pl-[2.2rem] pr-1">
                      {entry.excerpts.length === 0 && (
                        <p className="ui-muted text-sm">{labels.noExcerpt}</p>
                      )}
                      {entry.excerpts.map((text, i) => {
                        const rtl = isArabic(text);
                        return (
                          <blockquote
                            key={i}
                            dir={rtl ? "rtl" : "ltr"}
                            lang={rtl ? "ar" : undefined}
                            className={`whitespace-pre-wrap ${
                              rtl
                                ? "font-naskh text-[1.1rem] leading-[2]"
                                : "font-reading text-[0.95rem] leading-relaxed"
                            }`}
                          >
                            {text.trim()}
                          </blockquote>
                        );
                      })}
                      {c?.citationText && (
                        <p className="ui-muted text-xs">{c.citationText}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {entries.length > COLLAPSED_COUNT && (
            <p className="ui-muted px-1 py-3 text-sm">
              {hidden > 0 && <>{labels.more.replace("{n}", String(hidden))} · </>}
              <button
                type="button"
                className="ui-link text-[var(--gold-ink)] underline underline-offset-4"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? labels.showFewer : labels.showAll}
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
