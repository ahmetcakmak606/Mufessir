import { API_BASE_URL, apiRequest } from "@/lib/api-client";

export interface Filters {
  scholars?: string[];
  excludeScholars?: string[];
  methodTags?: string[];
  language?: string;
  responseLength?: number;
  periodCodes?: string[];
  madhabs?: string[];
  traditions?: string[];
  sourceAccessibilities?: string[];
  tafsirTypes?: string[];
}

export type RunDraftFilters = Filters;

export interface ScholarOption {
  id: string | number;
  nameEn: string;
  nameTr: string | null;
  nameAr: string | null;
  nameLong: string | null;
  birthYear: number | null;
  deathYear: number | null;
  deathHijri: number | null;
  century: number;
  madhab: string | null;
  period: string | null;
  periodCode: string | null;
  environment: string | null;
  originCountry: string | null;
  reputationScore: number | null;
  bookId: string | null;
  tafsirType1: string | null;
  tafsirType2: string | null;
  bookTafsir: string | null;
  deathMiladi: number | null;
}

export interface FiltersResponse {
  scholars: ScholarOption[];
  filterOptions: {
    centuries: number[];
    madhabs: string[];
    periods: string[];
    periodCodes: string[];
    environments: string[];
    countries: string[];
    sourceAccessibilities: string[];
    traditions: string[];
    tafsirTypes: string[];
    birthYearRange: { min: number; max: number } | null;
    deathYearRange: { min: number; max: number } | null;
    deathHijriRange: { min: number; max: number } | null;
  };
  toneRange: { min: number; max: number; description: string };
  intellectRange: { min: number; max: number; description: string };
  supportedLanguages: string[];
}

export interface Citation {
  scholarId: string;
  scholarName: string;
  sourceType: string;
  sourceTitle: string;
  volume: string | null;
  page: string | null;
  edition: string | null;
  citationText: string | null;
  provenance: string | null;
  isPrimary: boolean;
}

export interface SourceExcerpt {
  scholarId: string;
  scholarName: string;
  excerpt: string;
}

export type ProvenanceIndicator = "PRIMARY" | "MIXED" | "NONE";

export interface VerseRange {
  surahNumber: number;
  startVerse: number;
  endVerse: number;
}

export interface TafseerRequestBody {
  verseId?: string;
  verseRange?: VerseRange;
  filters?: Filters;
  stream?: boolean;
}

export interface VersePayload {
  id: string;
  surahNumber: number;
  surahName: string;
  verseNumber: number;
  arabicText?: string;
  translation?: string | null;
}

export interface TafseerResponse {
  verse: VersePayload;
  filters?: RunDraftFilters;
  aiResponse: string;
  arabicTafsir?: string;
  turkishTafsir?: string;
  confidence?: number | null;
  provenance?: ProvenanceIndicator | null;
  citations?: Citation[];
  sourceExcerpts?: SourceExcerpt[];
  searchId?: string;
  runId?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  cached?: boolean;
  fallback?: boolean;
  noTafsirForSelectedScholars?: boolean;
  noTafsirMessage?: string;
  missingScholarNames?: string[];
}

export interface TafseerRun {
  runId: string;
  searchId: string;
  verse: VersePayload;
  filters: RunDraftFilters;
  aiResponse: string;
  arabicTafsir?: string;
  turkishTafsir?: string;
  confidence: number | null;
  provenance: ProvenanceIndicator | null;
  citations: Citation[];
  sourceExcerpts: SourceExcerpt[];
  createdAt: string;
  updatedAt: string;
  title: string | null;
  notes: string | null;
  starred: boolean;
}

