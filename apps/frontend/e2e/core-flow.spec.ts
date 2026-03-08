import { expect, test, type Page } from '@playwright/test';

type MockRun = {
  runId: string;
  searchId: string;
  verse: { id: string; surahNumber: number; surahName: string; verseNumber: number };
  filters: Record<string, unknown>;
  aiResponse: string;
  confidence: number;
  provenance: 'PRIMARY' | 'MIXED' | 'NONE';
  citations: Array<{
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
  }>;
  sourceExcerpts: Array<{ scholarId: string; scholarName: string; excerpt: string }>;
  title: string | null;
  notes: string | null;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
};

function toRunSummary(run: MockRun) {
  return {
    runId: run.runId,
    searchId: run.searchId,
    verse: run.verse,
    filters: run.filters,
    title: run.title,
    notes: run.notes,
    starred: run.starred,
    aiResponsePreview: run.aiResponse.slice(0, 120),
    confidence: run.confidence,
    provenance: run.provenance,
    citationsCount: run.citations.length,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

async function setupMockApi(page: Page) {
  const token = 'test-token';
  let streamCallCount = 0;

  const run: MockRun = {
    runId: 'run-1',
    searchId: 'run-1',
    verse: {
      id: 'verse-1-1',
      surahNumber: 1,
      surahName: 'Al-Fatihah',
      verseNumber: 1,
    },
    filters: {
      language: 'English',
      tone: 7,
      intellectLevel: 7,
      responseLength: 6,
    },
    aiResponse: 'Mercy-centered interpretation.',
    confidence: 0.88,
    provenance: 'PRIMARY',
    citations: [
      {
        scholarId: 'scholar-1',
        scholarName: 'Ibn Kathir',
        sourceType: 'BOOK',
        sourceTitle: 'Tafsir Ibn Kathir',
        volume: '1',
        page: '12',
        edition: null,
        citationText: 'In the Name of Allah, the Most Merciful...',
        provenance: 'PRIMARY',
        isPrimary: true,
      },
    ],
    sourceExcerpts: [
      {
        scholarId: 'scholar-1',
        scholarName: 'Ibn Kathir',
        excerpt: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ...',
      },
    ],
    title: null,
    notes: null,
    starred: false,
    createdAt: '2026-03-07T10:00:00.000Z',
    updatedAt: '2026-03-07T10:00:00.000Z',
  };

  await page.route('**/mock-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace('/mock-api', '');
    const method = request.method();

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }

    if (pathname === '/auth/login' && method === 'POST') {
      return json({ token });
    }

    if (pathname === '/auth/me' && method === 'GET') {
      const authHeader = request.headers()['authorization'] || '';
      if (!authHeader.includes(token)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      return json({
        id: 'user-1',
        email: 'testuser@example.com',
        name: 'Test User',
        dailyQuota: 9,
        quotaResetAt: '2026-03-08T00:00:00.000Z',
      });
    }

    if (pathname === '/filters' && method === 'GET') {
      return json({
        scholars: [
          {
            id: 'scholar-1',
            name: 'Ibn Kathir',
            mufassirTr: 'İbn Kesir',
            mufassirEn: 'Ibn Kathir',
            mufassirAr: 'ابن كثير',
            mufassirNameLong: null,
            birthYear: null,
            deathYear: 1373,
            deathHijri: 774,
            century: 8,
            madhab: 'Shafi',
            period: 'CLASSICAL_MATURE',
            periodCode: 'CLASSICAL_MATURE',
            environment: null,
            originCountry: null,
            reputationScore: 92,
            sourceAccessibility: 'FULL_DIGITAL',
            tafsirType1: 'RIVAYAH',
            tafsirType2: null,
            traditionAcceptance: ['SUNNI_MAINSTREAM'],
          },
        ],
        filterOptions: {
          centuries: [8],
          madhabs: ['Shafi'],
          periods: ['CLASSICAL_MATURE'],
          periodCodes: ['CLASSICAL_MATURE'],
          environments: [],
          countries: [],
          sourceAccessibilities: ['FULL_DIGITAL'],
          traditions: ['SUNNI_MAINSTREAM'],
          tafsirTypes: ['RIVAYAH'],
          birthYearRange: null,
          deathYearRange: { min: 1373, max: 1373 },
          deathHijriRange: { min: 774, max: 774 },
        },
        toneRange: { min: 1, max: 10, description: 'Tone slider' },
        intellectRange: { min: 1, max: 10, description: 'Intellect slider' },
        supportedLanguages: ['Turkish', 'English', 'Arabic'],
      });
    }

    if (pathname === '/verses' && method === 'GET') {
      return json({
        id: 'verse-1-1',
        surahNumber: 1,
        surahName: 'Al-Fatihah',
        verseNumber: 1,
        arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'In the name of Allah, the Most Merciful, the Most Compassionate.',
      });
    }

    if (pathname === '/tafseer' && method === 'POST') {
      streamCallCount += 1;
      run.updatedAt = new Date().toISOString();

      const streamEvents = [
        { type: 'start', runId: run.runId, searchId: run.searchId },
        { type: 'chunk', content: `${run.aiResponse}\n` },
        {
          type: 'complete',
          runId: run.runId,
          searchId: run.searchId,
          confidence: run.confidence,
          provenance: run.provenance,
          citations: run.citations,
          sourceExcerpts: run.sourceExcerpts,
          usage: { promptTokens: 31, completionTokens: 45, totalTokens: 76 },
        },
      ];

      return route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        },
        body: streamEvents.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
      });
    }

    if (pathname === '/tafseer/runs' && method === 'GET') {
      return json({ items: [toRunSummary(run)], nextCursor: null });
    }

    if (pathname === `/tafseer/runs/${run.runId}` && method === 'GET') {
      return json(run);
    }

    if (pathname === `/tafseer/runs/${run.runId}` && method === 'PATCH') {
      const payload = request.postDataJSON() as {
        title?: string | null;
        notes?: string | null;
        starred?: boolean;
      };
      if (Object.prototype.hasOwnProperty.call(payload, 'title')) run.title = payload.title || null;
      if (Object.prototype.hasOwnProperty.call(payload, 'notes')) run.notes = payload.notes || null;
      if (Object.prototype.hasOwnProperty.call(payload, 'starred') && typeof payload.starred === 'boolean') {
        run.starred = payload.starred;
      }
      run.updatedAt = new Date().toISOString();
      return json(toRunSummary(run));
    }

    return json({ error: `Unhandled mock route: ${method} ${pathname}` }, 404);
  });

  return {
    getStreamCallCount: () => streamCallCount,
  };
}

