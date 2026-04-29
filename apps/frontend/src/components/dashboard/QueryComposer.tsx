"use client";

import { useLang } from "@/context/LangContext";
import type {
  FiltersResponse,
  RunDraftFilters,
  ScholarOption,
} from "@/lib/tafseer";
import type { SurahMeta } from "@/lib/surahs";
import { MethodologyPanel } from "@/components/dashboard/MethodologyPanel";
import { ScholarGroupPanel } from "@/components/dashboard/ScholarGroupPanel";
import {
  FilterPresets,
  type FilterPreset,
} from "@/components/dashboard/FilterPresets";

interface QueryComposerProps {
  surahNumber: number;
  verseNumber: number;
  endVerseNumber: number;
  surahName: string;
  revelationLabel: string;
  surahOptions: SurahMeta[];
  filters: RunDraftFilters;
  availableFilters: FiltersResponse | null;
  filteredScholars: ScholarOption[];
  scholarQuery: string;
  includeIds: Set<string>;
  excludeIds: Set<string>;
  loadingFilters: boolean;
  canAnalyze: boolean;
  isAnalyzing: boolean;
  error: string;
  onSurahNumberChange: (value: number) => void;
  onVerseNumberChange: (value: number) => void;
  onEndVerseNumberChange: (value: number) => void;
  onFilterChange: (next: RunDraftFilters) => void;
  onScholarQueryChange: (value: string) => void;
  onInclude: (id: string) => void;
  onExclude: (id: string) => void;
  onResetScholar: (id: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
  onAnalyze: () => void;
  labels: {
    verseTitle: string;
    surahLabel: string;
    verseLabel: string;
    startVerseLabel: string;
    endVerseLabel: string;
    revelationType: string;
    filtersTitle: string;
    methodLabel: string;
    lengthLabel: string;
    languageLabel: string;
    includeAll: string;
    excludeAll: string;
    resetSelections: string;
    scholarSearchPlaceholder: string;
    tableScholar: string;
    tableDeath: string;
    tableSelection: string;
    actionInclude: string;
    actionExclude: string;
    actionReset: string;
    analyze: string;
    analyzing: string;
    quotaExhausted: string;
    loadingFilters: string;
  };
}

export function QueryComposer({
  surahNumber,
  verseNumber,
  endVerseNumber,
  surahName,
  revelationLabel,
  surahOptions,
  filters,
  availableFilters,
  filteredScholars,
  scholarQuery,
  includeIds,
  excludeIds,
  loadingFilters,
  canAnalyze,
  isAnalyzing,
  error,
  onSurahNumberChange,
  onVerseNumberChange,
  onEndVerseNumberChange,
  onFilterChange,
  onScholarQueryChange,
  onInclude,
  onExclude,
  onResetScholar,
  onIncludeAll,
  onExcludeAll,
  onAnalyze,
  labels,
}: QueryComposerProps) {
  const { lang } = useLang();
  const selectedLanguage = filters.language || "Turkish";

  return (
    <div className="space-y-4">
      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-4 px-4 py-5 sm:p-6">
          <h3 className="ui-title text-lg font-semibold">
            {labels.verseTitle}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
                {labels.surahLabel}
              </label>
              <select
                value={surahNumber}
                onChange={(e) => onSurahNumberChange(Number(e.target.value))}
                className="ui-select"
              >
                {surahOptions.map((surah) => (
                  <option key={surah.number} value={surah.number}>
                    {surah.number}. {surah.nameTr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
                {labels.startVerseLabel}
              </label>
              <input
                type="number"
                min={1}
                value={verseNumber}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1);
                  onVerseNumberChange(v);
                  if (endVerseNumber < v) onEndVerseNumberChange(v);
                }}
                className="ui-input"
              />
            </div>
            <div>
              <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
                {labels.endVerseLabel}
              </label>
              <input
                type="number"
                min={verseNumber}
                value={endVerseNumber}
                onChange={(e) =>
                  onEndVerseNumberChange(
                    Math.max(verseNumber, Number(e.target.value) || verseNumber),
                  )
                }
                className="ui-input"
              />
            </div>
          </div>
          <div className="ui-muted flex items-center justify-between text-xs">
            <p>
              {labels.surahLabel}: {surahNumber} · {surahName}
              {endVerseNumber > verseNumber && (
                <span className="ml-1 font-medium">
                  ({verseNumber}–{endVerseNumber})
                </span>
              )}
            </p>
            <p>
              {labels.revelationType}: {revelationLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-4 px-4 py-5 sm:p-6">
          <h3 className="ui-title text-lg font-semibold">
            {labels.filtersTitle}
          </h3>
          <MethodologyPanel
            selectedTags={filters.methodTags || []}
            onChange={(tags: string[]) =>
              onFilterChange({ ...filters, methodTags: tags })
            }
            label={labels.methodLabel}
          />
          <FilterPresets
            onApplyPreset={(preset: FilterPreset) => {
              onFilterChange({
                ...filters,
                periodCodes: preset.filters.periodCodes,
                madhabs: preset.filters.madhabs,
                traditions: preset.filters.traditions,
                tafsirTypes: preset.filters.tafsirTypes,
              });
            }}
            currentFilters={{
              periodCodes: filters.periodCodes,
              madhabs: filters.madhabs,
              traditions: filters.traditions,
              tafsirTypes: filters.tafsirTypes,
            }}
          />
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">
                {labels.lengthLabel}
              </label>
              <span className="ui-badge">{filters.responseLength ?? 6}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={filters.responseLength ?? 6}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  responseLength: Number(e.target.value),
                })
              }
              className="ui-slider"
            />
          </div>
          <div>
            <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
              {labels.languageLabel}
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) =>
                onFilterChange({ ...filters, language: e.target.value })
              }
              className="ui-select"
            >
              {(
                availableFilters?.supportedLanguages || [
                  "Turkish",
                  "English",
                  "Arabic",
                ]
              ).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={scholarQuery}
              placeholder={labels.scholarSearchPlaceholder}
              onChange={(e) => onScholarQueryChange(e.target.value)}
              className="ui-input"
            />

            {availableFilters?.filterOptions && (
              <div className="space-y-2">
                {availableFilters.filterOptions.madhabs.length > 0 && (
                  <div>
                    <p className="ui-muted mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                      {lang === "tr" ? "Mezhep" : "Madhab"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {availableFilters.filterOptions.madhabs
                        .slice(0, 6)
                        .map((madhab) => {
                          const isSelected = filters.madhabs?.includes(madhab);
                          return (
                            <button
                              key={madhab}
                              type="button"
                              onClick={() => {
                                const current = filters.madhabs || [];
                                const next = isSelected
                                  ? current.filter((m) => m !== madhab)
                                  : [...current, madhab];
                                onFilterChange({ ...filters, madhabs: next });
                              }}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                                isSelected
                                  ? "bg-[var(--brand)] text-white"
                                  : "border border-[var(--border-soft)] bg-white text-[var(--text-muted)] hover:border-[var(--brand)]"
                              }`}
                            >
                              {madhab}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
                {availableFilters.filterOptions.tafsirTypes.length > 0 && (
                  <div>
                    <p className="ui-muted mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                      {lang === "tr" ? "Tefsir Turu" : "Tafsir Type"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {availableFilters.filterOptions.tafsirTypes
                        .slice(0, 6)
                        .map((type) => {
                          const isSelected =
                            filters.tafsirTypes?.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const current = filters.tafsirTypes || [];
                                const next = isSelected
                                  ? current.filter((t) => t !== type)
                                  : [...current, type];
                                onFilterChange({
                                  ...filters,
                                  tafsirTypes: next,
                                });
                              }}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                                isSelected
                                  ? "bg-[var(--brand)] text-white"
                                  : "border border-[var(--border-soft)] bg-white text-[var(--text-muted)] hover:border-[var(--brand)]"
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={onIncludeAll}
                className="ui-button-secondary px-2.5 py-1"
              >
                {labels.includeAll}
              </button>
              <button
                type="button"
                onClick={onExcludeAll}
                className="rounded-lg border border-[rgba(150,47,47,0.28)] bg-[#fff6f6] px-2.5 py-1 text-[var(--danger-text)] hover:bg-[#ffeaea]"
              >
                {labels.excludeAll}
              </button>
            </div>

            <ScholarGroupPanel
              filteredScholars={filteredScholars}
              includeIds={includeIds}
              excludeIds={excludeIds}
              onInclude={onInclude}
              onExclude={onExclude}
              onResetScholar={onResetScholar}
              onIncludePeriod={(periodCode) => {
                const ids = filteredScholars
                  .filter((s) => s.periodCode === periodCode)
                  .map((s) => String(s.id));
                const nextInclude = new Set([
                  ...(filters.scholars || []),
                  ...ids,
                ]);
                onFilterChange({
                  ...filters,
                  scholars: Array.from(nextInclude),
                  excludeScholars: [],
                });
              }}
              onExcludePeriod={(periodCode) => {
                const ids = filteredScholars
                  .filter((s) => s.periodCode === periodCode)
                  .map((s) => String(s.id));
                const nextExclude = new Set([
                  ...(filters.excludeScholars || []),
                  ...ids,
                ]);
                onFilterChange({
                  ...filters,
                  scholars: [],
                  excludeScholars: Array.from(nextExclude),
                });
              }}
              labels={{
                include: labels.actionInclude,
                exclude: labels.actionExclude,
                reset: labels.actionReset,
                includeAll: labels.includeAll,
                excludeAll: labels.excludeAll,
                resetAll: labels.resetSelections,
              }}
            />
          </div>

          <button
            type="button"
            disabled={!canAnalyze || loadingFilters}
            onClick={onAnalyze}
            data-testid="analyze-button"
            className="ui-button w-full px-4 py-2.5 text-sm"
          >
            {isAnalyzing
              ? labels.analyzing
              : canAnalyze
                ? labels.analyze
                : labels.quotaExhausted}
          </button>
          {loadingFilters && (
            <p className="ui-muted text-xs">{labels.loadingFilters}</p>
          )}
          {error && (
            <p className="ui-danger rounded-xl px-3 py-2 text-sm">{error}</p>
          )}
        </div>
      </section>
    </div>
  );
}
