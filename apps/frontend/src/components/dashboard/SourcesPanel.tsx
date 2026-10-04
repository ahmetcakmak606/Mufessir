"use client";

import { useEffect, useRef, useState } from "react";
import { formatScholarName, type UiLang } from "@/lib/metadata-labels";
import type { Citation, SourceExcerpt } from "@/lib/tafseer";

interface SourcesPanelProps {
  citations: Citation[];
  excerpts: SourceExcerpt[];
  lang: UiLang;
  highlightKey?: string | null;
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
  key: string;
  scholarId: string;
  scholarName: string;
  citation?: Citation;
  excerpts: string[];
}

const COLLAPSED_COUNT = 6;

// Atıflar ve alıntılar backend'den ayrı listeler olarak geliyor; okuyucu için
// aynı müfessire ait künye ve alıntıyı tek satırda birleştiriyoruz.
// TR arayüzde Türkçe isim varsa o gösterilir (veri eksikse Latince kalır).
function pickScholarName(
  lang: UiLang,
  name: string,
  nameTr?: string | null,
): string {
  return lang === "tr" && nameTr ? nameTr : name;
}

// Aynı müfessirin farklı eser/cilt/sayfa künyeleri ayrı satırlar olarak
// korunur (bugün veri künye başına tek olsa da anahtar bileşik).
export function citationKey(c: Citation): string {
  return [c.scholarId, c.sourceTitle, c.volume ?? "", c.page ?? ""].join("|");
}

export function mergeSources(
  citations: Citation[],
  excerpts: SourceExcerpt[],
  lang: UiLang = "tr",
): SourceEntry[] {
  const entries = new Map<string, SourceEntry>();
  const scholarFirstKey = new Map<string, string>();
  for (const citation of citations) {
    const key = citationKey(citation);
    if (!entries.has(key)) {
      entries.set(key, {
        key,
        scholarId: String(citation.scholarId),
        scholarName: pickScholarName(
          lang,
          citation.scholarName,
          citation.scholarNameTr,
        ),
        citation,
        excerpts: [],
      });
      if (!scholarFirstKey.has(String(citation.scholarId))) {
        scholarFirstKey.set(String(citation.scholarId), key);
      }
    }
  }
  for (const excerpt of excerpts) {
    const scholarId = String(excerpt.scholarId);
    // Alıntılar künye taşımıyor: müfessirin ilk künye satırına eklenir.
    const key = scholarFirstKey.get(scholarId);
    const entry = key ? entries.get(key) : undefined;
    if (entry) entry.excerpts.push(excerpt.excerpt);
    else if (!entries.has(`x-${scholarId}`))
      entries.set(`x-${scholarId}`, {
        key: `x-${scholarId}`,
        scholarId,
        scholarName: pickScholarName(
          lang,
          excerpt.scholarName,
          excerpt.scholarNameTr,
        ),
        excerpts: [excerpt.excerpt],
      });
  }
  return Array.from(entries.values());
}

function isArabic(text: string) {
  return /[؀-ۿ]/.test(text.slice(0, 80));
}

export function SourcesPanel({
  citations,
  excerpts,
  lang,
  highlightKey,
  labels,
}: SourcesPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const entries = mergeSources(citations, excerpts, lang);
  const visible = showAll ? entries : entries.slice(0, COLLAPSED_COUNT);
  const hidden = entries.length - visible.length;
  const listRef = useRef<HTMLOListElement>(null);

  // Yorumdaki [Cn] işaretine basılınca ilgili künye satırı açılır ve
  // görünüme kaydırılır.
  useEffect(() => {
    if (!highlightKey) return;
    setOpenIds((prev) => new Set(prev).add(highlightKey));
    const el = listRef.current?.querySelector(
      `[data-source-key="${CSS.escape(highlightKey)}"]`,
    );
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightKey]);

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
          <ol className="border-t border-[var(--border-soft)]" ref={listRef}>
            {visible.map((entry, index) => {
              const open = openIds.has(entry.key);
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
                  key={entry.key}
                  data-source-key={entry.key}
                  className="border-b border-[var(--border-soft)]"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(entry.key)}
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
