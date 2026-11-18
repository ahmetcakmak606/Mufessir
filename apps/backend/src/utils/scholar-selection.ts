// Müfessir seçimi kuralı (18 Kasım 2026 kullanıcı kararı):
//  - Kullanıcı en fazla 5 müfessir seçebilir; fazlası reddedilir (sessizce kırpılmaz).
//  - Hiç seçim yoksa varsayılan beşli kullanılır: Taberî, Mâtürîdî, Zemahşerî,
//    Râzî, İbn Kesîr (API kimlikleri = mufassirs.mufassir_id).
// Ön yüz aynı değerleri paylaşır (apps/frontend/src/lib/tafseer.ts).

export const MAX_SELECTED_SCHOLARS = 5;

export const DEFAULT_SCHOLAR_IDS: readonly string[] = ["7", "9", "19", "22", "29"];

export const SCHOLAR_LIMIT_ERROR = `En fazla ${MAX_SELECTED_SCHOLARS} müfessir seçebilirsiniz.`;

export class ScholarSelectionError extends Error {}

type ScholarFilters = {
  scholars?: unknown;
  mufassirs?: unknown;
  excludeScholars?: unknown;
  excludeMufassirs?: unknown;
};

const asIdList = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map((v) => String(v)))] : [];

/**
 * Seçim listesini kurala göre normalleştirir. Dahil listesi 5'ten uzunsa hata
 * fırlatır. Dahil ve dışlama listeleri boşsa varsayılan beşliyi koyar.
 * Girdi nesnesini değiştirmez; yeni filtre nesnesi döndürür.
 */
export function normalizeScholarSelection<T extends ScholarFilters>(
  filters: T | undefined,
): T & { scholars: string[] } {
  const base = (filters ?? {}) as T;
  const include = asIdList(
    asIdList(base.mufassirs).length > 0 ? base.mufassirs : base.scholars,
  );
  const exclude = asIdList(
    asIdList(base.excludeMufassirs).length > 0 ? base.excludeMufassirs : base.excludeScholars,
  );

  if (include.length > MAX_SELECTED_SCHOLARS) {
    throw new ScholarSelectionError(SCHOLAR_LIMIT_ERROR);
  }

  const scholars = include.length === 0 && exclude.length === 0
    ? [...DEFAULT_SCHOLAR_IDS]
    : include;

  return { ...base, mufassirs: undefined, scholars };
}
