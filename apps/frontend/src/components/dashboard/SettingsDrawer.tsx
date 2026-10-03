"use client";

import { useEffect, useRef } from "react";
import type {
  FiltersResponse,
  RunDraftFilters,
  ScholarOption,
} from "@/lib/tafseer";
import { MethodologyPanel } from "@/components/dashboard/MethodologyPanel";
import { FilterFacets } from "@/components/dashboard/FilterFacets";
import { formatScholarName } from "@/lib/metadata-labels";

export type SettingsTab = "basics" | "scholars" | "schools";

// Eski 1–10 kaydırıcısının üç adımlı karşılığı; backend aynı ölçeği almaya devam ediyor.
export const LENGTH_STEPS = [
  { value: 3, key: "lengthShort" },
  { value: 6, key: "lengthMedium" },
  { value: 9, key: "lengthLong" },
] as const;

export function lengthStepFor(value: number | undefined) {
  const v = value ?? 6;
  return v <= 4 ? LENGTH_STEPS[0] : v <= 7 ? LENGTH_STEPS[1] : LENGTH_STEPS[2];
}

interface SettingsDrawerProps {
  open: boolean;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  filters: RunDraftFilters;
  onFilterChange: (next: RunDraftFilters) => void;
  availableFilters: FiltersResponse | null;
  filteredScholars: ScholarOption[];
  includeIds: Set<string>;
  scholarQuery: string;
  onScholarQueryChange: (value: string) => void;
  onToggleScholar: (id: string, include: boolean) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
  onReset: () => void;
  getOptionLabel: (
    filterKey: "periodCodes" | "madhabs" | "traditions" | "sourceAccessibilities" | "tafsirTypes",
    value: string,
  ) => string;
  labels: Record<
    | "drawerTitle"
    | "close"
    | "apply"
    | "reset"
    | "tabBasics"
    | "tabScholars"
    | "tabSchools"
    | "lengthLabel"
    | "lengthShort"
    | "lengthMedium"
    | "lengthLong"
    | "answerLanguage"
    | "methodLabel"
    | "methodHelp"
    | "scholarsHelp"
    | "selectAll"
    | "selectNone"
    | "schoolsHelp"
    | "deathShort"
    | "noScholarsMatch"
    | "searchPlaceholder"
    | "periodCodes"
    | "madhabs"
    | "traditions"
    | "tafsirTypes"
    | "facetEmpty"
    | "langTurkish"
    | "langEnglish"
    | "langArabic",
    string
  >;
}

const LANGUAGE_OPTIONS = [
  { value: "Turkish", key: "langTurkish" },
  { value: "English", key: "langEnglish" },
  { value: "Arabic", key: "langArabic" },
] as const;

