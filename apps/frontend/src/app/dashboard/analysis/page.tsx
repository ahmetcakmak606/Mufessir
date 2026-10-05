"use client";

import { useEffect, useState } from "react";
import { ComparisonPanel } from "@/components/dashboard/ComparisonPanel";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LangContext";
import { useFiltersQuery } from "@/hooks/use-filters-query";
import { tokenStorage } from "@/lib/auth";
import { locales } from "@/locales";
import { surahs } from "@/lib/surahs";
import {
  clampVerseRange,
  fetchVerseByNumbers,
  MAX_VERSE_RANGE,
  type ScholarOption,
} from "@/lib/tafseer";

// Analiz sekmesi: iki müfessirin aynı ayet(ler) üzerine yorumlarını yan yana
// üretir. Sorgu ekranından ayrıdır; kendi ayet seçimi ve 2 kotalık maliyeti
// burada yönetilir.
export default function AnalysisPage() {
  const { lang } = useLang();
  const { user, refreshUser } = useAuth();
  const filtersQuery = useFiltersQuery();
  const q = locales[lang].queryUi;
  const dashboard = locales[lang].dashboard;

  const [surahNumber, setSurahNumber] = useState(1);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(1);
  const [resolvedVerseId, setResolvedVerseId] = useState<string | undefined>();

  const availableFilters = filtersQuery.data || null;
  const scholars = (availableFilters?.scholars as ScholarOption[]) || [];
  const maxVerse =
    surahs.find((s) => s.number === surahNumber)?.totalAyahs ?? 286;

  // Tek ayet seçiminde kimlik, karşılaştırma sorguları için çözülür.
  useEffect(() => {
    let cancelled = false;
    if (endVerse > startVerse) {
      setResolvedVerseId(undefined);
      return;
    }
    void fetchVerseByNumbers(surahNumber, startVerse)
      .then((verse) => {
        if (!cancelled) setResolvedVerseId(verse?.id);
      })
      .catch(() => {
        if (!cancelled) setResolvedVerseId(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [surahNumber, startVerse, endVerse]);

  return (
    <div className="space-y-5">
      <section className="ui-panel-strong p-5">
        <h1 className="font-display text-2xl">
          {locales[lang].dashboardShell.navAnalysis}
        </h1>
        <p className="ui-muted mt-1 text-sm">{q.compareHint}</p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="an-surah" className="ui-label">
              {q.surah}
            </label>
            <select
              id="an-surah"
              value={surahNumber}
              onChange={(e) => {
                setSurahNumber(Number(e.target.value));
                setStartVerse(1);
                setEndVerse(1);
              }}
              className="ui-select min-w-[11rem]"
            >
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number} · {s.nameTr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="ui-label">{q.verses}</span>
            <div className="flex items-center gap-1.5 tabular-nums">
              <input
                aria-label={dashboard.startVerseLabel}
                type="number"
                min={1}
                max={maxVerse}
                value={startVerse}
                onChange={(e) => {
                  const v = Math.min(
                    Math.max(Number(e.target.value) || 1, 1),
                    maxVerse,
                  );
                  setStartVerse(v);
                  setEndVerse((prevEnd) => clampVerseRange(v, prevEnd, maxVerse));
                }}
                className="ui-input w-[4.5rem] text-center"
              />
              <span className="text-[var(--text-muted)]">–</span>
              <input
                aria-label={dashboard.endVerseLabel}
                type="number"
                min={startVerse}
                max={Math.min(maxVerse, startVerse + MAX_VERSE_RANGE - 1)}
                value={endVerse}
                onChange={(e) =>
                  setEndVerse(
                    clampVerseRange(
                      startVerse,
                      Number(e.target.value) || startVerse,
                      maxVerse,
                    ),
                  )
                }
                className="ui-input w-[4.5rem] text-center"
              />
              <span className="text-xs text-[var(--text-muted)]">
                / {maxVerse} ·{" "}
                {q.rangeLimitNote.replace("{n}", String(MAX_VERSE_RANGE))}
              </span>
            </div>
          </div>
        </div>
      </section>

      <ComparisonPanel
        scholars={scholars}
        baseFilters={{
          language: lang === "tr" ? "Turkish" : "English",
        }}
        lang={lang}
        quotaLeft={user?.dailyQuota ?? 0}
        verseId={endVerse > startVerse ? undefined : resolvedVerseId}
        verseRange={
          endVerse > startVerse
            ? { surahNumber, startVerse, endVerse }
            : undefined
        }
        getToken={() => tokenStorage.get()}
        onQuotaUsed={() => void refreshUser()}
        labels={{
          title: q.compareTitle,
          run: q.compareRun,
          comparing: q.compareComparing,
          scholarPlaceholder: q.compareScholarPlaceholder,
          hint: q.compareHint,
          needsTwo: q.compareNeedsTwo,
          failed: q.compareFailed,
        }}
      />
    </div>
  );
}
