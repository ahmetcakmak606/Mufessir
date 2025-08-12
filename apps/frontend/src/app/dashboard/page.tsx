'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchFilters, fetchVerseByNumbers, startTafseerStream, type Filters } from '@/lib/tafseer';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { tokenStorage } from '@/lib/auth';

export default function Dashboard() {
  const { user, logout, loading, refreshUser } = useAuth();
  const { lang, setLang, backendLanguageLabel } = useLang();
  const t = locales[lang].dashboard;
  const router = useRouter();

  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [verseNumber, setVerseNumber] = useState<number>(1);
  const [verseId, setVerseId] = useState<string>('');
  const [surahName, setSurahName] = useState<string>('');

  const [filters, setFilters] = useState<Filters>({ language: 'Turkish', tone: 7, intellectLevel: 7 });
  const [availableFilters, setAvailableFilters] = useState<import('@/lib/tafseer').FiltersResponse | null>(null);
  const [loadingFilters, setLoadingFilters] = useState<boolean>(false);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [streamContent, setStreamContent] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        setLoadingFilters(true);
        const data = await fetchFilters();
        setAvailableFilters(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingFilters(false);
      }
    };
    loadFilters();
  }, []);

  const resolveVerseId = useCallback(async () => {
    try {
      const verse = await fetchVerseByNumbers(surahNumber, verseNumber);
      setVerseId(verse.id);
      setSurahName(verse.surahName);
      return verse.id as string;
    } catch (e) {
      setError('Verse not found');
      throw e;
    }
  }, [surahNumber, verseNumber]);

  // When user changes Surah or Verse, refresh verse info and clear current result
  useEffect(() => {
    let cancelled = false;
    setStreamContent('');
    setError('');
    (async () => {
      try {
        const verse = await fetchVerseByNumbers(surahNumber, verseNumber);
        if (!cancelled) {
          setVerseId(verse.id);
          setSurahName(verse.surahName);
        }
      } catch {
        if (!cancelled) {
          setVerseId('');
          setSurahName('');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [surahNumber, verseNumber]);

  const canAnalyze = useMemo(() => {
    return !!user && (user.dailyQuota ?? 0) > 0 && !isAnalyzing;
  }, [user, isAnalyzing]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleAnalyze = async () => {
    setError('');
    setStreamContent('');
    setIsAnalyzing(true);
    try {
      const id = verseId || (await resolveVerseId());
      const token = tokenStorage.get();
      if (!token) throw new Error('Not authenticated');

      await startTafseerStream(
        {
          verseId: id,
          filters: { ...filters, language: backendLanguageLabel },
          stream: true,
        },
        token,
        (evt) => {
          if (evt.type === 'chunk' && evt.content) {
            setStreamContent((prev) => prev + evt.content);
          }
          if (evt.type === 'error') {
            setError(evt.error || 'Streaming error');
          }
          if (evt.type === 'complete') {
            // Refresh user to reflect quota decrement
            void refreshUser();
          }
        }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateFilter = (key: keyof Filters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">{t.headerTitle}</h1>
            <button
              onClick={handleLogout}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
               {t.logout}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Dil:</span>
              <button
                onClick={() => setLang('tr')}
                className={`px-2 py-1 rounded text-sm border ${lang==='tr' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >TR</button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded text-sm border ${lang==='en' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >EN</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* User and Quota */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t.userTitle}</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t.name}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t.email}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">{t.quotaRemaining}</div>
                    <div className="text-2xl font-bold text-indigo-600">{user.dailyQuota}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{t.resetsAt}</div>
                    <div className="text-sm font-medium text-gray-900">{new Date(user.quotaResetAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Verse Picker */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6 space-y-4">
                <h3 className="text-lg font-medium text-gray-900">{t.verseTitle}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.surahLabel}</label>
                    <input
                      type="number"
                      min={1}
                      max={114}
                      value={surahNumber}
                      onChange={(e) => setSurahNumber(Number(e.target.value))}
                      className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.verseLabel}</label>
                    <input
                      type="number"
                      min={1}
                      value={verseNumber}
                      onChange={(e) => setVerseNumber(Number(e.target.value))}
                      className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
                {/* Display resolved Surah name when known */}
                {verseId && (
                  <p className="text-xs text-gray-600 mt-2">{t.surahLabel}: {surahNumber} · {surahName}</p>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6 space-y-4">
                <h3 className="text-lg font-medium text-gray-900">{t.filtersTitle}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.toneLabel}</label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={filters.tone ?? 7}
                      onChange={(e) => updateFilter('tone', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.intellectLabel}</label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={filters.intellectLevel ?? 7}
                      onChange={(e) => updateFilter('intellectLevel', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.languageLabel}</label>
                  <select
                    value={filters.language ?? 'English'}
                    onChange={(e) => updateFilter('language', e.target.value)}
                    className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  >
                    {availableFilters?.supportedLanguages?.map((lang: string) => (
                      <option key={lang} value={lang}>{lang}</option>
                    )) || (
                      <>
                        <option value="Turkish">Türkçe</option>
                        <option value="English">İngilizce</option>
                        <option value="Arabic">Arapça</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.compareLabel}</label>
                  <input
                    type="text"
                    placeholder={t.comparePlaceholder}
                    value={filters.compareWith ?? ''}
                    onChange={(e) => updateFilter('compareWith', e.target.value)}
                    className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">{t.includeScholarsTitle}</label>
                    <div className="space-x-2 text-xs">
                      <button type="button" className="text-indigo-600 hover:underline" onClick={() => updateFilter('scholars', (availableFilters?.scholars || []).map((s) => s.id))}>{t.selectAll}</button>
                      <button type="button" className="text-gray-600 hover:underline" onClick={() => updateFilter('scholars', [])}>{t.clear}</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-auto border rounded-md p-2">
                    {(availableFilters?.scholars || []).map((s) => {
                      const selected = (filters.scholars || []).includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => {
                            const current = new Set(filters.scholars || []);
                            if (current.has(s.id)) current.delete(s.id); else current.add(s.id);
                            updateFilter('scholars', Array.from(current));
                          }}
                          className={`px-2 py-1 rounded-full text-xs border ${selected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">{t.excludeScholarsTitle}</label>
                    <div className="space-x-2 text-xs">
                      <button type="button" className="text-indigo-600 hover:underline" onClick={() => updateFilter('excludeScholars', (availableFilters?.scholars || []).map((s) => s.id))}>{t.selectAll}</button>
                      <button type="button" className="text-gray-600 hover:underline" onClick={() => updateFilter('excludeScholars', [])}>{t.clear}</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-auto border rounded-md p-2">
                    {(availableFilters?.scholars || []).map((s) => {
                      const excluded = (filters.excludeScholars || []).includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => {
                            const current = new Set(filters.excludeScholars || []);
                            if (current.has(s.id)) current.delete(s.id); else current.add(s.id);
                            updateFilter('excludeScholars', Array.from(current));
                          }}
                          className={`px-2 py-1 rounded-full text-xs border ${excluded ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  disabled={!canAnalyze || loadingFilters}
                  onClick={handleAnalyze}
                  className={`w-full justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${canAnalyze ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                  {isAnalyzing ? t.analyzing : user.dailyQuota <= 0 ? t.quotaExhausted : t.analyze}
                </button>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="lg:col-span-2">
            <div className="bg-white overflow-hidden shadow rounded-lg h-full">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t.resultTitle}</h3>
                <div className="prose max-w-none whitespace-pre-wrap">
                  {streamContent ? streamContent : (
                    <p className="text-gray-500">{t.resultHelp}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 