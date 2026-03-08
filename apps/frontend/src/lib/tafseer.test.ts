import { describe, expect, it } from 'vitest';
import {
  deserializeReplayPayload,
  normalizeTafseerResponseToRun,
  serializeReplayPayload,
  type ReplayPayload,
} from '@/lib/tafseer';

describe('tafseer lib helpers', () => {
  it('serializes and deserializes replay payloads', () => {
    const payload: ReplayPayload = {
      verseId: 'verse-1-1',
      filters: {
        tone: 7,
        language: 'English',
      },
    };

    const raw = serializeReplayPayload(payload);
    const parsed = deserializeReplayPayload(raw);

    expect(parsed).toEqual(payload);
  });

  it('returns null for invalid replay payloads', () => {
    expect(deserializeReplayPayload('bad-json')).toBeNull();
    expect(deserializeReplayPayload(JSON.stringify({ filters: {} }))).toBeNull();
  });

  it('normalizes tafseer response into canonical run shape', () => {
    const run = normalizeTafseerResponseToRun(
      {
        verse: {
          id: 'verse-2-255',
          surahNumber: 2,
          surahName: 'Bakara',
          verseNumber: 255,
        },
        filters: { tone: 8 },
        aiResponse: 'Test response',
        confidence: 0.82,
        provenance: 'PRIMARY',
        citations: [],
        sourceExcerpts: [],
        runId: 'run-1',
        searchId: 'search-1',
      },
      {
        title: 'Ayat al-Kursi',
      }
    );

    expect(run.runId).toBe('run-1');
    expect(run.searchId).toBe('search-1');
    expect(run.verse.id).toBe('verse-2-255');
    expect(run.confidence).toBe(0.82);
    expect(run.provenance).toBe('PRIMARY');
    expect(run.title).toBe('Ayat al-Kursi');
  });
});