export function SettingsDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  filters,
  onFilterChange,
  availableFilters,
  filteredScholars,
  includeIds,
  scholarQuery,
  onScholarQueryChange,
  onToggleScholar,
  onIncludeAll,
  onExcludeAll,
  onReset,
  getOptionLabel,
  labels,
}: SettingsDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const supported = availableFilters?.supportedLanguages;
  const languages = LANGUAGE_OPTIONS.filter(
    (option) => !supported || supported.includes(option.value),
  );
  const currentLength = lengthStepFor(filters.responseLength);
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "basics", label: labels.tabBasics },
    { id: "scholars", label: labels.tabScholars },
    { id: "schools", label: labels.tabSchools },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[var(--scrim)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={labels.drawerTitle}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[28rem] flex-col border-l border-[var(--border-soft)] bg-[var(--sheet)]"
      >
        <header className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
          <h2 className="font-display text-2xl">{labels.drawerTitle}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="text-2xl leading-none text-[var(--text-muted)]"
          >
            ×
          </button>
        </header>

        <div role="tablist" className="flex gap-1 border-b border-[var(--border-soft)] px-4">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => onTabChange(item.id)}
              className={`border-b-2 px-2.5 py-2.5 text-sm ${
                tab === item.id
                  ? "border-[var(--gold)] text-[var(--ink)]"
                  : "border-transparent text-[var(--text-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-6 overflow-auto px-5 py-5">
          {tab === "basics" && (
            <>
              <div className="space-y-2">
                <h3 className="ui-label">{labels.lengthLabel}</h3>
                <div className="ui-seg" role="group" aria-label={labels.lengthLabel}>
                  {LENGTH_STEPS.map((step) => (
                    <button
                      key={step.value}
                      type="button"
                      aria-pressed={currentLength.value === step.value}
                      onClick={() =>
                        onFilterChange({ ...filters, responseLength: step.value })
                      }
                    >
                      {labels[step.key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="ui-label">{labels.answerLanguage}</h3>
                <div className="ui-seg" role="group" aria-label={labels.answerLanguage}>
                  {languages.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={(filters.language || "Turkish") === option.value}
                      onClick={() =>
                        onFilterChange({ ...filters, language: option.value })
                      }
                    >
                      {labels[option.key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <MethodologyPanel
                  selectedTags={filters.methodTags || []}
                  onChange={(tags: string[]) =>
                    onFilterChange({ ...filters, methodTags: tags })
                  }
                  label={labels.methodLabel}
                />
                <p className="ui-muted text-xs">{labels.methodHelp}</p>
              </div>
            </>
          )}

          {tab === "scholars" && (
            <div className="space-y-3">
              <p className="ui-muted text-sm">{labels.scholarsHelp}</p>
              <input
                id="drawer-scholar-search"
                type="search"
                value={scholarQuery}
                placeholder={labels.searchPlaceholder}
                aria-label={labels.searchPlaceholder}
                onChange={(e) => onScholarQueryChange(e.target.value)}
                className="ui-input"
              />
              <div className="flex gap-4 text-sm">
                <button type="button" className="ui-link" onClick={onIncludeAll}>
                  {labels.selectAll}
                </button>
                <button type="button" className="ui-link" onClick={onExcludeAll}>
                  {labels.selectNone}
                </button>
              </div>
              {filteredScholars.length === 0 ? (
                <p className="ui-muted text-sm">{labels.noScholarsMatch}</p>
              ) : (
                <ul className="divide-y divide-[var(--border-soft)] rounded-[0.5rem] border border-[var(--border-soft)]">
                  {filteredScholars.map((scholar) => {
                    const id = String(scholar.id);
                    const checked = includeIds.has(id);
                    const name =
                      scholar.nameTr || formatScholarName(scholar.nameEn || "");
                    // Vefat tarihi "hicrî/milâdî" biçiminde; yalnızca biri varsa o gösterilir.
                    const death = [scholar.deathHijri, scholar.deathMiladi]
                      .filter((year): year is number => typeof year === "number")
                      .join("/");
                    return (
                      <li key={id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => onToggleScholar(id, e.target.checked)}
                            className="accent-[var(--accent)]"
                          />
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {death ? (
                            <span className="text-xs tabular-nums text-[var(--text-muted)]">
                              {labels.deathShort} {death}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "schools" && (
            <div className="space-y-4">
              <p className="ui-muted text-sm">{labels.schoolsHelp}</p>
              <FilterFacets
                availableFilters={availableFilters}
                filters={filters}
                onChange={onFilterChange}
                getOptionLabel={getOptionLabel}
                labels={{
                  periodCodes: labels.periodCodes,
                  madhabs: labels.madhabs,
                  traditions: labels.traditions,
                  tafsirTypes: labels.tafsirTypes,
                  empty: labels.facetEmpty,
                }}
              />
            </div>
          )}
        </div>

        <footer className="flex justify-between gap-3 border-t border-[var(--border-soft)] px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
          <button type="button" onClick={onReset} className="ui-button-secondary px-4 py-2">
            {labels.reset}
          </button>
          <button type="button" onClick={onClose} className="ui-button px-6 py-2">
            {labels.apply}
          </button>
        </footer>
      </section>
    </>
  );
}
