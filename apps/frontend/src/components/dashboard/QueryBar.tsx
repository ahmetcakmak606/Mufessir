"use client";

import { useLang } from "@/context/LangContext";
import type { SurahMeta } from "@/lib/surahs";

interface QueryBarProps {
  surahNumber: number;
  verseNumber: number;
  surahOptions: SurahMeta[];
  onSurahChange: (n: number) => void;
  onVerseChange: (v: number) => void;
  onOpenFilters: () => void;
  onAnalyze: () => void;
  activeFilterCount: number;
  canAnalyze: boolean;
  analyzing: boolean;
}

export function QueryBar({
  surahNumber,
  verseNumber,
  surahOptions,
  onSurahChange,
  onVerseChange,
  onOpenFilters,
  onAnalyze,
  activeFilterCount,
  canAnalyze,
  analyzing,
}: QueryBarProps) {
  const { lang } = useLang();
  // NOTE: t and dashboard reserved for future localization use
  void lang;

  const SURAH_VERSE_COUNTS: Record<number, number> = {
    1: 7,
    2: 286,
    3: 200,
    4: 176,
    5: 120,
    6: 165,
    7: 206,
    8: 75,
    9: 129,
    10: 109,
    11: 123,
    12: 111,
    13: 43,
    14: 52,
    15: 99,
    16: 128,
    17: 111,
    18: 110,
    19: 98,
    20: 135,
    21: 112,
    22: 78,
    23: 118,
    24: 64,
    25: 77,
    26: 227,
    27: 93,
    28: 88,
    29: 69,
    30: 60,
    31: 34,
    32: 30,
    33: 73,
    34: 54,
    35: 45,
    36: 83,
    37: 182,
    38: 88,
    39: 75,
    40: 85,
    41: 54,
    42: 53,
    43: 89,
    44: 59,
    45: 37,
    46: 35,
    47: 38,
    48: 29,
    49: 18,
    50: 45,
    51: 60,
    52: 28,
    53: 20,
    54: 56,
    55: 78,
    56: 96,
    57: 29,
    58: 22,
    59: 24,
    60: 13,
    61: 14,
    62: 11,
    63: 11,
    64: 18,
    65: 12,
    66: 12,
    67: 30,
    68: 52,
    69: 44,
    70: 44,
    71: 28,
    72: 28,
    73: 20,
    74: 56,
    75: 40,
    76: 31,
    77: 50,
    78: 40,
    79: 46,
    80: 42,
    81: 29,
    82: 19,
    83: 36,
    84: 25,
    85: 22,
    86: 17,
    87: 19,
    88: 26,
    89: 30,
    90: 20,
    91: 15,
    92: 21,
    93: 11,
    94: 8,
    95: 8,
    96: 19,
    97: 5,
    98: 8,
    99: 8,
    100: 11,
    101: 11,
    102: 8,
    103: 3,
    104: 9,
    105: 5,
    106: 4,
    107: 7,
    108: 3,
    109: 6,
    110: 3,
    111: 5,
    112: 4,
    113: 5,
    114: 6,
  };

  const maxVerse = SURAH_VERSE_COUNTS[surahNumber] || 7;

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-[var(--bg-main)]/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-2.5 transition-colors focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand-light)]">
          <svg
            className="h-5 w-5 shrink-0 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>

          <select
            value={surahNumber}
            onChange={(e) => onSurahChange(Number(e.target.value))}
            className="flex-1 appearance-none bg-transparent text-base font-medium text-[var(--text-primary)] focus:outline-none"
          >
            {surahOptions.map((surah) => (
              <option key={surah.number} value={surah.number}>
                {surah.number}. {surah.nameTr}
              </option>
            ))}
          </select>

          <span className="text-[var(--text-muted)]">:</span>

          <input
            type="number"
            min={1}
            max={maxVerse}
            value={verseNumber}
            onChange={(e) => {
              const v = Math.max(
                1,
                Math.min(maxVerse, Number(e.target.value) || 1),
              );
              onVerseChange(v);
            }}
            className="w-10 appearance-none bg-transparent text-center text-base font-medium text-[var(--text-primary)] focus:outline-none"
          />

          <span className="text-sm text-[var(--text-muted)]">/ {maxVerse}</span>
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          className="relative flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-dark)]"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze || analyzing}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing ? (
            <svg
              className="h-5 w-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
