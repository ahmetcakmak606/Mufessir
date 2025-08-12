const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Filters {
  scholars?: string[];
  excludeScholars?: string[];
  tone?: number;
  intellectLevel?: number;
  language?: string;
  compareWith?: string;
}

export interface ScholarOption {
  id: string;
  name: string;
  century: number;
  madhab: string | null;
  period: string | null;
  environment: string | null;
  originCountry: string | null;
  reputationScore: number | null;
}

export interface FiltersResponse {
  scholars: ScholarOption[];
  filterOptions: {
    centuries: number[];
    madhabs: string[];
    periods: string[];
    environments: string[];
    countries: string[];
  };
  toneRange: { min: number; max: number; description: string };
  intellectRange: { min: number; max: number; description: string };
  supportedLanguages: string[];
}

export interface TafseerRequestBody {
  verseId: string;
  filters?: Filters;
  stream?: boolean;
}

export async function fetchFilters(): Promise<FiltersResponse> {
  const res = await fetch(`${API_BASE_URL}/filters`);
  if (!res.ok) throw new Error('Failed to load filters');
  return res.json();
}

export async function fetchVerseByNumbers(surahNumber: number, verseNumber: number) {
  const res = await fetch(`${API_BASE_URL}/verses?surahNumber=${surahNumber}&verseNumber=${verseNumber}`);
  if (!res.ok) throw new Error('Verse not found');
  return res.json();
}

export type StreamEvent = {
  type: 'start' | 'chunk' | 'complete' | 'error';
  content?: string;
  searchId?: string;
  error?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  cached?: boolean;
};

export async function startTafseerStream(
  body: TafseerRequestBody,
  token: string,
  onEvent: (evt: StreamEvent) => void
) {
  const res = await fetch(`${API_BASE_URL}/tafseer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No stream');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are lines starting with "data: {json}\n\n"
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (raw.startsWith('data:')) {
        const jsonStr = raw.slice(5).trim();
        try {
          const evt = JSON.parse(jsonStr);
          onEvent(evt);
        } catch {}
      }
    }
  }
}

export async function requestTafseer(body: TafseerRequestBody, token: string) {
  const res = await fetch(`${API_BASE_URL}/tafseer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, stream: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}





