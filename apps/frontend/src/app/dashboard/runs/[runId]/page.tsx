'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { CitationPanel } from '@/components/dashboard/CitationPanel';
import { SourceSnippetPanel } from '@/components/dashboard/SourceSnippetPanel';
import { useRunDetailQuery, useUpdateRunMutation } from '@/hooks/use-run-history';
import { formatProvenance } from '@/lib/metadata-labels';

function toRunId(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export default function RunDetailPage() {
  const { lang } = useLang();
  const t = locales[lang].dashboardRunDetail;
  const params = useParams<{ runId: string | string[] }>();
  const runId = useMemo(() => toRunId(params.runId), [params.runId]);

  const runQuery = useRunDetailQuery(runId);
  const updateMutation = useUpdateRunMutation();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runQuery.data) return;
    setTitle(runQuery.data.title || '');
    setNotes(runQuery.data.notes || '');
  }, [runQuery.data]);

  const run = runQuery.data;

  const saveMeta = async () => {
    if (!runId) return;
    setStatus('');
    setError('');
    try {
      await updateMutation.mutateAsync({
        runId,
        payload: {
          title: title.trim() || null,
          notes: notes.trim() || null,
        },
      });
      setStatus(t.saveSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    }
  };

  const toggleStar = async () => {
    if (!runId || !run) return;
    setStatus('');
    setError('');
    try {
      await updateMutation.mutateAsync({
        runId,
        payload: {
          starred: !run.starred,
        },
      });
      await runQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    }
  };

  if (runQuery.isLoading) {
    return <p className="ui-muted text-sm">{t.loading}</p>;
  }

  if (!run) {
    return (
      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-3 px-4 py-5 sm:px-5 sm:py-6">
          <h2 className="ui-title text-lg font-semibold">{t.notFoundTitle}</h2>
          <p className="ui-muted text-sm">{t.notFoundText}</p>
          {runQuery.error && <p className="ui-danger rounded-lg px-3 py-2 text-sm">{t.loadFailed}</p>}
          <Link href="/dashboard/runs" className="ui-button-secondary w-fit px-3 py-2 text-sm">
            {t.backToRuns}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-4 px-4 py-5 sm:px-5 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="ui-title text-xl font-semibold">
                {run.title || `${run.verse.surahName} ${run.verse.surahNumber}:${run.verse.verseNumber}`}
              </h2>
              <p className="ui-muted text-sm">
                {run.verse.surahName} {run.verse.surahNumber}:{run.verse.verseNumber}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/query?runId=${run.runId}&replay=1`} className="ui-button px-3 py-2 text-xs">
                {t.replay}
              </Link>
              <button type="button" onClick={() => void toggleStar()} className="ui-button-secondary px-3 py-2 text-xs">
                {run.starred ? t.unstar : t.star}
              </button>
              <Link href="/dashboard/runs" className="ui-button-secondary px-3 py-2 text-xs">
                {t.backToRuns}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="ui-badge">
              {t.confidence}:{' '}
              {typeof run.confidence === 'number' ? `${Math.round(run.confidence * 100)}%` : t.notAvailable}
            </span>
            <span className="ui-badge">
              {t.provenance}: {formatProvenance(run.provenance, lang, t.notAvailable)}
            </span>
            <span className="ui-badge">
              {t.citations}: {run.citations.length}
            </span>
            <span className="ui-badge">
              {t.createdAt}: {new Date(run.createdAt).toLocaleString()}
            </span>
            <span className="ui-badge">
              {t.updatedAt}: {new Date(run.updatedAt).toLocaleString()}
            </span>
          </div>

          {status && <p className="ui-panel rounded-lg px-3 py-2 text-sm ui-muted">{status}</p>}
          {error && <p className="ui-danger rounded-lg px-3 py-2 text-sm">{error}</p>}
        </div>
      </section>

      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-3 px-4 py-5 sm:px-5 sm:py-6">
          <h3 className="ui-title text-lg font-semibold">{t.metadataTitle}</h3>
          <p className="ui-muted text-sm">{t.metadataDescription}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">{t.titleLabel}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="ui-input"
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="ui-muted block text-xs font-semibold uppercase tracking-[0.08em]">{t.notesLabel}</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={4000}
              rows={4}
              className="ui-input"
            />
          </label>

          <button
            type="button"
            onClick={() => void saveMeta()}
            disabled={updateMutation.isPending}
            className="ui-button w-fit px-4 py-2 text-sm"
          >
            {updateMutation.isPending ? t.savingMeta : t.saveMeta}
          </button>
        </div>
      </section>

      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-3 px-4 py-5 sm:px-5 sm:py-6">
          <h3 className="ui-title text-lg font-semibold">{t.responseTitle}</h3>
          <div className="ui-panel min-h-48 whitespace-pre-wrap p-4 text-sm leading-relaxed text-[var(--text-strong)]">
            {run.aiResponse || <p className="ui-muted">{t.emptyResponse}</p>}
          </div>
        </div>
      </section>

      <SourceSnippetPanel title={t.snippetsTitle} empty={t.emptySnippets} excerpts={run.sourceExcerpts} />
      <CitationPanel
        title={t.citationsTitle}
        empty={t.emptyCitations}
        citations={run.citations}
        labels={{ volumeShort: t.volumeShort, pageShort: t.pageShort }}
      />
    </div>
  );
}
