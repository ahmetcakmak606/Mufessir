"use client";

import type { FiltersResponse, RunDraftFilters } from "@/lib/tafseer";

type FacetFilterKey =
  | "periodCodes"
  | "madhabs"
  | "traditions"
  | "sourceAccessibilities"
  | "tafsirTypes";

interface FilterFacetsProps {
  availableFilters: FiltersResponse | null;
  filters: RunDraftFilters;
  onChange: (next: RunDraftFilters) => void;
  getOptionLabel?: (filterKey: FacetFilterKey, value: string) => string;
  labels: {
    periodCodes: string;
    madhabs: string;
    traditions: string;
    tafsirTypes: string;
    empty: string;
  };
}

const facetConfig: FacetFilterKey[] = [
  "periodCodes",
  "madhabs",
  "traditions",
  "tafsirTypes",
];

// Veride aynı değer farklı boşluklarla geliyor ("Hanbeli /Selefi", "Hanbeli / Selefi").
// Kalıcı çözüm veriyi düzeltmek; o zamana kadar varyantları tek seçenekte topluyoruz
// ve seçim, filtreye o seçeneğin bütün ham değerlerini gönderiyor.
export function normalizeFacetValue(value: string): string {
  return value
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr");
}

export function groupFacetOptions(options: string[]) {
  const groups = new Map<string, string[]>();
  for (const option of options) {
    const key = normalizeFacetValue(option);
    const list = groups.get(key);
    if (list) list.push(option);
    else groups.set(key, [option]);
  }
  return Array.from(groups.values());
}

export function FilterFacets({
  availableFilters,
  filters,
  onChange,
  getOptionLabel,
  labels,
}: FilterFacetsProps) {
  const filterOptions = availableFilters?.filterOptions;

  const toggleGroup = (filterKey: FacetFilterKey, variants: string[]) => {
    const current = (filters[filterKey] as string[] | undefined) || [];
    const selected = variants.some((v) => current.includes(v));
    const next = selected
      ? current.filter((item) => !variants.includes(item))
      : [...current, ...variants];
    onChange({ ...filters, [filterKey]: next });
  };

  if (!filterOptions) {
    return <p className="ui-muted text-sm">{labels.empty}</p>;
  }

  return (
    <div className="space-y-5">
      {facetConfig.map((filterKey) => {
        const options = (filterOptions[filterKey] || []) as string[];
        if (!options.length) return null;
        const current = (filters[filterKey] as string[] | undefined) || [];
        return (
          <div key={filterKey} className="space-y-2">
            <h3 className="ui-label">{labels[filterKey as keyof typeof labels]}</h3>
            <ul className="divide-y divide-[var(--border-soft)] rounded-[0.5rem] border border-[var(--border-soft)]">
              {groupFacetOptions(options).map((variants, optionIndex) => {
                const first = variants[0];
                const selected = variants.some((v) => current.includes(v));
                const label = getOptionLabel
                  ? getOptionLabel(filterKey, first)
                  : first;
                const inputId = `facet-${filterKey}-${optionIndex}`;
                return (
                  <li key={`${filterKey}-${first}`}>
                    <label
                      htmlFor={inputId}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleGroup(filterKey, variants)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        {label.replace(/\s*\/\s*/g, " / ")}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
