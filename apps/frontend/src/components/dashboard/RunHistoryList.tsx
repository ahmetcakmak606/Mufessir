'use client';

import Link from 'next/link';
import type { RunSummary } from '@/lib/tafseer';

interface RunHistoryListProps {
  runs: RunSummary[];
  loading: boolean;
  formatProvenance: (value: RunSummary['provenance']) => string;
  labels: {
    empty: string;
    loading: string;
    open: string;
    replay: string;
    editInputs: string;
    star: string;
    unstar: string;
    starredBadge: string;
    confidence: string;
    provenance: string;
    citations: string;
    createdAt: string;
    updatedAt: string;
    notAvailable: string;
  };
  onToggleStar: (runId: string, nextStarred: boolean) => void;
}

export function RunHistoryList({
  runs,
  loading,
  formatProvenance,
  labels,
  onToggleStar,
}: RunHistoryListProps) {
  if (loading) {
    return <p className="ui-muted text-sm">{labels.loading}</p>;
  }

  if (!runs.length) {
    return <p className="ui-muted text-sm">{labels.empty}</p>;
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <article key={run.runId} data-testid={`run-card-${run.runId}`} className="ui-panel-strong overflow-hidden">
          <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="ui-title text-base font-semibold">
                    {run.title || `${run.verse.surahName} ${run.verse.surahNumber}:${run.verse.verseNumber}`}
                  </h3>
                  {run.starred && <span className="ui-badge">{labels.starredBadge}</span>}
                </div>
                <p className="ui-muted text-xs">
                  {labels.createdAt}: {new Date(run.createdAt).toLocaleString()} · {labels.updatedAt}:{' '}
                  {new Date(run.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleStar(run.runId, !run.starred)}
                className="ui-button-secondary px-2.5 py-1 text-xs"
              >
                {run.starred ? labels.unstar : labels.star}
              </button>
            </div>

            {run.aiResponsePreview && (
              <p className="ui-muted text-sm">{run.aiResponsePreview}</p>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="ui-badge">
                {labels.confidence}: {typeof run.confidence === 'number' ? `${Math.round(run.confidence * 100)}%` : labels.notAvailable}
              </span>
              <span className="ui-badge">
                {labels.provenance}: {formatProvenance(run.provenance)}
              </span>
              <span className="ui-badge">{labels.citations}: {run.citationsCount}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/runs/${run.runId}`} data-testid={`open-run-${run.runId}`} className="ui-button-secondary px-3 py-1.5 text-xs">
                {labels.open}
              </Link>
              <Link href={`/dashboard/query?runId=${run.runId}`} data-testid={`edit-run-${run.runId}`} className="ui-button-secondary px-3 py-1.5 text-xs">
                {labels.editInputs}
              </Link>
              <Link href={`/dashboard/query?runId=${run.runId}&replay=1`} data-testid={`replay-run-${run.runId}`} className="ui-button px-3 py-1.5 text-xs">
                {labels.replay}
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
