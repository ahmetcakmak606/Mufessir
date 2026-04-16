"use client";

import { useLang } from "@/context/LangContext";
import { formatScholarName } from "@/lib/metadata-labels";
import type { ScholarOption } from "@/lib/tafseer";

interface ScholarGroupPanelProps {
  filteredScholars: ScholarOption[];
  includeIds: Set<string>;
  excludeIds: Set<string>;
  onInclude: (id: string) => void;
  onExclude: (id: string) => void;
  onResetScholar: (id: string) => void;
  onIncludePeriod: (periodCode: string) => void;
  onExcludePeriod: (periodCode: string) => void;
  labels: {
    include: string;
    exclude: string;
    reset: string;
    includeAll: string;
    excludeAll: string;
    resetAll: string;
  };
}

type PeriodCode = string;

const PERIOD_ORDER: PeriodCode[] = [
  "FOUNDATION",
  "CLASSICAL_EARLY",
  "CLASSICAL_MATURE",
  "POST_CLASSICAL",
  "MODERN",
  "CONTEMPORARY",
  "UNKNOWN",
];

const PERIOD_LABELS_TR: Record<PeriodCode, string> = {
  FOUNDATION: "Kurucu Dönem (1-3 yy)",
  CLASSICAL_EARLY: "Erken Klasik (4-5 yy)",
  CLASSICAL_MATURE: "Olgun Klasik (6-7 yy)",
  POST_CLASSICAL: "Geç Klasik (8-10 yy)",
  MODERN: "Modern (11-13 yy)",
  CONTEMPORARY: "Çağdaş (14+ yy)",
  UNKNOWN: "Bilinmiyor",
};

const PERIOD_LABELS_EN: Record<PeriodCode, string> = {
  FOUNDATION: "Foundational (1st-3rd c.)",
  CLASSICAL_EARLY: "Early Classical (4th-5th c.)",
  CLASSICAL_MATURE: "Mature Classical (6th-7th c.)",
  POST_CLASSICAL: "Post-Classical (8th-10th c.)",
  MODERN: "Modern (11th-13th c.)",
  CONTEMPORARY: "Contemporary (14th c.+)",
  UNKNOWN: "Unknown",
};

function groupScholars(
  scholars: ScholarOption[],
): Map<PeriodCode, ScholarOption[]> {
  const groups = new Map<PeriodCode, ScholarOption[]>();
  for (const scholar of scholars) {
    const period = scholar.periodCode || "UNKNOWN";
    if (!groups.has(period)) {
      groups.set(period, []);
    }
    groups.get(period)!.push(scholar);
  }
  return groups;
}

type PeriodStatus = "all-included" | "all-excluded" | "partial" | "none";

function getPeriodStatus(
  scholars: ScholarOption[],
  includeIds: Set<string>,
  excludeIds: Set<string>,
): PeriodStatus {
  const included = scholars.filter((s) => includeIds.has(String(s.id))).length;
  const excluded = scholars.filter((s) => excludeIds.has(String(s.id))).length;
  const total = scholars.length;

  if (total === 0) return "none";
  if (included === total) return "all-included";
  if (excluded === total) return "all-excluded";
  if (included > 0 || excluded > 0) return "partial";
  return "none";
}

export function ScholarGroupPanel({
  filteredScholars,
  includeIds,
  excludeIds,
  onInclude,
  onExclude,
  onResetScholar,
  onIncludePeriod,
  onExcludePeriod,
  labels,
}: ScholarGroupPanelProps) {
  const { lang } = useLang();
  const groups = groupScholars(filteredScholars);

  const sortedPeriods = Array.from(groups.keys()).sort((a, b) => {
    const aIdx = PERIOD_ORDER.indexOf(a);
    const bIdx = PERIOD_ORDER.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const periodLabels = lang === "tr" ? PERIOD_LABELS_TR : PERIOD_LABELS_EN;

  const getStatusColor = (
    status: PeriodStatus,
    type: "include" | "exclude",
  ): string => {
    if (type === "include") {
      if (status === "all-included") return "text-emerald-600";
      if (status === "partial") return "text-emerald-400";
      return "text-[var(--text-muted)] hover:text-[var(--brand-dark)]";
    }
    if (type === "exclude") {
      if (status === "all-excluded") return "text-red-600";
      if (status === "partial") return "text-red-400";
      return "text-[var(--text-muted)] hover:text-red-600";
    }
    return "text-[var(--text-muted)]";
  };

  return (
    <div className="space-y-1 max-h-[320px] overflow-y-auto rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-1">
      {sortedPeriods.map((period) => {
        const scholarsInPeriod = groups.get(period) || [];
        const periodLabel = periodLabels[period] || period;
        const periodStatus = getPeriodStatus(
          scholarsInPeriod,
          includeIds,
          excludeIds,
        );

        return (
          <details key={period} className="group">
            <summary className="flex cursor-pointer items-center justify-between rounded-md bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] selection:bg-[var(--brand-light)]">
              <div className="flex items-center gap-2">
                <span>{periodLabel}</span>
                <span className="rounded-full bg-[var(--brand-light)] px-1.5 py-0.5 text-xs text-[var(--brand-dark)]">
                  {scholarsInPeriod.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onIncludePeriod(period);
                  }}
                  className={`rounded p-1 ${getStatusColor(periodStatus, "include")}`}
                  title={labels.includeAll}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onExcludePeriod(period);
                  }}
                  className={`rounded p-1 ${getStatusColor(periodStatus, "exclude")}`}
                  title={labels.excludeAll}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <svg
                  className="h-4 w-4 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </summary>
            <div className="mt-1 space-y-0.5 pl-1">
              {scholarsInPeriod.map((scholar) => {
                const scholarId = String(scholar.id);
                const included = includeIds.has(scholarId);
                const excluded = excludeIds.has(scholarId);
                const score = scholar.reputationScore;
                return (
                  <div
                    key={scholar.id}
                    className={`flex items-center justify-between rounded px-2 py-2 ${
                      included
                        ? "bg-emerald-100 border border-emerald-300"
                        : excluded
                          ? "bg-red-50 border border-red-200"
                          : "hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {formatScholarName(
                            scholar.nameTr || scholar.nameEn || "",
                          )}
                        </p>
                        {score !== null && score !== undefined && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              score >= 85
                                ? "bg-amber-100 text-amber-800"
                                : score >= 70
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {score.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {scholar.madhab && (
                          <span className="text-xs text-[var(--text-muted)] capitalize">
                            {scholar.madhab}
                          </span>
                        )}
                        {scholar.tafsirType1 && (
                          <>
                            <span className="text-xs text-[var(--border-strong)]">
                              ·
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {scholar.tafsirType1}
                            </span>
                          </>
                        )}
                        {scholar.deathYear && (
                          <>
                            <span className="text-xs text-[var(--border-strong)]">
                              ·
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {scholar.deathYear}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => onInclude(scholarId)}
                        className={`rounded p-1 ${
                          included
                            ? "text-[var(--brand)]"
                            : "text-[var(--text-muted)] hover:text-[var(--brand-dark)]"
                        }`}
                        title={labels.include}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onExclude(scholarId)}
                        className={`rounded p-1 ${
                          excluded
                            ? "text-red-600"
                            : "text-[var(--text-muted)] hover:text-red-600"
                        }`}
                        title={labels.exclude}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                      {(included || excluded) && (
                        <button
                          type="button"
                          onClick={() => onResetScholar(scholarId)}
                          className="ml-1 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                          title={labels.reset}
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H4.582"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
