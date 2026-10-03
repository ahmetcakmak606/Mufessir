"use client";

import { useLang } from "@/context/LangContext";

interface MethodologyPanelProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  label: string;
}

const METHOD_DIMENSIONS_TR = [
  {
    id: "sourceBasis",
    label: "Kaynak Temeli",
    options: [
      { value: "RIVAYET", label: "Rivayet (hadis temelli)" },
      { value: "DIRAYET", label: "Dirayet (analiz temelli)" },
    ],
  },
  {
    id: "linguisticFocus",
    label: "Dilsel Odak",
    options: [
      { value: "LUUGAVI", label: "Lugavî (dilsel)" },
      { value: "TEMATIK", label: "Tematik (konulu)" },
    ],
  },
  {
    id: "interpretiveMode",
    label: "Yorum Biçimi",
    options: [
      { value: "ZAHIR", label: "Zâhir (literal)" },
      { value: "ISARI", label: "İşârî (sembolik)" },
    ],
  },
  {
    id: "legalFocus",
    label: "Hukuk",
    options: [{ value: "AHKAM", label: "Ahkâm (fıkhî)" }],
  },
];

const METHOD_DIMENSIONS_EN = [
  {
    id: "sourceBasis",
    label: "Source Basis",
    options: [
      { value: "RIVAYET", label: "Rivayet (hadith-based)" },
      { value: "DIRAYET", label: "Dirayet (analysis-based)" },
    ],
  },
  {
    id: "linguisticFocus",
    label: "Linguistic Focus",
    options: [
      { value: "LUUGAVI", label: "Lugavî (linguistic)" },
      { value: "TEMATIK", label: "Thematic" },
    ],
  },
  {
    id: "interpretiveMode",
    label: "Interpretive Mode",
    options: [
      { value: "ZAHIR", label: "Zâhir (literal)" },
      { value: "ISARI", label: "İşârî (symbolic)" },
    ],
  },
  {
    id: "legalFocus",
    label: "Legal Focus",
    options: [{ value: "AHKAM", label: "Ahkâm (fiqh)" }],
  },
];

export function MethodologyPanel({
  selectedTags,
  onChange,
  label,
}: MethodologyPanelProps) {
  const { lang } = useLang();
  const dimensions =
    lang === "tr" ? METHOD_DIMENSIONS_TR : METHOD_DIMENSIONS_EN;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="ui-label">{label}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dimensions.map((dimension) => (
          <div key={dimension.id} className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {dimension.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dimension.options.map((option) => {
                const isSelected = selectedTags.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleTag(option.value)}
                    aria-pressed={isSelected}
                    className="ui-chip"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
