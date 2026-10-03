"use client";

import type { SurahMeta } from "@/lib/surahs";

interface QueryBarProps {
  surahNumber: number;
  verseNumber: number;
  endVerseNumber: number;
  surahOptions: SurahMeta[];
  scholarSummary: string;
  settingsSummary: string;
  canAnalyze: boolean;
  analyzing: boolean;
  onSurahChange: (value: number) => void;
  onVerseChange: (value: number) => void;
  onEndVerseChange: (value: number) => void;
  onOpenScholars: () => void;
  onOpenSettings: () => void;
  onAnalyze: () => void;
  labels: {
    surah: string;
    verses: string;
    startVerse: string;
    endVerse: string;
    scholars: string;
    settings: string;
    interpret: string;
    interpreting: string;
    quotaExhausted: string;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function QueryBar({
  surahNumber,
  verseNumber,
  endVerseNumber,
  surahOptions,
  scholarSummary,
  settingsSummary,
  canAnalyze,
  analyzing,
  onSurahChange,
  onVerseChange,
  onEndVerseChange,
  onOpenScholars,
  onOpenSettings,
  onAnalyze,
  labels,
}: QueryBarProps) {
  const maxVerse =
    surahOptions.find((s) => s.number === surahNumber)?.totalAyahs ?? 286;

  return (
    <form
      aria-label={labels.interpret}
      onSubmit={(event) => {
        event.preventDefault();
        if (canAnalyze) onAnalyze();
      }}
      className="flex flex-wrap items-stretch gap-2.5 rounded-[0.6rem] border border-[var(--border-soft)] bg-[var(--sheet)] p-2.5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-1 sm:flex-none sm:border-r sm:border-[var(--border-soft)]">
        <label htmlFor="qb-surah" className="ui-label">
          {labels.surah}
        </label>
        <select
          id="qb-surah"
          value={surahNumber}
          onChange={(e) => onSurahChange(Number(e.target.value))}
          className="max-w-[12rem] bg-transparent text-[1.05rem] font-medium text-[var(--ink)] outline-none"
        >
          {surahOptions.map((surah) => (
            <option key={surah.number} value={surah.number}>
              {surah.number} · {surah.nameTr}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-0.5 px-2.5 py-1 sm:border-r sm:border-[var(--border-soft)]">
        <span className="ui-label">{labels.verses}</span>
        <div className="flex items-center gap-1.5 text-[1.05rem] font-medium tabular-nums">
          <input
            id="qb-start"
            aria-label={labels.startVerse}
            type="number"
            min={1}
            max={maxVerse}
            value={verseNumber}
            onChange={(e) => {
              const v = clamp(Number(e.target.value) || 1, 1, maxVerse);
              onVerseChange(v);
              if (endVerseNumber < v) onEndVerseChange(v);
            }}
            className="w-[3.6rem] bg-transparent text-center outline-none"
          />
          <span className="text-[var(--text-muted)]">–</span>
          <input
            id="qb-end"
            aria-label={labels.endVerse}
            type="number"
            min={verseNumber}
            max={maxVerse}
            value={endVerseNumber}
            onChange={(e) =>
              onEndVerseChange(
                clamp(Number(e.target.value) || verseNumber, verseNumber, maxVerse),
              )
            }
            className="w-[3.6rem] bg-transparent text-center outline-none"
          />
          <span className="text-sm font-normal text-[var(--text-muted)]">
            / {maxVerse}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenScholars}
        className="ui-button-secondary self-center px-3.5 py-1.5"
      >
        {labels.scholars}
        <small className="text-[var(--text-muted)]">{scholarSummary}</small>
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        data-testid="mobile-open-controls-button"
        className="ui-button-secondary self-center px-3.5 py-1.5"
      >
        {labels.settings}
        <small className="text-[var(--text-muted)]">{settingsSummary}</small>
      </button>

      <span className="hidden flex-1 sm:block" />

      <button
        type="submit"
        disabled={!canAnalyze}
        data-testid="analyze-button"
        className="ui-button hidden px-7 py-2.5 text-base sm:inline-flex"
      >
        {analyzing
          ? labels.interpreting
          : canAnalyze
            ? labels.interpret
            : labels.quotaExhausted}
      </button>
    </form>
  );
}
