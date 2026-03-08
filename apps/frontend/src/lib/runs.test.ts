import { describe, expect, it } from 'vitest';
import { countStarredRuns, filterAndSortRuns } from '@/lib/runs';
import type { RunSummary } from '@/lib/tafseer';

const baseRuns: RunSummary[] = [
  {
    runId: 'run-a',
    searchId: 'run-a',
    verse: { id: 'verse-1-1', surahNumber: 1, surahName: 'Fatiha', verseNumber: 1 },
    filters: {},
    title: 'Opening',
    notes: null,
    starred: true,
    aiResponsePreview: 'Mercy and praise.',
    confidence: 0.9,
    provenance: 'PRIMARY',
    citationsCount: 4,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:05:00.000Z',
  },
  {
    runId: 'run-b',
    searchId: 'run-b',
    verse: { id: 'verse-2-255', surahNumber: 2, surahName: 'Bakara', verseNumber: 255 },
    filters: {},
    title: 'Kursi',
    notes: null,
    starred: false,
    aiResponsePreview: 'Sovereignty and protection.',
    confidence: 0.65,
    provenance: 'MIXED',
    citationsCount: 1,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:05:00.000Z',
  },
  {
    runId: 'run-c',
    searchId: 'run-c',
    verse: { id: 'verse-112-1', surahNumber: 112, surahName: 'Ikhlas', verseNumber: 1 },
    filters: {},
    title: null,
    notes: null,
    starred: false,
    aiResponsePreview: 'Oneness of Allah.',
    confidence: null,
    provenance: 'NONE',
    citationsCount: 0,
    createdAt: '2026-03-03T10:00:00.000Z',
    updatedAt: '2026-03-03T10:05:00.000Z',
  },
];

describe('runs filtering and sorting', () => {
  it('counts starred runs', () => {
    expect(countStarredRuns(baseRuns)).toBe(1);
  });

  it('filters starred only and sorts by newest', () => {
    const result = filterAndSortRuns(baseRuns, {
      tab: 'starred',
      query: '',
      sortBy: 'newest',
      provenanceFilter: 'ALL',
      citationFilter: 'ALL',
    });

    expect(result).toHaveLength(1);
    expect(result[0].runId).toBe('run-a');
  });

  it('filters by query and provenance', () => {
    const result = filterAndSortRuns(baseRuns, {
      tab: 'all',
      query: 'kursi',
      sortBy: 'newest',
      provenanceFilter: 'MIXED',
      citationFilter: 'ALL',
    });

    expect(result).toHaveLength(1);
    expect(result[0].runId).toBe('run-b');
  });

  it('sorts by citation count descending', () => {
    const result = filterAndSortRuns(baseRuns, {
      tab: 'all',
      query: '',
      sortBy: 'citations',
      provenanceFilter: 'ALL',
      citationFilter: 'ALL',
    });

    expect(result.map((run) => run.runId)).toEqual(['run-a', 'run-b', 'run-c']);
  });

  it('applies citation presence filter', () => {
    const withCitations = filterAndSortRuns(baseRuns, {
      tab: 'all',
      query: '',
      sortBy: 'newest',
      provenanceFilter: 'ALL',
      citationFilter: 'WITH',
    });
    const withoutCitations = filterAndSortRuns(baseRuns, {
      tab: 'all',
      query: '',
      sortBy: 'newest',
      provenanceFilter: 'ALL',
      citationFilter: 'WITHOUT',
    });

    expect(withCitations.map((run) => run.runId)).toEqual(['run-b', 'run-a']);
    expect(withoutCitations.map((run) => run.runId)).toEqual(['run-c']);
  });
});
