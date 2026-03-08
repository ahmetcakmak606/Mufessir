import type { RunSummary } from '@/lib/tafseer';

export type RunsTab = 'all' | 'starred';
export type RunsSort = 'newest' | 'oldest' | 'confidence' | 'citations';
export type ProvenanceFilter = 'ALL' | 'PRIMARY' | 'MIXED' | 'NONE';
export type CitationFilter = 'ALL' | 'WITH' | 'WITHOUT';

export interface RunFilterState {
  tab: RunsTab;
  query: string;
  sortBy: RunsSort;
  provenanceFilter: ProvenanceFilter;
  citationFilter: CitationFilter;
}

function sortRuns(items: RunSummary[], sortBy: RunsSort): RunSummary[] {
  const next = [...items];
  if (sortBy === 'oldest') {
    next.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return next;
  }
  if (sortBy === 'confidence') {
    next.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
    return next;
  }
  if (sortBy === 'citations') {
    next.sort(
      (a, b) => b.citationsCount - a.citationsCount || +new Date(b.updatedAt) - +new Date(a.updatedAt)
    );
    return next;
  }
  next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return next;
}

export function filterAndSortRuns(runs: RunSummary[], state: RunFilterState): RunSummary[] {
  const normalizedQuery = state.query.trim().toLowerCase();
  const filtered = runs.filter((run) => {
    if (state.tab === 'starred' && !run.starred) return false;
    if (state.provenanceFilter !== 'ALL' && run.provenance !== state.provenanceFilter) return false;
    if (state.citationFilter === 'WITH' && run.citationsCount <= 0) return false;
    if (state.citationFilter === 'WITHOUT' && run.citationsCount > 0) return false;
    if (!normalizedQuery) return true;
    const verseRef = `${run.verse.surahNumber}:${run.verse.verseNumber}`;
    const haystack = `${run.title || ''} ${run.verse.surahName} ${verseRef} ${run.aiResponsePreview || ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return sortRuns(filtered, state.sortBy);
}

export function countStarredRuns(runs: RunSummary[]): number {
  return runs.filter((run) => run.starred).length;
}
