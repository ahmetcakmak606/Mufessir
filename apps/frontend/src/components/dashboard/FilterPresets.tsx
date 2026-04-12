"use client";

import { useLang } from "@/context/LangContext";

interface FilterPresetsProps {
  onApplyPreset: (preset: FilterPreset) => void;
  currentFilters: {
    periodCodes?: string[];
    madhabs?: string[];
    traditions?: string[];
    tafsirTypes?: string[];
  };
}

export interface FilterPreset {
  id: string;
  labelTr: string;
  labelEn: string;
  filters: {
    periodCodes?: string[];
    madhabs?: string[];
    traditions?: string[];
    tafsirTypes?: string[];
  };
}

const PRESETS: FilterPreset[] = [
  {
    id: "popular",
    labelTr: "Populer",
    labelEn: "Popular",
    filters: {},
  },
  {
    id: "classical",
    labelTr: "Klasik Donem",
    labelEn: "Classical",
    filters: {
      periodCodes: ["FOUNDATION", "CLASSICAL_EARLY", "CLASSICAL_MATURE"],
    },
  },
  {
    id: "modern",
    labelTr: "Modern",
    labelEn: "Modern",
    filters: {
      periodCodes: ["MODERN", "CONTEMPORARY"],
    },
  },
  {
    id: "sunnipopular",
    labelTr: "Sunni (Populer)",
    labelEn: "Sunni (Popular)",
    filters: {
      traditions: ["SUNNI_MAINSTREAM"],
    },
  },
  {
    id: "sufi",
    labelTr: "Sufi",
    labelEn: "Sufi",
    filters: {
      traditions: ["SUFI_ISHARI"],
    },
  },
  {
    id: "shiite",
    labelTr: "Sia",
    labelEn: "Shia",
    filters: {
      traditions: ["SHII_IMAMI", "SHII_ZAYDI"],
    },
  },
  {
    id: "salafi",
    labelTr: "Selefi",
    labelEn: "Salafi",
    filters: {
      traditions: ["SALAFI"],
    },
  },
  {
    id: "maturidi",
    labelTr: "Maturidi",
    labelEn: "Maturidi",
    filters: {
      madhabs: ["Maturidi"],
    },
  },
  {
    id: "ashari",
    labelTr: "Ashari",
    labelEn: "Ashari",
    filters: {
      madhabs: ["Ashari", "Eshari"],
    },
  },
  {
    id: "hanbali",
    labelTr: "Hanbeli",
    labelEn: "Hanbali",
    filters: {
      madhabs: ["Hanbeli", "Hanbali"],
    },
  },
  {
    id: "maliki",
    labelTr: "Maliki",
    labelEn: "Maliki",
    filters: {
      madhabs: ["Maliki"],
    },
  },
  {
    id: "shafii",
    labelTr: "Safii",
    labelEn: "Shafii",
    filters: {
      madhabs: ["Safii", "Shafii"],
    },
  },
  {
    id: "hanafi",
    labelTr: "Hanefi",
    labelEn: "Hanafi",
    filters: {
      madhabs: ["Hanefi", "Hanafi"],
    },
  },
];

export function FilterPresets({
  onApplyPreset,
  currentFilters,
}: FilterPresetsProps) {
  const { lang } = useLang();

  const hasActiveFilters = (preset: FilterPreset) => {
    const f = preset.filters;
    return (
      (f.periodCodes?.length ?? 0) > 0 ||
      (f.madhabs?.length ?? 0) > 0 ||
      (f.traditions?.length ?? 0) > 0 ||
      (f.tafsirTypes?.length ?? 0) > 0
    );
  };

  return (
    <div className="space-y-2">
      <label className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">
        {lang === "tr" ? "Hizli Filtreler" : "Quick Filters"}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const isActive = hasActiveFilters(preset);
          const isSelected =
            JSON.stringify(currentFilters.periodCodes?.sort()) ===
              JSON.stringify(preset.filters.periodCodes?.sort()) &&
            JSON.stringify(currentFilters.madhabs?.sort()) ===
              JSON.stringify(preset.filters.madhabs?.sort()) &&
            JSON.stringify(currentFilters.traditions?.sort()) ===
              JSON.stringify(preset.filters.traditions?.sort());

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-[var(--brand)] text-white shadow-md"
                  : isActive
                    ? "border border-[var(--border-strong)] bg-white text-[var(--text-strong)] hover:border-[var(--brand)] hover:text-[var(--brand-dark)]"
                    : "border border-dashed border-[var(--border-soft)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand-dark)]"
              }`}
            >
              {lang === "tr" ? preset.labelTr : preset.labelEn}
            </button>
          );
        })}
      </div>
    </div>
  );
}
