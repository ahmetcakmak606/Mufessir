"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LangContext";
import { locales } from "@/locales";
import { surahs } from "@/lib/surahs";
import { tokenStorage } from "@/lib/auth";
import {
  type Citation,
  type ComparisonRunModel,
  type ProvenanceIndicator,
  type RunDraftFilters,
  type ScholarOption,
  type SourceExcerpt,
  fetchVerseByNumbers,
  fetchScholarsForVerse,
  normalizeTafseerResponseToRun,
  startTafseerStream,
} from "@/lib/tafseer";
import { formatFacetValue, formatProvenance } from "@/lib/metadata-labels";
import { useFiltersQuery } from "@/hooks/use-filters-query";
import {
  useRunDetailQuery,
  useUpdateRunMutation,
} from "@/hooks/use-run-history";
import { ResultStream } from "@/components/dashboard/ResultStream";
import { RunActions } from "@/components/dashboard/RunActions";
import { QueryBar } from "@/components/dashboard/QueryBar";
import { AyahPanel } from "@/components/dashboard/AyahPanel";
import { SourcesPanel } from "@/components/dashboard/SourcesPanel";
import {
  SettingsDrawer,
  lengthStepFor,
  type SettingsTab,
} from "@/components/dashboard/SettingsDrawer";

const defaultFilters: RunDraftFilters = {
  language: "Turkish",
  methodTags: [],
  responseLength: 6,
};

