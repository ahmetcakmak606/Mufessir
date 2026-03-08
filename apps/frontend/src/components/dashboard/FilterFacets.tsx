'use client';

import type { FiltersResponse, RunDraftFilters } from '@/lib/tafseer';

type FacetKey = 'periodCodes' | 'madhabs' | 'traditions' | 'sourceAccessibilities' | 'tafsirTypes';

type FacetFilterKey = 'periodCodes' | 'madhabs' | 'traditions' | 'sourceAccessibilities' | 'tafsirTypes';

interface FilterFacetsProps {
  availableFilters: FiltersResponse | null;
  filters: RunDraftFilters;
  onChange: (next: RunDraftFilters) => void;
  getOptionLabel?: (filterKey: FacetFilterKey, value: string) => string;
  labels: {
    title: string;
    periodCodes: string;
    madhabs: string;
    traditions: string;
    sourceAccessibilities: string;
    tafsirTypes: string;
    empty: string;
  };
}

const facetConfig: Array<{ key: FacetKey; filterKey: FacetFilterKey }> = [
  { key: 'periodCodes', filterKey: 'periodCodes' },
  { key: 'madhabs', filterKey: 'madhabs' },
  { key: 'traditions', filterKey: 'traditions' },
  { key: 'sourceAccessibilities', filterKey: 'sourceAccessibilities' },
  { key: 'tafsirTypes', filterKey: 'tafsirTypes' },
];

export function FilterFacets({
  availableFilters,
  filters,
  onChange,
  getOptionLabel,
  labels,
}: FilterFacetsProps) {
  const filterOptions = availableFilters?.filterOptions;

  const toggleOption = (filterKey: FacetFilterKey, value: string) => {
    const current = Array.isArray(filters[filterKey]) ? (filters[filterKey] as string[]) : [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    onChange({
      ...filters,
      [filterKey]: next,
    });
  };

  return (
    <section className="ui-panel-strong overflow-hidden">
      <div className="space-y-3 px-4 py-5 sm:p-6">
        <h3 className="ui-title text-lg font-semibold">{labels.title}</h3>
        {facetConfig.map(({ key, filterKey }) => {
          const options = (filterOptions?.[key] || []) as string[];
          if (!options.length) return null;
          return (
            <div key={key} className="space-y-2">
              <p className="ui-muted text-xs font-semibold uppercase tracking-[0.08em]">{labels[key]}</p>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                  const selected = (filters[filterKey] || []).includes(option);
                  const label = getOptionLabel ? getOptionLabel(filterKey, option) : option;
                  return (
                    <button
                      key={`${key}-${option}`}
                      type="button"
                      onClick={() => toggleOption(filterKey, option)}
                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                        selected
                          ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                          : 'border-[var(--border-strong)] bg-white text-[var(--text-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!filterOptions && <p className="ui-muted text-sm">{labels.empty}</p>}
      </div>
    </section>
  );
}
