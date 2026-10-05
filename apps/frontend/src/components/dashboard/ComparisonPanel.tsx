"use client";

import { useEffect, useState } from "react";
import {
  compareTafseers,
  type Citation,
  type RunDraftFilters,
  type ScholarOption,
  type SourceExcerpt,
} from "@/lib/tafseer";
import { formatScholarName, type UiLang } from "@/lib/metadata-labels";
import { SourcesPanel, citationKey } from "@/components/dashboard/SourcesPanel";
import { renderWithCitationMarkers } from "@/components/dashboard/ResultStream";

interface ComparisonPanelProps {
  scholars: ScholarOption[];
  baseFilters: RunDraftFilters;
  lang: UiLang;
  quotaLeft: number;
  verseId: string | undefined;
  verseRange?: { surahNumber: number; startVerse: number; endVerse: number };
  onQuotaUsed: () => void;
  labels: {
    title: string;
    run: string;
    comparing: string;
    scholarPlaceholder: string;
    hint: string;
    needsTwo: string;
    failed: string;
  };
  sourcesLabels: {
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

interface ComparisonResult {
  aiResponse: string;
  citations: Citation[];
  sourceExcerpts: SourceExcerpt[];
  fallback?: boolean;
}

function scholarDisplayName(scholar: ScholarOption, lang: UiLang) {
  const name = lang === "tr" && scholar.nameTr ? scholar.nameTr : scholar.nameEn;
  return formatScholarName(name);
}

// İki müfessirin pasajlarından TEK karşılaştırmalı sentez üretir
// (POST /tafseer/compare — tek kota, tek LLM çağrısı).
export function ComparisonPanel({
  scholars,
  baseFilters,
  lang,
  quotaLeft,
  verseId,
  verseRange,
  onQuotaUsed,
  labels,
  sourcesLabels,
}: ComparisonPanelProps) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  // Ayet seçimi değişip liste daraldığında geçersiz seçimler temizlenir.
  useEffect(() => {
    const ids = new Set(scholars.map((s) => String(s.id)));
    setLeftId((prev) => (prev && ids.has(prev) ? prev : ""));
    setRightId((prev) => (prev && ids.has(prev) ? prev : ""));
    setResult(null);
    setError("");
  }, [scholars]);

  const canRun =
    Boolean(leftId) &&
    Boolean(rightId) &&
    leftId !== rightId &&
    quotaLeft >= 1 &&
    !running &&
    Boolean(verseId || verseRange);

  const onCompare = async () => {
    if (!canRun) return;
    setError("");
    setResult(null);
    setRunning(true);
    try {
      const data = await compareTafseers({
        verseId: verseId || "",
        ...(verseRange ? { verseRange } : {}),
        scholars: [leftId, rightId],
        language: baseFilters.language || (lang === "tr" ? "Turkish" : "English"),
      });
      setResult({
        aiResponse: data.aiResponse,
        citations: data.citations || [],
        sourceExcerpts: data.sourceExcerpts || [],
        fallback: data.fallback,
      });
      onQuotaUsed();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.failed);
    } finally {
      setRunning(false);
    }
  };

  const onMarker = (n: number) => {
    const citation = result?.citations[n - 1];
    if (citation) setHighlightKey(citationKey(citation));
  };

  return (
    <section aria-labelledby="comparison-title">
      <h2 id="comparison-title" className="font-display text-[1.45rem]">
        {labels.title}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label={labels.scholarPlaceholder}
          value={leftId}
          onChange={(e) => setLeftId(e.target.value)}
          className="ui-select min-w-[12rem]"
        >
          <option value="">{labels.scholarPlaceholder}</option>
          {scholars.map((s) => (
            <option key={String(s.id)} value={String(s.id)}>
              {scholarDisplayName(s, lang)}
            </option>
          ))}
        </select>
        <select
          aria-label={labels.scholarPlaceholder}
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          className="ui-select min-w-[12rem]"
        >
          <option value="">{labels.scholarPlaceholder}</option>
          {scholars.map((s) => (
            <option key={String(s.id)} value={String(s.id)}>
              {scholarDisplayName(s, lang)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canRun}
          onClick={() => void onCompare()}
          className="ui-button px-4 py-2 text-sm"
        >
          {running ? labels.comparing : labels.run}
        </button>
      </div>

      {leftId && rightId && leftId === rightId && (
        <p className="ui-muted mt-2 text-sm">{labels.needsTwo}</p>
      )}
      {quotaLeft < 1 && <p className="ui-muted mt-2 text-sm">{labels.needsTwo}</p>}
      {error && (
        <p className="ui-danger mt-2 text-sm" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 space-y-6">
          <div className="ui-prose" dir="ltr">
            {renderWithCitationMarkers(result.aiResponse, onMarker)}
          </div>
          <SourcesPanel
            citations={result.citations}
            excerpts={result.sourceExcerpts}
            lang={lang}
            highlightKey={highlightKey}
            labels={sourcesLabels}
          />
        </div>
      )}
    </section>
  );
}