test.describe('Dashboard Core Flow', () => {
  test('auth -> query -> save -> history -> replay', async ({ page }, testInfo) => {
    const mockApi = await setupMockApi(page);
    const isMobileProject = testInfo.project.name.includes('mobile');

    await page.addInitScript(() => {
      localStorage.setItem('mufessir_lang', 'en');
    });

    await page.goto('/login');

    await page.getByLabel('Email address').fill('testuser@example.com');
    await page.getByLabel('Password').fill('pass1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard\/query/);

    if (isMobileProject) {
      await page.getByTestId('mobile-analyze-button').click({ force: true });
    } else {
      await page.getByTestId('analyze-button').click();
    }
    await expect(page.getByText('Mercy-centered interpretation.')).toBeVisible();

    if (isMobileProject) {
      await page.getByTestId('mobile-save-run-button').click({ force: true });
    } else {
      await page.getByTestId('save-run-button').click();
    }
    await expect(page.getByText('Run was starred.')).toBeVisible();

    await page.getByTestId('nav-navRuns').click();
    await expect(page).toHaveURL(/\/dashboard\/runs/);
    await expect(page.getByTestId('run-card-run-1')).toBeVisible();

    if (isMobileProject) {
      await page.getByTestId('replay-run-run-1').click({ force: true });
    } else {
      await page.getByTestId('replay-run-run-1').click();
    }
    await expect(page).toHaveURL(/\/dashboard\/query\?runId=run-1&replay=1/);
    await expect.poll(() => mockApi.getStreamCallCount()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText('Mercy-centered interpretation.')).toBeVisible();
  });
});
