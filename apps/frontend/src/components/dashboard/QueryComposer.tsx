'use client';

import type { FiltersResponse, RunDraftFilters, ScholarOption } from '@/lib/tafseer';
import type { SurahMeta } from '@/lib/surahs';

interface QueryComposerProps {
  surahNumber: number;
  verseNumber: number;
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
  onFilterChange: (next: RunDraftFilters) => void;
  onScholarQueryChange: (value: string) => void;
  onInclude: (id: string) => void;
  onExclude: (id: string) => void;
  onResetScholar: (id: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
  onResetSelections: () => void;
  onAnalyze: () => void;
  labels: {
    verseTitle: string;
    surahLabel: string;
    verseLabel: string;
    revelationType: string;
    filtersTitle: string;
    toneLabel: string;
    intellectLabel: string;
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
  onFilterChange,
  onScholarQueryChange,
  onInclude,
  onExclude,
  onResetScholar,
  onIncludeAll,
  onExcludeAll,
  onResetSelections,
  onAnalyze,
  labels,
}: QueryComposerProps) {
  const selectedLanguage = filters.language || 'Turkish';

  return (
    <div className="space-y-4">
      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-4 px-4 py-5 sm:p-6">
          <h3 className="ui-title text-lg font-semibold">{labels.verseTitle}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">{labels.surahLabel}</label>
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
              <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">{labels.verseLabel}</label>
              <input
                type="number"
                min={1}
                value={verseNumber}
                onChange={(e) => onVerseNumberChange(Math.max(1, Number(e.target.value) || 1))}
                className="ui-input"
              />
            </div>
          </div>
          <div className="ui-muted flex items-center justify-between text-xs">
            <p>{labels.surahLabel}: {surahNumber} · {surahName}</p>
            <p>{labels.revelationType}: {revelationLabel}</p>
          </div>
        </div>
      </section>

      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-4 px-4 py-5 sm:p-6">
          <h3 className="ui-title text-lg font-semibold">{labels.filtersTitle}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">{labels.toneLabel}</label>
                <span className="ui-badge">{filters.tone ?? 7}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={filters.tone ?? 7}
                onChange={(e) => onFilterChange({ ...filters, tone: Number(e.target.value) })}
                className="ui-slider"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">{labels.intellectLabel}</label>
                <span className="ui-badge">{filters.intellectLevel ?? 7}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={filters.intellectLevel ?? 7}
                onChange={(e) => onFilterChange({ ...filters, intellectLevel: Number(e.target.value) })}
                className="ui-slider"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">{labels.lengthLabel}</label>
              <span className="ui-badge">{filters.responseLength ?? 6}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={filters.responseLength ?? 6}
              onChange={(e) => onFilterChange({ ...filters, responseLength: Number(e.target.value) })}
              className="ui-slider"
            />
          </div>
          <div>
            <label className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">{labels.languageLabel}</label>
            <select
              value={selectedLanguage}
              onChange={(e) => onFilterChange({ ...filters, language: e.target.value })}
              className="ui-select"
            >
              {(availableFilters?.supportedLanguages || ['Turkish', 'English', 'Arabic']).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button type="button" onClick={onIncludeAll} className="ui-button-secondary px-2.5 py-1">{labels.includeAll}</button>
              <button type="button" onClick={onExcludeAll} className="rounded-lg border border-[rgba(150,47,47,0.28)] bg-[#fff6f6] px-2.5 py-1 text-[var(--danger-text)] hover:bg-[#ffeaea]">{labels.excludeAll}</button>
              <button type="button" onClick={onResetSelections} className="ui-button-secondary px-2.5 py-1">{labels.resetSelections}</button>
            </div>

            <input
              type="text"
              value={scholarQuery}
              placeholder={labels.scholarSearchPlaceholder}
              onChange={(e) => onScholarQueryChange(e.target.value)}
              className="ui-input"
            />

            <div className="max-h-72 overflow-auto rounded-xl border border-[var(--border-soft)]">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-1/2" />
                  <col className="w-1/5" />
                  <col className="w-3/10" />
                </colgroup>
                <thead className="ui-table-head">
                  <tr>
                    <th className="px-2 py-2 text-left">{labels.tableScholar}</th>
                    <th className="px-2 py-2 text-left">{labels.tableDeath}</th>
                    <th className="px-2 py-2 text-right">{labels.tableSelection}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScholars.map((scholar) => {
                    const included = includeIds.has(scholar.id);
                    const excluded = excludeIds.has(scholar.id);
                    return (
                      <tr key={scholar.id} className="ui-table-row border-t border-[var(--border-soft)]">
                        <td className="truncate px-2 py-1.5" title={scholar.name}>{scholar.name}</td>
                        <td className="px-2 py-1.5">{scholar.deathYear ?? '-'}</td>
                        <td className="space-x-1 px-2 py-1.5 text-right">
                          <button
                            type="button"
                            className={`rounded-md border px-2 py-0.5 text-xs ${
                              included
                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                : 'border-[rgba(14,122,105,0.35)] text-[var(--brand-dark)]'
                            }`}
                            onClick={() => onInclude(scholar.id)}
                          >
                            {labels.actionInclude}
                          </button>
                          <button
                            type="button"
                            className={`rounded-md border px-2 py-0.5 text-xs ${
                              excluded
                                ? 'border-[var(--danger-text)] bg-[var(--danger-text)] text-white'
                                : 'border-[rgba(150,47,47,0.35)] text-[var(--danger-text)]'
                            }`}
                            onClick={() => onExclude(scholar.id)}
                          >
                            {labels.actionExclude}
                          </button>
                          {(included || excluded) && (
                            <button
                              type="button"
                              className="rounded-md border border-[var(--border-strong)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
                              onClick={() => onResetScholar(scholar.id)}
                            >
                              {labels.actionReset}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            disabled={!canAnalyze || loadingFilters}
            onClick={onAnalyze}
            data-testid="analyze-button"
            className="ui-button w-full px-4 py-2.5 text-sm"
          >
            {isAnalyzing ? labels.analyzing : canAnalyze ? labels.analyze : labels.quotaExhausted}
          </button>
          {loadingFilters && <p className="ui-muted text-xs">{labels.loadingFilters}</p>}
          {error && <p className="ui-danger rounded-xl px-3 py-2 text-sm">{error}</p>}
        </div>
      </section>
    </div>
  );
}
