export type UiLang = 'tr' | 'en';

type FacetFilterKey =
  | 'periodCodes'
  | 'madhabs'
  | 'traditions'
  | 'sourceAccessibilities'
  | 'tafsirTypes';

const FACET_VALUE_LABELS: Record<UiLang, Record<FacetFilterKey, Record<string, string>>> = {
  tr: {
    periodCodes: {
      FOUNDATION: 'Kurucu Dönem',
      CLASSICAL_EARLY: 'Erken Klasik',
      CLASSICAL_MATURE: 'Olgun Klasik',
      POST_CLASSICAL: 'Geç Klasik',
      MODERN: 'Modern',
      CONTEMPORARY: 'Çağdaş',
    },
    madhabs: {
      "Hanafi": 'Hanefi',
      "Maliki": 'Maliki',
      "Shafi\'i": 'Şafii',
      Hanbali: 'Hanbeli',
    },
    traditions: {
      SUNNI_MAINSTREAM: 'Sünni Ana Akım',
      MUTAZILI: 'Mutezili',
      SHII_IMAMI: 'Şii İmami',
      SHII_ZAYDI: 'Şii Zeydi',
      SUFI_ISHARI: 'Sufi İşari',
      IBADI: 'İbadi',
      SALAFI: 'Selefi',
      CROSS_TRADITION: 'Geleneklerarası',
    },
    sourceAccessibilities: {
      FULL_DIGITAL: 'Tam Dijital',
      PARTIAL_DIGITAL: 'Kısmi Dijital',
      MANUSCRIPT_ONLY: 'Yalnız Yazma',
      LOST: 'Kayıp',
    },
    tafsirTypes: {
      RIVAYET: 'Rivayet',
      DIRAYET: 'Dirayet',
      FIKHI: 'Fıkhi',
      ISHARI: 'İşari',
      LUGAVI: 'Lügavi',
      KELAMI: 'Kelami',
    },
  },
  en: {
    periodCodes: {
      FOUNDATION: 'Foundational',
      CLASSICAL_EARLY: 'Early Classical',
      CLASSICAL_MATURE: 'Mature Classical',
      POST_CLASSICAL: 'Post-Classical',
      MODERN: 'Modern',
      CONTEMPORARY: 'Contemporary',
    },
    madhabs: {
      "Hanafi": 'Hanafi',
      "Maliki": 'Maliki',
      "Shafi\'i": 'Shafi\'i',
      Hanbali: 'Hanbali',
    },
    traditions: {
      SUNNI_MAINSTREAM: 'Sunni Mainstream',
      MUTAZILI: 'Mu\'tazili',
      SHII_IMAMI: 'Shii Imami',
      SHII_ZAYDI: 'Shii Zaydi',
      SUFI_ISHARI: 'Sufi Ishari',
      IBADI: 'Ibadi',
      SALAFI: 'Salafi',
      CROSS_TRADITION: 'Cross-Tradition',
    },
    sourceAccessibilities: {
      FULL_DIGITAL: 'Fully Digital',
      PARTIAL_DIGITAL: 'Partially Digital',
      MANUSCRIPT_ONLY: 'Manuscript Only',
      LOST: 'Lost',
    },
    tafsirTypes: {
      RIVAYET: 'Riwayah',
      DIRAYET: 'Dirayah',
      FIKHI: 'Fiqhi',
      ISHARI: 'Ishari',
      LUGAVI: 'Lughawi',
      KELAMI: 'Kalami',
    },
  },
};

const PROVENANCE_LABELS: Record<UiLang, Record<string, string>> = {
  tr: {
    PRIMARY: 'Birincil',
    MIXED: 'Karma',
    NONE: 'Yok',
  },
  en: {
    PRIMARY: 'Primary',
    MIXED: 'Mixed',
    NONE: 'None',
  },
};

export function formatFacetValue(lang: UiLang, filterKey: FacetFilterKey, value: string): string {
  return FACET_VALUE_LABELS[lang][filterKey][value] || value;
}

export function formatProvenance(value: string | null | undefined, lang: UiLang, fallbackLabel: string): string {
  if (!value) return fallbackLabel;
  return PROVENANCE_LABELS[lang][value] || value;
}
