'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { surahs } from '@/lib/surahs';
import { tokenStorage } from '@/lib/auth';
import {
  type Citation,
  type ComparisonRunModel,
  type ProvenanceIndicator,
  type RunDraftFilters,
  type ScholarOption,
  type SourceExcerpt,
  fetchVerseByNumbers,
  normalizeTafseerResponseToRun,
  startTafseerStream,
} from '@/lib/tafseer';
import { formatFacetValue, formatProvenance } from '@/lib/metadata-labels';
import { useFiltersQuery } from '@/hooks/use-filters-query';
import { useRunDetailQuery, useUpdateRunMutation } from '@/hooks/use-run-history';
import { QueryComposer } from '@/components/dashboard/QueryComposer';
import { FilterFacets } from '@/components/dashboard/FilterFacets';
import { ResultStream } from '@/components/dashboard/ResultStream';
import { RunActions } from '@/components/dashboard/RunActions';
import { CitationPanel } from '@/components/dashboard/CitationPanel';
import { SourceSnippetPanel } from '@/components/dashboard/SourceSnippetPanel';

const defaultFilters: RunDraftFilters = {
  language: 'Turkish',
  tone: 7,
  intellectLevel: 7,
  responseLength: 6,
};

export default function QueryWorkspacePage() {
  const { user, refreshUser } = useAuth();
  const { lang } = useLang();
  const t = locales[lang].dashboardQuery;
  const dashboard = locales[lang].dashboard;
  const searchParams = useSearchParams();

  const runIdParam = searchParams.get('runId') || undefined;
  const shouldReplay = searchParams.get('replay') === '1';

  const [surahNumber, setSurahNumber] = useState(1);
  const [verseNumber, setVerseNumber] = useState(1);
  const [verseId, setVerseId] = useState('');
  const [surahName, setSurahName] = useState('');
  const [revelationType, setRevelationType] = useState<'Mekki' | 'Medeni' | 'UNKNOWN'>('UNKNOWN');

  const [filters, setFilters] = useState<RunDraftFilters>(defaultFilters);
  const [scholarQuery, setScholarQuery] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [firstByteAt, setFirstByteAt] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ promptTokens?: number; completionTokens?: number; totalTokens?: number } | null>(null);

  const [confidence, setConfidence] = useState<number | null>(null);
  const [provenance, setProvenance] = useState<ProvenanceIndicator | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [sourceExcerpts, setSourceExcerpts] = useState<SourceExcerpt[]>([]);

  const [comparisonRuns, setComparisonRuns] = useState<ComparisonRunModel>({
    primaryRun: null,
    secondaryRun: null,
  });

  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [mobileResultTab, setMobileResultTab] = useState<'result' | 'citations' | 'snippets'>('result');

  const hydratedRunRef = useRef<string | null>(null);
  const replayedRef = useRef(false);

  const filtersQuery = useFiltersQuery();
  const availableFilters = filtersQuery.data || null;
  const runDetailQuery = useRunDetailQuery(runIdParam);
  const updateRunMutation = useUpdateRunMutation();

  const includeIds = useMemo(() => new Set(filters.scholars || []), [filters.scholars]);
  const excludeIds = useMemo(() => new Set(filters.excludeScholars || []), [filters.excludeScholars]);

  useEffect(() => {
    if (!availableFilters) return;
    setFilters((prev) => {
      if (Array.isArray(prev.scholars)) return prev;
      return {
        ...prev,
        scholars: availableFilters.scholars.map((scholar) => scholar.id),
        excludeScholars: [],
      };
    });
  }, [availableFilters]);

  const filteredScholars = useMemo<ScholarOption[]>(() => {
    let items = (availableFilters?.scholars as ScholarOption[]) || [];
    if (scholarQuery.trim()) {
      const q = scholarQuery.toLowerCase();
      items = items.filter((scholar) => scholar.name.toLowerCase().includes(q));
    }
    if (filters.periodCodes?.length) {
      items = items.filter((scholar) => scholar.periodCode && filters.periodCodes?.includes(scholar.periodCode));
    }
    if (filters.madhabs?.length) {
      items = items.filter((scholar) => scholar.madhab && filters.madhabs?.includes(scholar.madhab));
    }
    if (filters.sourceAccessibilities?.length) {
      items = items.filter(
        (scholar) => scholar.sourceAccessibility && filters.sourceAccessibilities?.includes(scholar.sourceAccessibility)
      );
    }
    if (filters.traditions?.length) {
      items = items.filter((scholar) =>
        scholar.traditionAcceptance.some((tag) => filters.traditions?.includes(tag))
      );
    }
    if (filters.tafsirTypes?.length) {
      items = items.filter((scholar) =>
        [scholar.tafsirType1, scholar.tafsirType2].some(
          (typeValue) => typeof typeValue === 'string' && filters.tafsirTypes?.includes(typeValue)
        )
      );
    }
    return items;
  }, [availableFilters, scholarQuery, filters]);

  const canAnalyze = Boolean(user && (user.dailyQuota ?? 0) > 0 && !isAnalyzing);

  const resolveVerse = useCallback(async () => {
    const verse = await fetchVerseByNumbers(surahNumber, verseNumber);
    setVerseId(verse.id);
    setSurahName(verse.surahName);
    const meta = surahs.find((surah) => surah.number === surahNumber);
    setRevelationType(meta?.revelation || 'UNKNOWN');
    return verse;
  }, [surahNumber, verseNumber]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const verse = await fetchVerseByNumbers(surahNumber, verseNumber);
        if (cancelled) return;
        setVerseId(verse.id);
        setSurahName(verse.surahName);
        const meta = surahs.find((surah) => surah.number === surahNumber);
        setRevelationType(meta?.revelation || 'UNKNOWN');
      } catch {
        if (cancelled) return;
        setVerseId('');
        setSurahName('');
        setRevelationType('UNKNOWN');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [surahNumber, verseNumber]);

  useEffect(() => {
    const detail = runDetailQuery.data;
    if (!detail || hydratedRunRef.current === detail.runId) return;

    hydratedRunRef.current = detail.runId;
    setCurrentRunId(detail.runId);
    setSurahNumber(detail.verse.surahNumber);
    setVerseNumber(detail.verse.verseNumber);
    setVerseId(detail.verse.id);
    setSurahName(detail.verse.surahName);
    setFilters({ ...defaultFilters, ...(detail.filters || {}) });

    setStreamContent(detail.aiResponse || '');
    setConfidence(detail.confidence);
    setProvenance(detail.provenance);
    setCitations(detail.citations || []);
    setSourceExcerpts(detail.sourceExcerpts || []);

    const run = normalizeTafseerResponseToRun(
      {
        verse: detail.verse,
        filters: detail.filters,
        aiResponse: detail.aiResponse,
        confidence: detail.confidence,
        provenance: detail.provenance,
        citations: detail.citations,
        sourceExcerpts: detail.sourceExcerpts,
        runId: detail.runId,
        searchId: detail.searchId,
      },
      {
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
        title: detail.title,
        notes: detail.notes,
        starred: detail.starred,
      }
    );

    setComparisonRuns((prev) => ({ ...prev, primaryRun: run }));
  }, [runDetailQuery.data]);

  const handleAnalyze = useCallback(async () => {
    if (!user) return;

    setError('');
    setStatus('');
    setIsAnalyzing(true);
    setStreamContent('');
    setUsage(null);
    setStartedAt(null);
    setFirstByteAt(null);
    setCompletedAt(null);
    setConfidence(null);
    setProvenance(null);
    setCitations([]);
    setSourceExcerpts([]);

    let accumulated = '';

    try {
      const verse = verseId ? { id: verseId, surahNumber, surahName, verseNumber } : await resolveVerse();
      const token = tokenStorage.get();
      if (!token) throw new Error(dashboard.notAuthenticated);

      await startTafseerStream(
        {
          verseId: verse.id,
          filters: {
            ...filters,
            language: filters.language || (lang === 'tr' ? 'Turkish' : 'English'),
          },
          stream: true,
        },
        token,
        (evt) => {
          if (evt.type === 'start') {
            setStartedAt(performance.now());
            if (evt.runId || evt.searchId) {
              setCurrentRunId(evt.runId || evt.searchId || null);
            }
          }

          if (evt.type === 'chunk' && evt.content) {
            accumulated += evt.content;
            setFirstByteAt((prev) => prev ?? performance.now());
            setStreamContent((prev) => prev + evt.content);
          }

          if (evt.type === 'error') {
            setError(evt.error || dashboard.streamingError);
          }

          if (evt.type === 'complete') {
            void refreshUser();
            setCompletedAt(performance.now());
            setUsage(evt.usage || null);

            const nextRunId = evt.runId || evt.searchId || currentRunId || null;
            setCurrentRunId(nextRunId);
            setConfidence(typeof evt.confidence === 'number' ? evt.confidence : null);
            setProvenance(evt.provenance || null);
            setCitations(Array.isArray(evt.citations) ? evt.citations : []);
            setSourceExcerpts(Array.isArray(evt.sourceExcerpts) ? evt.sourceExcerpts : []);

            const run = normalizeTafseerResponseToRun(
              {
                verse: {
                  id: verse.id,
                  surahNumber: verse.surahNumber,
                  surahName: verse.surahName,
                  verseNumber: verse.verseNumber,
                },
                filters,
                aiResponse: accumulated,
                confidence: evt.confidence,
                provenance: evt.provenance,
                citations: evt.citations,
                sourceExcerpts: evt.sourceExcerpts,
                runId: nextRunId || undefined,
                searchId: evt.searchId,
              },
              {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            );

            setComparisonRuns((prev) => ({ ...prev, primaryRun: run }));
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : dashboard.analysisFailed);
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    user,
    verseId,
    surahNumber,
    surahName,
    verseNumber,
    resolveVerse,
    filters,
    lang,
    dashboard.notAuthenticated,
    dashboard.streamingError,
    dashboard.analysisFailed,
    refreshUser,
    currentRunId,
  ]);

  useEffect(() => {
    if (!shouldReplay || replayedRef.current || !runDetailQuery.data) return;
    replayedRef.current = true;
    void handleAnalyze();
  }, [shouldReplay, runDetailQuery.data, handleAnalyze]);

  const saveCurrentRun = async () => {
    if (!currentRunId) return;
    try {
      await updateRunMutation.mutateAsync({ runId: currentRunId, payload: { starred: true } });
      setStatus(t.runSaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.runSaveFailed);
    }
  };

  const copyCitations = async () => {
    if (!citations.length) {
      setStatus(t.noCitations);
      return;
    }
    const citationText = citations
      .map((citation) => {
        const extras = [
          citation.volume ? `${dashboard.volumeShort} ${citation.volume}` : null,
          citation.page ? `${dashboard.pageShort} ${citation.page}` : null,
          citation.edition || null,
        ]
          .filter(Boolean)
          .join(' · ');
        return `${citation.scholarName} — ${citation.sourceTitle}${extras ? ` (${extras})` : ''}`;
      })
      .join('\n');

    await navigator.clipboard.writeText(citationText);
    setStatus(t.citationsCopied);
  };

  const shareRun = async () => {
    if (!currentRunId) {
      setStatus(t.runUnavailable);
      return;
    }
    const link = `${window.location.origin}/dashboard/runs/${currentRunId}`;
    await navigator.clipboard.writeText(link);
    setStatus(t.shareLinkCopied);
  };

  const includeScholar = (id: string) => {
    const next = new Set(filters.scholars || []);
    next.add(id);
    const nextExclude = new Set(filters.excludeScholars || []);
    nextExclude.delete(id);
    setFilters((prev) => ({ ...prev, scholars: Array.from(next), excludeScholars: Array.from(nextExclude) }));
  };

  const excludeScholar = (id: string) => {
    const next = new Set(filters.excludeScholars || []);
    next.add(id);
    const nextInclude = new Set(filters.scholars || []);
    nextInclude.delete(id);
    setFilters((prev) => ({ ...prev, excludeScholars: Array.from(next), scholars: Array.from(nextInclude) }));
  };

  const resetScholar = (id: string) => {
    const nextInclude = new Set(filters.scholars || []);
    const nextExclude = new Set(filters.excludeScholars || []);
    nextInclude.delete(id);
    nextExclude.delete(id);
    setFilters((prev) => ({ ...prev, scholars: Array.from(nextInclude), excludeScholars: Array.from(nextExclude) }));
  };

  const includeAll = () => {
    const ids = filteredScholars.map((scholar) => scholar.id);
    setFilters((prev) => ({ ...prev, scholars: ids, excludeScholars: [] }));
  };

  const excludeAll = () => {
    const ids = filteredScholars.map((scholar) => scholar.id);
    setFilters((prev) => ({ ...prev, scholars: [], excludeScholars: ids }));
  };

  const resetSelections = () => {
    setFilters((prev) => ({ ...prev, scholars: [], excludeScholars: [] }));
  };

  const revelationLabel =
    revelationType === 'Mekki'
      ? dashboard.mekki
      : revelationType === 'Medeni'
        ? dashboard.medeni
        : dashboard.unknownRevelation;
  const noValueLabel = t.notAvailable;
  const provenanceLabel = formatProvenance(provenance, lang, noValueLabel);

  const queryComposerNode = (
    <div className="space-y-4">
      <QueryComposer
        surahNumber={surahNumber}
        verseNumber={verseNumber}
        surahName={surahName || surahs.find((surah) => surah.number === surahNumber)?.nameTr || ''}
        revelationLabel={revelationLabel}
        surahOptions={surahs}
        filters={filters}
        availableFilters={availableFilters}
        filteredScholars={filteredScholars}
        scholarQuery={scholarQuery}
        includeIds={includeIds}
        excludeIds={excludeIds}
        loadingFilters={filtersQuery.isLoading}
        canAnalyze={canAnalyze}
        isAnalyzing={isAnalyzing}
        error={error}
        onSurahNumberChange={setSurahNumber}
        onVerseNumberChange={setVerseNumber}
        onFilterChange={setFilters}
        onScholarQueryChange={setScholarQuery}
        onInclude={includeScholar}
        onExclude={excludeScholar}
        onResetScholar={resetScholar}
        onIncludeAll={includeAll}
        onExcludeAll={excludeAll}
        onResetSelections={resetSelections}
        onAnalyze={() => void handleAnalyze()}
        labels={{
          verseTitle: dashboard.verseTitle,
          surahLabel: dashboard.surahLabel,
          verseLabel: dashboard.verseLabel,
          revelationType: dashboard.revelationType,
          filtersTitle: dashboard.filtersTitle,
          toneLabel: dashboard.toneLabel,
          intellectLabel: dashboard.intellectLabel,
          lengthLabel: dashboard.lengthLabel,
          languageLabel: dashboard.languageLabel,
          includeAll: dashboard.includeAll,
          excludeAll: dashboard.excludeAll,
          resetSelections: dashboard.resetSelections,
          scholarSearchPlaceholder: dashboard.scholarsSearchPlaceholder,
          tableScholar: dashboard.tableScholar,
          tableDeath: dashboard.tableDeath,
          tableSelection: dashboard.tableSelection,
          actionInclude: dashboard.actionInclude,
          actionExclude: dashboard.actionExclude,
          actionReset: dashboard.actionReset,
          analyze: dashboard.analyze,
          analyzing: dashboard.analyzing,
          quotaExhausted: dashboard.quotaExhausted,
          loadingFilters: t.loadingFilters,
        }}
      />

      <FilterFacets
        availableFilters={availableFilters}
        filters={filters}
        onChange={setFilters}
        getOptionLabel={(filterKey, value) => formatFacetValue(lang, filterKey, value)}
        labels={{
          title: t.facetTitle,
          periodCodes: t.facetPeriodCodes,
          madhabs: t.facetMadhabs,
          traditions: t.facetTraditions,
          sourceAccessibilities: t.facetSourceAccess,
          tafsirTypes: t.facetTafsirTypes,
          empty: t.facetEmpty,
        }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {status && <p className="ui-panel rounded-lg px-3 py-2 text-sm ui-muted">{status}</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <aside className="hidden xl:col-span-3 xl:block">{queryComposerNode}</aside>

        <main className="space-y-4 xl:col-span-6">
          <div className="ui-panel-strong px-4 py-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <RunActions
                canSave={Boolean(currentRunId)}
                saving={updateRunMutation.isPending}
                onSave={() => void saveCurrentRun()}
                onReplay={() => void handleAnalyze()}
                onCopyCitations={() => void copyCitations()}
                onShare={() => void shareRun()}
                labels={{
                  saveRun: t.saveRun,
                  savingRun: t.savingRun,
                  replay: t.replayRun,
                  copyCitations: t.copyCitations,
                  share: t.shareRun,
                }}
              />

              <button
                type="button"
                onClick={() => setMobileControlsOpen(true)}
                data-testid="mobile-open-controls-button"
                className="ui-button-secondary px-3 py-2 text-xs xl:hidden"
              >
                {t.openControls}
              </button>
            </div>

            <ResultStream
              title={dashboard.resultTitle}
              streamContent={streamContent}
              placeholder={dashboard.resultHelp}
              isAnalyzing={isAnalyzing}
              startedAt={startedAt}
              firstByteAt={firstByteAt}
              completedAt={completedAt}
              usage={usage}
              labels={{
                analyzing: dashboard.analyzing,
                perfTitle: dashboard.perfTitle,
                perfStart: dashboard.perfStart,
                perfFirstByte: dashboard.perfFirstByte,
                perfTotal: dashboard.perfTotal,
                perfTokens: dashboard.perfTokens,
              }}
            />
          </div>

          <div className="ui-panel-strong px-4 py-4 xl:hidden">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-button-ghost"
                data-active={mobileResultTab === 'result'}
                onClick={() => setMobileResultTab('result')}
              >
                {t.mobileResultTab}
              </button>
              <button
                type="button"
                className="ui-button-ghost"
                data-active={mobileResultTab === 'citations'}
                onClick={() => setMobileResultTab('citations')}
              >
                {t.mobileCitationsTab}
              </button>
              <button
                type="button"
                className="ui-button-ghost"
                data-active={mobileResultTab === 'snippets'}
                onClick={() => setMobileResultTab('snippets')}
              >
                {t.mobileSnippetsTab}
              </button>
            </div>

            {mobileResultTab === 'result' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="ui-kpi">
                  <div className="ui-muted text-xs">{dashboard.metricConfidence}</div>
                  <div className="text-xl font-semibold text-[var(--brand-dark)]">
                    {typeof confidence === 'number' ? `${Math.round(confidence * 100)}%` : noValueLabel}
                  </div>
                </div>
                <div className="ui-kpi">
                  <div className="ui-muted text-xs">{dashboard.metricProvenance}</div>
                  <div className="text-base font-medium text-[var(--text-strong)]">{provenanceLabel}</div>
                </div>
                <div className="ui-kpi">
                  <div className="ui-muted text-xs">{dashboard.metricCitations}</div>
                  <div className="text-base font-medium text-[var(--text-strong)]">{citations.length}</div>
                </div>
              </div>
            )}

            {mobileResultTab === 'citations' && (
              <CitationPanel
                title={dashboard.academicCitationsTitle}
                empty={t.emptyCitations}
                citations={citations}
                labels={{ volumeShort: dashboard.volumeShort, pageShort: dashboard.pageShort }}
              />
            )}

            {mobileResultTab === 'snippets' && (
              <SourceSnippetPanel title={dashboard.snippetsTitle} empty={t.emptySnippets} excerpts={sourceExcerpts} />
            )}
          </div>
        </main>

        <aside className="hidden space-y-4 xl:col-span-3 xl:block">
          <div className="grid grid-cols-1 gap-3">
            <div className="ui-kpi">
              <div className="ui-muted text-xs">{dashboard.metricConfidence}</div>
              <div className="text-xl font-semibold text-[var(--brand-dark)]">
                {typeof confidence === 'number' ? `${Math.round(confidence * 100)}%` : noValueLabel}
              </div>
            </div>
            <div className="ui-kpi">
              <div className="ui-muted text-xs">{dashboard.metricProvenance}</div>
              <div className="text-base font-medium text-[var(--text-strong)]">{provenanceLabel}</div>
            </div>
            <div className="ui-kpi">
              <div className="ui-muted text-xs">{dashboard.metricCitations}</div>
              <div className="text-base font-medium text-[var(--text-strong)]">{citations.length}</div>
            </div>
          </div>

          <SourceSnippetPanel title={dashboard.snippetsTitle} empty={t.emptySnippets} excerpts={sourceExcerpts} />
          <CitationPanel
            title={dashboard.academicCitationsTitle}
            empty={t.emptyCitations}
            citations={citations}
            labels={{ volumeShort: dashboard.volumeShort, pageShort: dashboard.pageShort }}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-soft)] bg-white/95 px-3 py-2 shadow-lg xl:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileControlsOpen(true)}
            data-testid="mobile-open-controls-bottom-button"
            className="ui-button-secondary flex-1 px-3 py-2 text-sm"
          >
            {t.openControls}
          </button>
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!canAnalyze}
            data-testid="mobile-analyze-button"
            className="ui-button flex-1 px-3 py-2 text-sm"
          >
            {isAnalyzing ? dashboard.analyzing : dashboard.analyze}
          </button>
          <button
            type="button"
            onClick={() => void saveCurrentRun()}
            disabled={!currentRunId || updateRunMutation.isPending}
            data-testid="mobile-save-run-button"
            className="ui-button-secondary flex-1 px-3 py-2 text-sm"
          >
            {t.saveRun}
          </button>
        </div>
      </div>

      {mobileControlsOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 xl:hidden" onClick={() => setMobileControlsOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-2xl border border-[var(--border-soft)] bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="ui-title text-lg font-semibold">{t.mobileControlsTitle}</h2>
              <button type="button" className="ui-button-secondary px-3 py-1.5 text-xs" onClick={() => setMobileControlsOpen(false)}>
                {t.closeControls}
              </button>
            </div>
            {queryComposerNode}
          </div>
        </div>
      )}

      <section className="ui-panel-strong overflow-hidden">
        <div className="space-y-2 px-4 py-4 sm:px-5">
          <h3 className="ui-title text-base font-semibold">{t.comparisonPlaceholderTitle}</h3>
          <p className="ui-muted text-sm">{t.comparisonPlaceholderText}</p>
          <p className="ui-muted text-xs">
            {t.primaryRunLabel}: {comparisonRuns.primaryRun ? comparisonRuns.primaryRun.runId : noValueLabel} · {t.secondaryRunLabel}:{' '}
            {comparisonRuns.secondaryRun ? comparisonRuns.secondaryRun.runId : noValueLabel}
          </p>
        </div>
      </section>
    </div>
  );
}