export interface RunSummary {
  runId: string;
  searchId: string;
  verse: Pick<VersePayload, "id" | "surahNumber" | "surahName" | "verseNumber">;
  filters: RunDraftFilters;
  title: string | null;
  notes: string | null;
  starred: boolean;
  aiResponsePreview: string | null;
  confidence: number | null;
  provenance: ProvenanceIndicator | null;
  citationsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type RunDetail = TafseerRun;

export interface SavedPreset {
  id: string;
  label: string;
  filters: RunDraftFilters;
}

export interface ComparisonRunModel {
  primaryRun: TafseerRun | null;
  secondaryRun: TafseerRun | null;
}

export interface ReplayPayload {
  verseId: string;
  filters: RunDraftFilters;
}

export function serializeReplayPayload(payload: ReplayPayload): string {
  return JSON.stringify(payload);
}

export function deserializeReplayPayload(raw: string): ReplayPayload | null {
  try {
    const parsed = JSON.parse(raw) as ReplayPayload;
    if (typeof parsed?.verseId !== "string") return null;
    return { verseId: parsed.verseId, filters: parsed.filters || {} };
  } catch {
    return null;
  }
}

export function normalizeTafseerResponseToRun(
  response: TafseerResponse,
  defaults?: Partial<
    Pick<TafseerRun, "createdAt" | "updatedAt" | "title" | "notes" | "starred">
  >,
): TafseerRun {
  const runId = response.runId || response.searchId || `local-${Date.now()}`;
  return {
    runId,
    searchId: response.searchId || runId,
    verse: response.verse,
    filters: response.filters || {},
    aiResponse: response.aiResponse,
    confidence:
      typeof response.confidence === "number" ? response.confidence : null,
    provenance: response.provenance || null,
    citations: Array.isArray(response.citations) ? response.citations : [],
    sourceExcerpts: Array.isArray(response.sourceExcerpts)
      ? response.sourceExcerpts
      : [],
    createdAt: defaults?.createdAt || new Date().toISOString(),
    updatedAt: defaults?.updatedAt || new Date().toISOString(),
    title: defaults?.title || null,
    notes: defaults?.notes || null,
    starred: defaults?.starred || false,
  };
}

export async function fetchFilters(): Promise<FiltersResponse> {
  return apiRequest<FiltersResponse>("/filters");
}

export async function fetchVerseByNumbers(
  surahNumber: number,
  verseNumber: number,
): Promise<VersePayload> {
  return apiRequest<VersePayload>(
    `/verses?surahNumber=${surahNumber}&verseNumber=${verseNumber}`,
  );
}

export type StreamEvent = {
  type: "start" | "chunk" | "complete" | "error";
  content?: string;
  searchId?: string;
  runId?: string;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  confidence?: number;
  provenance?: ProvenanceIndicator;
  citations?: Citation[];
  sourceExcerpts?: SourceExcerpt[];
  cached?: boolean;
  arabicTafsir?: string;
  turkishTafsir?: string;
  citationKey?: string;
  noTafsirForSelectedScholars?: boolean;
  noTafsirMessage?: string;
  missingScholarNames?: string[];
  verseTextTr?: string | null;
  verseRange?: { surahNumber: number; startVerse: number; endVerse: number; verseCount: number };
};

export async function startTafseerStream(
  body: TafseerRequestBody,
  token: string,
  onEvent: (evt: StreamEvent) => void,
) {
  const res = await fetch(`${API_BASE_URL}/tafseer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (raw.startsWith("data:")) {
        const jsonStr = raw.slice(5).trim();
        try {
          const evt = JSON.parse(jsonStr);
          onEvent(evt);
        } catch {
          // Ignore malformed stream event chunks
        }
      }
    }
  }
}

export async function requestTafseer(
  body: TafseerRequestBody,
  token: string,
): Promise<TafseerResponse> {
  return apiRequest<TafseerResponse>("/tafseer", {
    method: "POST",
    body: { ...body, stream: false },
    token,
  });
}

export async function fetchRunHistory(params?: {
  cursor?: string;
  limit?: number;
  token?: string | null;
}): Promise<{ items: RunSummary[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (typeof params?.limit === "number")
    query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: RunSummary[]; nextCursor: string | null }>(
    `/tafseer/runs${suffix}`,
    {
      token: params?.token,
    },
  );
}

export async function fetchRunDetail(
  runId: string,
  token?: string | null,
): Promise<RunDetail> {
  return apiRequest<RunDetail>(`/tafseer/runs/${runId}`, { token });
}

export async function updateRunMetadata(
  runId: string,
  payload: { title?: string | null; starred?: boolean; notes?: string | null },
  token?: string | null,
): Promise<RunSummary> {
  return apiRequest<RunSummary>(`/tafseer/runs/${runId}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}
