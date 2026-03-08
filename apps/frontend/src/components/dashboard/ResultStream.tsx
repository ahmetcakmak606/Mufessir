'use client';

interface ResultStreamProps {
  title: string;
  streamContent: string;
  placeholder: string;
  isAnalyzing: boolean;
  startedAt: number | null;
  firstByteAt: number | null;
  completedAt: number | null;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  labels: {
    analyzing: string;
    perfTitle: string;
    perfStart: string;
    perfFirstByte: string;
    perfTotal: string;
    perfTokens: string;
  };
}

export function ResultStream({
  title,
  streamContent,
  placeholder,
  isAnalyzing,
  startedAt,
  firstByteAt,
  completedAt,
  usage,
  labels,
}: ResultStreamProps) {
  return (
    <section className="ui-panel-strong overflow-hidden">
      <div className="space-y-3 px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="ui-title text-lg font-semibold">{title}</h3>
          {isAnalyzing && <span className="ui-badge">{labels.analyzing}</span>}
        </div>

        <div className="ui-kpi ui-muted flex flex-wrap gap-4 text-xs">
          <div><span className="font-semibold">{labels.perfTitle}:</span></div>
          <div>{labels.perfStart}: {startedAt ? '✓' : '—'}</div>
          <div>{labels.perfFirstByte}: {startedAt && firstByteAt ? `${Math.max(0, Math.round(firstByteAt - startedAt))} ms` : '—'}</div>
          <div>{labels.perfTotal}: {startedAt && completedAt ? `${Math.max(0, Math.round(completedAt - startedAt))} ms` : '—'}</div>
          <div>{labels.perfTokens}: {usage?.totalTokens ?? '—'}</div>
        </div>

        <div className="ui-panel min-h-64 whitespace-pre-wrap p-4 text-sm leading-relaxed text-[var(--text-strong)] sm:text-[0.95rem]">
          {streamContent ? streamContent : <p className="ui-muted">{placeholder}</p>}
        </div>
      </div>
    </section>
  );
}
