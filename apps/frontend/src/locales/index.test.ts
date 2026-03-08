import { describe, expect, it } from 'vitest';
import { locales } from '@/locales';

function collectKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return [prefix];
  return entries.flatMap(([key, nested]) =>
    collectKeys(nested, prefix ? `${prefix}.${key}` : key)
  );
}

describe('locale parity', () => {
  it('keeps TR and EN locale key sets aligned', () => {
    const trKeys = collectKeys(locales.tr).sort();
    const enKeys = collectKeys(locales.en).sort();
    expect(enKeys).toEqual(trKeys);
  });
});
