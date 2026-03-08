import { describe, expect, it } from 'vitest';
import { formatFacetValue, formatProvenance } from '@/lib/metadata-labels';

describe('metadata labels', () => {
  it('maps facet values to localized labels', () => {
    expect(formatFacetValue('tr', 'periodCodes', 'FOUNDATION')).toBe('Kurucu Dönem');
    expect(formatFacetValue('en', 'sourceAccessibilities', 'FULL_DIGITAL')).toBe('Fully Digital');
  });

  it('falls back to original value when unknown', () => {
    expect(formatFacetValue('en', 'madhabs', 'UnknownMadhab')).toBe('UnknownMadhab');
  });

  it('formats provenance with fallback for missing values', () => {
    expect(formatProvenance('MIXED', 'tr', '—')).toBe('Karma');
    expect(formatProvenance(undefined, 'en', 'N/A')).toBe('N/A');
  });
});