export default function QueryWorkspacePage() {
  const { user, refreshUser } = useAuth();
  const { lang } = useLang();
  const t = locales[lang].dashboardQuery;
  const dashboard = locales[lang].dashboard;
  const q = locales[lang].queryUi;
  const searchParams = useSearchParams();

  const runIdParam = searchParams.get("runId") || undefined;
  const shouldReplay = searchParams.get("replay") === "1";

  const [surahNumber, setSurahNumber] = useState(1);
  const [verseNumber, setVerseNumber] = useState(1);
  const [endVerseNumber, setEndVerseNumber] = useState(1);
  const [surahName, setSurahName] = useState("");
  const [revelationType, setRevelationType] = useState<
    "Mekki" | "Medeni" | "UNKNOWN"
  >("UNKNOWN");

  const [filters, setFilters] = useState<RunDraftFilters>(defaultFilters);
  const [scholarQuery, setScholarQuery] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [arabicTafsir, setArabicTafsir] = useState<string | undefined>();
  const [turkishTafsir, setTurkishTafsir] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [firstByteAt, setFirstByteAt] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [usage, setUsage] = useState<{
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null>(null);

  const [confidence, setConfidence] = useState<number | null>(null);
  const [provenance, setProvenance] = useState<ProvenanceIndicator | null>(
    null,
  );
  const [noTafsirMessage, setNoTafsirMessage] = useState<string | null>(null);
  const [missingScholars, setMissingScholars] = useState<string[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [sourceExcerpts, setSourceExcerpts] = useState<SourceExcerpt[]>([]);
  const [citationKey, setCitationKey] = useState<string | null>(null);
  const [verseTextTr, setVerseTextTr] = useState<string | null>(null);
  const [verseScholarIds, setVerseScholarIds] = useState<Set<string> | null>(null);

  const [comparisonRuns, setComparisonRuns] = useState<ComparisonRunModel>({
    primaryRun: null,
    secondaryRun: null,
  });

  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<SettingsTab>("basics");

  const hydratedRunRef = useRef<string | null>(null);
  const replayedRef = useRef(false);

  const filtersQuery = useFiltersQuery();
  const availableFilters = filtersQuery.data || null;
  const runDetailQuery = useRunDetailQuery(runIdParam);
  const updateRunMutation = useUpdateRunMutation();

  const includeIds = useMemo(
    () => new Set(filters.scholars || []),
    [filters.scholars],
  );
  const excludeIds = useMemo(
    () => new Set(filters.excludeScholars || []),
    [filters.excludeScholars],
  );

  useEffect(() => {
    if (!availableFilters) return;
    setFilters((prev) => {
      if (Array.isArray(prev.scholars)) return prev;
      return {
        ...prev,
        scholars: availableFilters.scholars.map((s) => String(s.id)),
        excludeScholars: [],
      };
    });
  }, [availableFilters]);

  const filteredScholars = useMemo<ScholarOption[]>(() => {
    let items = (availableFilters?.scholars as ScholarOption[]) || [];
    // Restrict to scholars who have tafsirs for the selected verse/range
    if (verseScholarIds !== null) {
      items = items.filter((scholar) => verseScholarIds.has(String(scholar.id)));
    }
    if (scholarQuery.trim()) {
      const q = scholarQuery.toLowerCase();
      items = items.filter((scholar) => {
        const name = scholar.nameTr || scholar.nameEn || "";
        return name.toLowerCase().includes(q);
      });
    }
    if (filters.periodCodes?.length) {
      items = items.filter(
        (scholar) =>
          scholar.periodCode &&
          filters.periodCodes?.includes(scholar.periodCode),
      );
    }
    if (filters.madhabs?.length) {
      items = items.filter(
        (scholar) =>
          scholar.madhab && filters.madhabs?.includes(scholar.madhab),
      );
    }
    if (filters.tafsirTypes?.length) {
      items = items.filter((scholar) =>
        [scholar.tafsirType1, scholar.tafsirType2].some(
          (typeValue) =>
            typeof typeValue === "string" &&
            filters.tafsirTypes?.includes(typeValue),
        ),
      );
    }
    return items;
  }, [availableFilters, scholarQuery, filters, verseScholarIds]);

  const canAnalyze = Boolean(
    user && (user.dailyQuota ?? 0) > 0 && !isAnalyzing,
  );

  const resolveVerse = useCallback(async () => {
    const verse = await fetchVerseByNumbers(surahNumber, verseNumber);
    setSurahName(verse.surahName);
    const meta = surahs.find((surah) => surah.number === surahNumber);
    setRevelationType(meta?.revelation || "UNKNOWN");
    return verse;
  }, [surahNumber, verseNumber]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const verse = await fetchVerseByNumbers(surahNumber, verseNumber);
        if (cancelled) return;
        setSurahName(verse.surahName);
        const meta = surahs.find((surah) => surah.number === surahNumber);
        setRevelationType(meta?.revelation || "UNKNOWN");
      } catch {
        if (cancelled) return;
        setSurahName("");
        setRevelationType("UNKNOWN");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [surahNumber, verseNumber]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Query the full surah so the scholar list shows everyone who has
        // any tafsir for that surah, not just the selected starting verse.
        const surahMeta = surahs.find((s) => s.number === surahNumber);
        const totalAyahs = surahMeta?.totalAyahs ?? 300;
        const ids = await fetchScholarsForVerse(surahNumber, 1, totalAyahs);
        if (cancelled) return;
        setVerseScholarIds(new Set(ids));
      } catch {
        if (cancelled) return;
        setVerseScholarIds(null);
      }
    })();
    return () => { cancelled = true; };
  }, [surahNumber]);

  useEffect(() => {
    const detail = runDetailQuery.data;
    if (!detail || hydratedRunRef.current === detail.runId) return;

    hydratedRunRef.current = detail.runId;
    setCurrentRunId(detail.runId);
    setSurahNumber(detail.verse.surahNumber);
    setVerseNumber(detail.verse.verseNumber);
    setSurahName(detail.verse.surahName);
    setFilters({ ...defaultFilters, ...(detail.filters || {}) });

    setStreamContent(detail.aiResponse || "");
    setArabicTafsir(detail.arabicTafsir);
    setTurkishTafsir(detail.turkishTafsir);
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
      },
    );

    setComparisonRuns((prev) => ({ ...prev, primaryRun: run }));
  }, [runDetailQuery.data]);

  const handleAnalyze = useCallback(async () => {
    if (!user) return;

    setError("");
    setStatus("");
    setIsAnalyzing(true);
    setStreamContent("");
    setArabicTafsir(undefined);
    setTurkishTafsir(undefined);
    setNoTafsirMessage(null);
    setMissingScholars([]);
    setUsage(null);
    setStartedAt(null);
    setFirstByteAt(null);
    setCompletedAt(null);
    setConfidence(null);
    setProvenance(null);
    setCitations([]);
    setSourceExcerpts([]);
    setCitationKey(null);
    setVerseTextTr(null);

    let accumulated = "";

    try {
      // Always resolve verse from the current selector values to avoid
      // sending a stale verseId when user quickly changes surah/ayah.
      const verse = await resolveVerse();
      const token = tokenStorage.get();
      if (!token) throw new Error(dashboard.notAuthenticated);

      const isRange = endVerseNumber > verseNumber;
      await startTafseerStream(
        {
          verseId: isRange ? undefined : verse.id,
          verseRange: isRange
            ? {
                surahNumber: verse.surahNumber,
                startVerse: verse.verseNumber,
                endVerse: endVerseNumber,
              }
            : undefined,
          filters: {
            ...filters,
            language:
              filters.language || (lang === "tr" ? "Turkish" : "English"),
          },
          stream: true,
        },
        token,
        (evt) => {
          if (evt.type === "start") {
            setStartedAt(performance.now());
            if (evt.runId || evt.searchId) {
              setCurrentRunId(evt.runId || evt.searchId || null);
            }
          }

          if (evt.type === "chunk" && evt.content) {
            accumulated += evt.content;
            setFirstByteAt((prev) => prev ?? performance.now());
            setStreamContent((prev) => prev + evt.content);
          }

          if (evt.type === "error") {
            setError(evt.error || dashboard.streamingError);
          }

          if (evt.type === "complete") {
            void refreshUser();
            setCompletedAt(performance.now());
            setUsage(evt.usage || null);

            const nextRunId = evt.runId || evt.searchId || currentRunId || null;
            setCurrentRunId(nextRunId);
            setConfidence(
              typeof evt.confidence === "number" ? evt.confidence : null,
            );
            setProvenance(evt.provenance || null);
            setCitations(Array.isArray(evt.citations) ? evt.citations : []);
            setSourceExcerpts(
              Array.isArray(evt.sourceExcerpts) ? evt.sourceExcerpts : [],
            );

            // Store Arabic and Turkish tafsir for language toggle
            if (evt.arabicTafsir) {
              setArabicTafsir(evt.arabicTafsir);
            }
            if (evt.turkishTafsir) {
              setTurkishTafsir(evt.turkishTafsir);
            }
            if (evt.citationKey) {
              setCitationKey(evt.citationKey);
            }
            if (evt.verseTextTr) {
              setVerseTextTr(evt.verseTextTr);
            }

            // Handle case where selected scholars have no tafsir for this verse
            if (evt.noTafsirForSelectedScholars) {
              setNoTafsirMessage(
                evt.noTafsirMessage ||
                  "Seçilen alimlerin bu ayet için tefsiri bulunmamaktadır.",
              );
              setMissingScholars(evt.missingScholarNames || []);
              setStreamContent("");
              setArabicTafsir(undefined);
              setTurkishTafsir(undefined);
            } else {
              setNoTafsirMessage(null);
              setMissingScholars([]);
            }

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
              },
            );

            setComparisonRuns((prev) => ({ ...prev, primaryRun: run }));
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : dashboard.analysisFailed);
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    user,
    resolveVerse,
    endVerseNumber,
    verseNumber,
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
      await updateRunMutation.mutateAsync({
        runId: currentRunId,
        payload: { starred: true },
      });
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
          citation.volume
            ? `${dashboard.volumeShort} ${citation.volume}`
            : null,
          citation.page ? `${dashboard.pageShort} ${citation.page}` : null,
          citation.edition || null,
        ]
          .filter(Boolean)
          .join(" · ");
        return `${citation.scholarName} — ${citation.sourceTitle}${extras ? ` (${extras})` : ""}`;
      })
      .join("\n");

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

  const toggleScholar = (id: string, include: boolean) => {
    setFilters((prev) => {
      const nextInclude = new Set(prev.scholars || []);
      const nextExclude = new Set(prev.excludeScholars || []);
      if (include) {
        nextInclude.add(id);
        nextExclude.delete(id);
      } else {
        nextInclude.delete(id);
        nextExclude.add(id);
      }
      return {
        ...prev,
        scholars: Array.from(nextInclude),
        excludeScholars: Array.from(nextExclude),
      };
    });
  };

  const includeAll = () => {
    const ids = filteredScholars.map((scholar) => String(scholar.id));
    setFilters((prev) => ({ ...prev, scholars: ids, excludeScholars: [] }));
  };

  const excludeAll = () => {
    const ids = filteredScholars.map((scholar) => String(scholar.id));
    setFilters((prev) => ({ ...prev, scholars: [], excludeScholars: ids }));
  };

  const resetFilters = () => {
    setScholarQuery("");
    setFilters({
      ...defaultFilters,
      scholars: (availableFilters?.scholars || []).map((s) => String(s.id)),
      excludeScholars: [],
    });
  };

  const openDrawer = (tab: SettingsTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const surahMeta = surahs.find((surah) => surah.number === surahNumber);
  const revelationLabel =
    revelationType === "Mekki"
      ? dashboard.mekki
      : revelationType === "Medeni"
        ? dashboard.medeni
        : dashboard.unknownRevelation;
  const noValueLabel = t.notAvailable;
  const provenanceLabel = formatProvenance(provenance, lang, noValueLabel);

  // Seçili müfessir sayısı yalnızca bu surede yorumu olanlar üzerinden okunur.
  const visibleScholarIds = (availableFilters?.scholars || [])
    .map((s) => String(s.id))
    .filter((id) => verseScholarIds === null || verseScholarIds.has(id));
  const selectedVisible = visibleScholarIds.filter((id) => includeIds.has(id));
  const scholarSummary =
    visibleScholarIds.length > 0 &&
    selectedVisible.length === visibleScholarIds.length
      ? `${q.scholarsAll} (${visibleScholarIds.length})`
      : `${selectedVisible.length} ${q.scholarsSelected}`;
  const settingsSummary = q[lengthStepFor(filters.responseLength).key];

  const activeFacets: Array<{ key: keyof RunDraftFilters; label: string }> = [
    ...(filters.periodCodes || []).map((v) => ({
      key: "periodCodes" as const,
      label: formatFacetValue(lang, "periodCodes", v),
    })),
    ...(filters.madhabs || []).map((v) => ({
      key: "madhabs" as const,
      label: formatFacetValue(lang, "madhabs", v),
    })),
    ...(filters.traditions || []).map((v) => ({
      key: "traditions" as const,
      label: formatFacetValue(lang, "traditions", v),
    })),
    ...(filters.tafsirTypes || []).map((v) => ({
      key: "tafsirTypes" as const,
      label: formatFacetValue(lang, "tafsirTypes", v),
    })),
  ];
  const activeFacetLabels = Array.from(
    new Set(activeFacets.map((f) => f.label.replace(/\s*\/\s*/g, " / "))),
  );

  const surahTitle = surahMeta?.nameTr || surahName;
  const ayahHeading = `${surahTitle} ${surahNumber} / ${verseNumber}${
    endVerseNumber > verseNumber ? `–${endVerseNumber}` : ""
  } · ${revelationLabel}`;

  const timing =
    startedAt && completedAt
      ? `${firstByteAt ? Math.max(0, Math.round(firstByteAt - startedAt)) : "—"} ms / ${Math.max(0, Math.round(completedAt - startedAt))} ms`
      : noValueLabel;
  const hasResult = Boolean(streamContent || turkishTafsir || arabicTafsir);

  return (
    <div className="pb-24 sm:pb-0">
      <QueryBar
        surahNumber={surahNumber}
        verseNumber={verseNumber}
        endVerseNumber={endVerseNumber}
        surahOptions={surahs}
        scholarSummary={scholarSummary}
        settingsSummary={settingsSummary}
        canAnalyze={canAnalyze && !filtersQuery.isLoading}
        analyzing={isAnalyzing}
        onSurahChange={(v) => {
          setSurahNumber(v);
          setVerseNumber(1);
          setEndVerseNumber(1);
        }}
        onVerseChange={setVerseNumber}
        onEndVerseChange={setEndVerseNumber}
        onOpenScholars={() => openDrawer("scholars")}
        onOpenSettings={() => openDrawer("basics")}
        onAnalyze={() => void handleAnalyze()}
        labels={{
          surah: q.surah,
          verses: q.verses,
          startVerse: dashboard.startVerseLabel,
          endVerse: dashboard.endVerseLabel,
          scholars: q.scholarsButton,
          settings: q.settingsButton,
          interpret: q.interpret,
          interpreting: q.interpreting,
          quotaExhausted: dashboard.quotaExhausted,
        }}
      />

      {activeFacetLabels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.82rem] text-[var(--text-muted)]">
          <span>{q.activeFilters}:</span>
          {activeFacetLabels.map((label) => (
            <button
              key={label}
              type="button"
              className="ui-chip py-0 text-[0.8rem]"
              onClick={() => openDrawer("schools")}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="ui-link ml-1 text-[0.82rem] underline underline-offset-4"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                periodCodes: [],
                madhabs: [],
                traditions: [],
                tafsirTypes: [],
              }))
            }
          >
            {q.clearFilters}
          </button>
        </div>
      )}

      {(error || status) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-3 rounded-[0.5rem] px-3 py-2 text-sm ${error ? "ui-danger" : "ui-muted"}`}
        >
          {error || status}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0 space-y-9">
          <AyahPanel
            surahNumber={surahNumber}
            startVerse={verseNumber}
            endVerse={endVerseNumber}
            heading={ayahHeading}
            labels={{
              mealShow: q.mealShow,
              mealHide: q.mealHide,
              mealSource: q.mealSource,
              loading: q.verseLoading,
            }}
          />

          <div>
            <ResultStream
              title={q.commentaryTitle}
              streamContent={streamContent}
              arabicTafsir={arabicTafsir}
              turkishTafsir={turkishTafsir}
              placeholder={q.emptyState}
              isAnalyzing={isAnalyzing}
              noTafsirMessage={noTafsirMessage}
              missingScholars={missingScholars}
              labels={{
                analyzing: q.interpreting,
                arabic: dashboard.arabic || "Arabic",
                turkish: dashboard.turkish || "Turkish",
                noTafsirTitle: q.noTafsirTitle,
                missingScholars: q.missingScholars,
              }}
            />

            {(hasResult || currentRunId) && (
              <div className="mt-4 border-t border-[var(--border-soft)] pt-3.5">
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
              </div>
            )}

            {(citationKey || provenance || usage || completedAt) && (
              <details className="mt-6 text-[0.82rem] text-[var(--text-muted)]">
                <summary className="cursor-pointer">{q.techDetails}</summary>
                <dl className="mt-2.5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 tabular-nums">
                  {citationKey && (
                    <>
                      <dt>{q.techCitationKey}</dt>
                      <dd className="flex items-center gap-2 text-[var(--ink-soft)]">
                        <code>{citationKey}</code>
                        <button
                          type="button"
                          className="ui-link underline underline-offset-2"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(citationKey)
                              .catch(() => undefined)
                          }
                        >
                          {q.copy}
                        </button>
                      </dd>
                    </>
                  )}
                  <dt>{q.techSourceMode}</dt>
                  <dd className="text-[var(--ink-soft)]">{provenanceLabel}</dd>
                  <dt>{q.techModelScore}</dt>
                  <dd className="text-[var(--ink-soft)]">
                    {typeof confidence === "number"
                      ? confidence.toFixed(2)
                      : noValueLabel}
                  </dd>
                  <dt>{q.techTiming}</dt>
                  <dd className="text-[var(--ink-soft)]">{timing}</dd>
                  <dt>{q.techTokens}</dt>
                  <dd className="text-[var(--ink-soft)]">
                    {usage?.totalTokens ?? noValueLabel}
                  </dd>
                </dl>
              </details>
            )}
          </div>
        </main>

        <aside className="min-w-0">
          <SourcesPanel
            citations={citations}
            excerpts={sourceExcerpts}
            lang={lang}
            labels={{
              title: q.sourcesTitle,
              summary: q.sourcesSummary,
              empty: q.sourcesEmpty,
              showAll: q.showAllSources,
              showFewer: q.showFewerSources,
              more: q.moreSources,
              noExcerpt: q.noExcerpt,
              volumeShort: dashboard.volumeShort,
              pageShort: dashboard.pageShort,
            }}
          />
        </aside>
      </div>

      <section className="mt-12 flex flex-wrap items-baseline justify-between gap-3 border-t border-[var(--border-soft)] pt-4 text-sm text-[var(--text-muted)]">
        <span>
          <strong className="font-semibold text-[var(--ink-soft)]">
            {q.compareTitle}
          </strong>{" "}
          · {q.compareText}
        </span>
      </section>

      {/* Telefonda sabit alt çubuk: sorgu çubuğundaki Yorumla düğmesi burada gizlenir. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-soft)] bg-[var(--sheet)] px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] sm:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={!canAnalyze}
            data-testid="mobile-analyze-button"
            className="ui-button flex-[2] px-3 py-2.5 text-sm"
          >
            {isAnalyzing ? q.interpreting : q.interpret}
          </button>
          <button
            type="button"
            onClick={() => void saveCurrentRun()}
            disabled={!currentRunId || updateRunMutation.isPending}
            data-testid="mobile-save-run-button"
            className="ui-button-secondary flex-1 px-3 py-2.5 text-sm"
          >
            {t.saveRun}
          </button>
        </div>
      </div>

      <SettingsDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={closeDrawer}
        filters={filters}
        onFilterChange={setFilters}
        availableFilters={availableFilters}
        filteredScholars={filteredScholars}
        includeIds={includeIds}
        scholarQuery={scholarQuery}
        onScholarQueryChange={setScholarQuery}
        onToggleScholar={toggleScholar}
        onIncludeAll={includeAll}
        onExcludeAll={excludeAll}
        onReset={resetFilters}
        getOptionLabel={(filterKey, value) =>
          formatFacetValue(lang, filterKey, value)
        }
        labels={{
          drawerTitle: q.drawerTitle,
          close: q.close,
          apply: q.apply,
          reset: q.reset,
          tabBasics: q.tabBasics,
          tabScholars: q.tabScholars,
          tabSchools: q.tabSchools,
          lengthLabel: q.lengthLabel,
          lengthShort: q.lengthShort,
          lengthMedium: q.lengthMedium,
          lengthLong: q.lengthLong,
          answerLanguage: q.answerLanguage,
          methodLabel: q.methodLabel,
          methodHelp: q.methodHelp,
          scholarsHelp: q.scholarsHelp,
          selectAll: q.selectAll,
          selectNone: q.selectNone,
          schoolsHelp: q.schoolsHelp,
          deathShort: q.deathShort,
          noScholarsMatch: q.noScholarsMatch,
          searchPlaceholder: dashboard.scholarsSearchPlaceholder,
          periodCodes: t.facetPeriodCodes,
          madhabs: t.facetMadhabs,
          traditions: t.facetTraditions,
          tafsirTypes: t.facetTafsirTypes,
          facetEmpty: t.facetEmpty,
          langTurkish: dashboard.langTurkish,
          langEnglish: dashboard.langEnglish,
          langArabic: dashboard.langArabic,
        }}
      />
    </div>
  );
}
