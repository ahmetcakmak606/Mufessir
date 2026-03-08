'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { RunHistoryList } from '@/components/dashboard/RunHistoryList';
import { useInfiniteRunHistoryQuery, useUpdateRunMutation } from '@/hooks/use-run-history';
import { formatProvenance } from '@/lib/metadata-labels';
import {
  countStarredRuns,
  filterAndSortRuns,
  type CitationFilter,
  type ProvenanceFilter,
  type RunsSort,
  type RunsTab,
} from '@/lib/runs';

export default function RunsPage() {
  const { lang } = useLang();
  const t = locales[lang].dashboardRuns;

  const runsQuery = useInfiniteRunHistoryQuery(20);
  const updateRunMutation = useUpdateRunMutation();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<RunsTab>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<RunsSort>('newest');
  const [provenanceFilter, setProvenanceFilter] = useState<ProvenanceFilter>('ALL');
  const [citationFilter, setCitationFilter] = useState<CitationFilter>('ALL');

  const runs = useMemo(
    () => runsQuery.data?.pages.flatMap((page) => page.items) || [],
    [runsQuery.data]
  );
  const totalCount = runs.length;
  const starredCount = useMemo(() => countStarredRuns(runs), [runs]);

  const filteredRuns = useMemo(() => {
    return filterAndSortRuns(runs, {
      tab,
      query,
      sortBy,
      provenanceFilter,
      citationFilter,
    });
  }, [citationFilter, provenanceFilter, query, runs, sortBy, tab]);

  const latestRun = filteredRuns[0];
  const hasActiveFilters =
    tab !== 'all' ||
    query.trim().length > 0 ||
    sortBy !== 'newest' ||
    provenanceFilter !== 'ALL' ||
    citationFilter !== 'ALL';

  const onToggleStar = async (runId: string, nextStarred: boolean) => {
    setStatus('');
    setError('');
    try {
      await updateRunMutation.mutateAsync({ runId, payload: { starred: nextStarred } });
      setStatus(t.updateSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.updateFailed);
    }
  };

  const loadMore = () => {
    void runsQuery.fetchNextPage();
  };

  const clearFilters = () => {
    setTab('all');
    setQuery('');
    setSortBy('newest');
    setProvenanceFilter('ALL');
    setCitationFilter('ALL');
  };

  return (
    <div className="space-y-4">
      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-3 px-4 py-5 sm:px-5 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="ui-title text-xl font-semibold">{t.title}</h2>
              <p className="ui-muted text-sm">{t.subtitle}</p>
              <p className="ui-muted mt-1 text-xs">
                {t.totalRuns}: {totalCount} · {t.starredRuns}: {starredCount}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {latestRun && (
                <Link href={`/dashboard/query?runId=${latestRun.runId}&replay=1`} className="ui-button px-3 py-2 text-xs">
                  {t.replayLatest}
                </Link>
              )}
              <button
                type="button"
                onClick={() => void runsQuery.refetch()}
                disabled={runsQuery.isRefetching}
                className="ui-button-secondary px-3 py-2 text-xs"
              >
                {t.refresh}
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-[var(--border-soft)] p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex gap-2 rounded-lg border border-[var(--border-soft)] p-1">
              <button
                type="button"
                onClick={() => setTab('all')}
                className="ui-button-ghost flex-1"
                data-active={tab === 'all'}
              >
                {t.tabAll}
              </button>
              <button
                type="button"
                onClick={() => setTab('starred')}
                className="ui-button-ghost flex-1"
                data-active={tab === 'starred'}
              >
                {t.tabStarred}
              </button>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="ui-input"
            />

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as RunsSort)}
              className="ui-select"
            >
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
              <option value="confidence">{t.sortConfidence}</option>
              <option value="citations">{t.sortCitations}</option>
            </select>

            <select
              value={provenanceFilter}
              onChange={(event) => setProvenanceFilter(event.target.value as ProvenanceFilter)}
              className="ui-select"
            >
              <option value="ALL">{t.provenanceAll}</option>
              <option value="PRIMARY">{formatProvenance('PRIMARY', lang, t.notAvailable)}</option>
              <option value="MIXED">{formatProvenance('MIXED', lang, t.notAvailable)}</option>
              <option value="NONE">{formatProvenance('NONE', lang, t.notAvailable)}</option>
            </select>

            <div className="flex gap-2">
              <select
                value={citationFilter}
                onChange={(event) => setCitationFilter(event.target.value as CitationFilter)}
                className="ui-select"
              >
                <option value="ALL">{t.citationsAll}</option>
                <option value="WITH">{t.citationsWith}</option>
                <option value="WITHOUT">{t.citationsWithout}</option>
              </select>
              <button type="button" onClick={clearFilters} className="ui-button-secondary px-3 text-xs">
                {t.clearFilters}
              </button>
            </div>
          </div>

          <p className="ui-muted text-xs">
            {t.resultsLabel}: {filteredRuns.length}
          </p>

          {status && <p className="ui-panel rounded-lg px-3 py-2 text-sm ui-muted">{status}</p>}
          {error && <p className="ui-danger rounded-lg px-3 py-2 text-sm">{error}</p>}
        </div>
      </section>

      <RunHistoryList
        runs={filteredRuns}
        loading={runsQuery.isLoading}
        formatProvenance={(value) => formatProvenance(value, lang, t.notAvailable)}
        onToggleStar={(runId, nextStarred) => void onToggleStar(runId, nextStarred)}
        labels={{
          empty: hasActiveFilters && runs.length ? t.noResultsForFilters : t.empty,
          loading: t.loading,
          open: t.open,
          replay: t.replay,
          editInputs: t.editInputs,
          star: t.star,
          unstar: t.unstar,
          starredBadge: t.starredBadge,
          confidence: t.confidence,
          provenance: t.provenance,
          citations: t.citations,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          notAvailable: t.notAvailable,
        }}
      />

      {runsQuery.hasNextPage && (
        <div className="pt-1">
          <button
            type="button"
            onClick={loadMore}
            disabled={runsQuery.isFetchingNextPage}
            className="ui-button-secondary px-4 py-2 text-sm"
          >
            {runsQuery.isFetchingNextPage ? t.loadingMore : t.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
