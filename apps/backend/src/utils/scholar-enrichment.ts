export type ScholarPatchField =
  | 'mufassirTr'
  | 'mufassirEn'
  | 'mufassirAr'
  | 'mufassirNameLong'
  | 'birthYear'
  | 'deathYear'
  | 'deathHijri'
  | 'madhab'
  | 'environment'
  | 'originCountry'
  | 'bookId'
  | 'tafsirType1'
  | 'tafsirType2'
  | 'explanation'
  | 'detailInformation';

export type ScholarExistingSnapshot = Partial<Record<ScholarPatchField, string | number | null>>;

export type ScholarPatchInput = Partial<Record<ScholarPatchField, string | number | null>>;

export interface ScholarReferenceInput {
  sourceType: string | null;
  sourceTitle: string | null;
  volume: string | null;
  page: string | null;
  edition: string | null;
  citationText: string | null;
  provenance: string | null;
  isPrimary: boolean;
}

const TEXT_FIELDS: ScholarPatchField[] = [
  'mufassirTr',
  'mufassirEn',
  'mufassirAr',
  'mufassirNameLong',
  'madhab',
  'environment',
  'originCountry',
  'bookId',
  'tafsirType1',
  'tafsirType2',
  'explanation',
  'detailInformation',
];

const INT_FIELDS: ScholarPatchField[] = ['birthYear', 'deathYear', 'deathHijri'];

function hasValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return value.trim().length > 0;
}

export function normalizeNullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function parseOptionalInt(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Expected integer value, received "${value}"`);
    }
    return value;
  }
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer value, received "${value}"`);
  }
  return parsed;
}

export function parseOptionalBoolean(
  value: string | boolean | null | undefined
): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(lowered)) return true;
  if (['0', 'false', 'no', 'n'].includes(lowered)) return false;
  throw new Error(`Expected boolean value, received "${value}"`);
}

export function buildScholarPatch(
  input: ScholarPatchInput,
  existing: ScholarExistingSnapshot,
  allowOverwrite: boolean
): Partial<Record<ScholarPatchField, string | number | null>> {
  const patch: Partial<Record<ScholarPatchField, string | number | null>> = {};

  for (const field of TEXT_FIELDS) {
    const nextValue = input[field];
    if (typeof nextValue !== 'string') continue;
    const normalized = normalizeNullableText(nextValue);
    if (!normalized) continue;
    const currentValue = existing[field];
    if (!allowOverwrite && hasValue(currentValue)) continue;
    patch[field] = normalized;
  }

  for (const field of INT_FIELDS) {
    const nextValue = input[field];
    if (typeof nextValue !== 'number' || !Number.isFinite(nextValue)) continue;
    const currentValue = existing[field];
    if (!allowOverwrite && hasValue(currentValue)) continue;
    patch[field] = nextValue;
  }

  return patch;
}

export function validateReferenceRequirement(
  patch: Record<string, unknown>,
  reference: ScholarReferenceInput
): string[] {
  const errors: string[] = [];
  const hasPatch = Object.keys(patch).length > 0;

  if (!hasPatch) return errors;

  if (!normalizeNullableText(reference.sourceType)) {
    errors.push('source_type is required when scholar fields are updated');
  }
  if (!normalizeNullableText(reference.sourceTitle)) {
    errors.push('source_title is required when scholar fields are updated');
  }

  const hasCitationDetail = Boolean(
    normalizeNullableText(reference.citationText) ||
      normalizeNullableText(reference.volume) ||
      normalizeNullableText(reference.page) ||
      normalizeNullableText(reference.edition)
  );
  if (!hasCitationDetail) {
    errors.push(
      'at least one citation detail is required (citation_text, volume, page, or edition)'
    );
  }

  return errors;
}

export function referenceFingerprint(
  scholarId: string,
  reference: Pick<
    ScholarReferenceInput,
    'sourceType' | 'sourceTitle' | 'volume' | 'page' | 'edition' | 'citationText'
  >
): string {
  return [
    scholarId,
    normalizeNullableText(reference.sourceType)?.toLowerCase() || '',
    normalizeNullableText(reference.sourceTitle)?.toLowerCase() || '',
    normalizeNullableText(reference.volume)?.toLowerCase() || '',
    normalizeNullableText(reference.page)?.toLowerCase() || '',
    normalizeNullableText(reference.edition)?.toLowerCase() || '',
    normalizeNullableText(reference.citationText)?.toLowerCase() || '',
  ].join('::');
}
