"use client";

import { useEffect, useState } from "react";
import {
  startTafseerStream,
  type Citation,
  type RunDraftFilters,
  type ScholarOption,
  type SourceExcerpt,
} from "@/lib/tafseer";
import { formatScholarName, type UiLang } from "@/lib/metadata-labels";

interface ComparisonPanelProps {
  scholars: ScholarOption[];
  baseFilters: RunDraftFilters;
  lang: UiLang;
  quotaLeft: number;
  verseId: string | undefined;
  verseRange?: { surahNumber: number; startVerse: number; endVerse: number };
  getToken: () => string | null;
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
}

interface SideResult {
  scholarId: string;
  scholarName: string;
  content: string;
  citations: Citation[];
  excerpts: SourceExcerpt[];
  error?: string;
}

function scholarDisplayName(scholar: ScholarOption, lang: UiLang) {
  const name = lang === "tr" && scholar.nameTr ? scholar.nameTr : scholar.nameEn;
  return formatScholarName(name);
}

// İki müfessirin aynı ayet(ler) için yorumunu yan yana üretir. Her taraf
// tek müfessir filtresiyle ayrı bir sorgudur; toplam 2 kota hakkı kullanır.
export function ComparisonPanel({
  scholars,
  baseFilters,
  lang,
  quotaLeft,
  verseId,
  verseRange,
  getToken,
  onQuotaUsed,
  labels,
}: ComparisonPanelProps) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SideResult[]>([]);
  const [error, setError] = useState("");

  // Ayet seçimi değişip liste daraldığında artık geçersiz seçimler
  // temizlenir; kullanıcı boş sonuç üretecek bir eşleşmeyi gönderemez.
  useEffect(() => {
    const ids = new Set(scholars.map((s) => String(s.id)));
    setLeftId((prev) => (prev && ids.has(prev) ? prev : ""));
    setRightId((prev) => (prev && ids.has(prev) ? prev : ""));
  }, [scholars]);

  const canRun =
    Boolean(leftId) &&
    Boolean(rightId) &&
    leftId !== rightId &&
    quotaLeft >= 2 &&
    !running &&
    Boolean(verseId || verseRange);

  const runOne = async (
    scholarId: string,
    scholarName: string,
  ): Promise<SideResult> => {
    const token = getToken();
    if (!token) throw new Error(labels.failed);
    const result: SideResult = {
      scholarId,
      scholarName,
      content: "",
      citations: [],
      excerpts: [],
    };
    await startTafseerStream(
      {
        verseId,
        verseRange,
        filters: {
          ...baseFilters,
          scholars: [scholarId],
        },
        stream: true,
      },
      token,
      (evt) => {
        if (evt.type === "chunk" && evt.content) {
          result.content += evt.content;
          setResults((prev) =>
            prev.map((r) => (r.scholarId === scholarId ? { ...result } : r)),
          );
        }
        if (evt.type === "complete") {
          result.citations = Array.isArray(evt.citations) ? evt.citations : [];
          result.excerpts = Array.isArray(evt.sourceExcerpts)
            ? evt.sourceExcerpts
            : [];
          setResults((prev) =>
            prev.map((r) => (r.scholarId === scholarId ? { ...result } : r)),
          );
        }
      },
    );
    return result;
  };

  const onCompare = async () => {
    if (!canRun) return;
    setError("");
    setResults([]);
    setRunning(true);
    const left = scholars.find((s) => String(s.id) === leftId);
    const right = scholars.find((s) => String(s.id) === rightId);
    try {
      // Sırayla: her biri tek müfessir filtresiyle tam bir sorgu.
      const first = await runOne(leftId, scholarDisplayName(left!, lang));
      setResults([first]);
      const second = await runOne(rightId, scholarDisplayName(right!, lang));
      setResults([first, second]);
      onQuotaUsed();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.failed);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section aria-labelledby="comparison-title" className="mt-10">
      <h2 id="comparison-title" className="font-display text-[1.45rem]">
        {labels.title}
      </h2>
      <p className="ui-muted mt-1 text-sm">{labels.hint}</p>

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
      {quotaLeft < 2 && (
        <p className="ui-muted mt-2 text-sm">{labels.needsTwo}</p>
      )}
      {error && <p className="ui-danger mt-2 text-sm">{error}</p>}

      {results.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {results.map((side) => (
            <article key={side.scholarId} className="ui-panel p-4">
              <h3 className="font-display text-lg">{side.scholarName}</h3>
              <div className="ui-prose mt-2 text-[0.98rem]">
                {side.content || "…"}
              </div>
              {side.citations.length > 0 && (
                <p className="ui-muted mt-2 text-xs">
                  {side.citations.length} × kaynak
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
