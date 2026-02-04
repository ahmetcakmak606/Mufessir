'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchFilters, fetchVerseByNumbers, startTafseerStream, type Filters, type ScholarOption } from '@/lib/tafseer';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { tokenStorage } from '@/lib/auth';
import { surahs } from '@/lib/surahs';

export default function Dashboard() {
  const { user, logout, loading, refreshUser } = useAuth();
  const { lang, setLang, backendLanguageLabel } = useLang();
  const t = locales[lang].dashboard;
  const router = useRouter();

  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [verseNumber, setVerseNumber] = useState<number>(1);
  const [verseId, setVerseId] = useState<string>('');
  const [surahName, setSurahName] = useState<string>('');
  const [revelationType, setRevelationType] = useState<'Mekki' | 'Medeni' | 'Bilinmiyor'>('Bilinmiyor');

  const [filters, setFilters] = useState<Filters>({ language: 'Turkish', tone: 7, intellectLevel: 7, responseLength: 6 });
  const [availableFilters, setAvailableFilters] = useState<import('@/lib/tafseer').FiltersResponse | null>(null);
  const [loadingFilters, setLoadingFilters] = useState<boolean>(false);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [streamContent, setStreamContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [firstByteAt, setFirstByteAt] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ promptTokens?: number; completionTokens?: number; totalTokens?: number } | null>(null);
  const [scholarQuery, setScholarQuery] = useState<string>('');
  const [calendarMode, setCalendarMode] = useState<'gregorian' | 'hijri'>('gregorian');
  const [deathYearMin, setDeathYearMin] = useState<number>(610);
  const [deathYearMax, setDeathYearMax] = useState<number>(2025);

  // Year conversion helpers (approximate)
  const gToH = (g: number) => Math.max(1, Math.round((g - 622) * (33 / 32))); // Hijrî ~ (G-622)*33/32
  const hToG = (h: number) => Math.round(h * (32 / 33) + 622);
  const clampG = (g: number) => Math.min(2025, Math.max(610, g));

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
        // Default: include all scholars
        const allIds = (data.scholars || []).map((s) => s.id);
        setFilters((prev) => ({ ...prev, scholars: allIds, excludeScholars: [] }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingFilters(false);
      }
    };
    loadFilters();
  }, []);

  // Basic surah metadata for seeded examples (expand later)
  const surahOptions = useMemo(() => surahs, []);

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
          const meta = surahOptions.find(s => s.number === surahNumber);
          setRevelationType(meta && meta.revelation ? meta.revelation : 'Bilinmiyor');
        }
      } catch {
        if (!cancelled) {
          setVerseId('');
          setSurahName('');
          setRevelationType('Bilinmiyor');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [surahNumber, verseNumber, surahOptions]);

  const canAnalyze = useMemo(() => {
    return !!user && (user.dailyQuota ?? 0) > 0 && !isAnalyzing;
  }, [user, isAnalyzing]);

  const filteredScholars = useMemo<ScholarOption[]>(() => {
    let list: ScholarOption[] = (availableFilters?.scholars as ScholarOption[]) || [];
    if (scholarQuery.trim()) {
      const q = scholarQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    list = list.filter(s => (s.deathYear ?? Number.POSITIVE_INFINITY) >= deathYearMin);
    list = list.filter(s => (s.deathYear ?? Number.NEGATIVE_INFINITY) <= deathYearMax);
    return list;
  }, [availableFilters, scholarQuery, deathYearMin, deathYearMax]);

  // Scholar picklist helpers
  const includeIds = useMemo(() => new Set(filters.scholars || []), [filters.scholars]);
  const excludeIds = useMemo(() => new Set(filters.excludeScholars || []), [filters.excludeScholars]);
  // Lists derived on the fly where needed; no precomputed unused lists to satisfy lint

  const addInclude = (id: string) => {
    const next = new Set(filters.scholars || []);
    next.add(id);
    // Remove from exclude if present
    const nextEx = new Set(filters.excludeScholars || []);
    nextEx.delete(id);
    setFilters(prev => ({ ...prev, scholars: Array.from(next), excludeScholars: Array.from(nextEx) }));
  };
  const addExclude = (id: string) => {
    const next = new Set(filters.excludeScholars || []);
    next.add(id);
    const nextIn = new Set(filters.scholars || []);
    nextIn.delete(id);
    setFilters(prev => ({ ...prev, excludeScholars: Array.from(next), scholars: Array.from(nextIn) }));
  };
  const removeInclude = (id: string) => {
    const next = new Set(filters.scholars || []);
    next.delete(id);
    setFilters(prev => ({ ...prev, scholars: Array.from(next) }));
  };
  const removeExclude = (id: string) => {
    const next = new Set(filters.excludeScholars || []);
    next.delete(id);
    setFilters(prev => ({ ...prev, excludeScholars: Array.from(next) }));
  };
  const includeAll = () => {
    const allIds = (availableFilters?.scholars || []).map((s) => s.id);
    setFilters((prev) => ({ ...prev, scholars: allIds, excludeScholars: [] }));
  };
  const excludeAll = () => {
    const allIds = (availableFilters?.scholars || []).map((s) => s.id);
    setFilters((prev) => ({ ...prev, excludeScholars: allIds, scholars: [] }));
  };
  const resetSelections = () => {
    setFilters((prev) => ({ ...prev, scholars: [], excludeScholars: [] }));
  };

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
    setUsage(null);
    setStartedAt(null);
    setFirstByteAt(null);
    setCompletedAt(null);
    setIsAnalyzing(true);
    try {
      const id = verseId || (await resolveVerseId());
      const token = tokenStorage.get();
      if (!token) throw new Error('Not authenticated');

      const resolvedLanguage = filters.language || backendLanguageLabel;
      await startTafseerStream(
        {
          verseId: id,
          filters: { ...filters, language: resolvedLanguage },
          stream: true,
        },
        token,
        (evt) => {
          if (evt.type === 'chunk' && evt.content) {
            setFirstByteAt((prev) => prev ?? performance.now());
            setStreamContent((prev) => prev + evt.content);
          }
          if (evt.type === 'error') {
            setError(evt.error || 'Streaming error');
          }
          if (evt.type === 'complete') {
            // Refresh user to reflect quota decrement
            void refreshUser();
            setUsage(evt.usage || null);
            setCompletedAt(performance.now());
          }
          if (evt.type === 'start') {
            setStartedAt(performance.now());
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
                    <select
                      value={surahNumber}
                      onChange={(e) => setSurahNumber(Number(e.target.value))}
                      className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    >
                      {surahOptions.map((s) => (
                        <option key={s.number} value={s.number}>{s.number}. {s.nameTr}</option>
                      ))}
                    </select>
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
                {/* Display resolved Surah info */}
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <p>{t.surahLabel}: {surahNumber} · {surahName || surahOptions.find(s => s.number === surahNumber)?.nameTr || ''}</p>
                  <p>{t.revelationType}: {revelationType === 'Mekki' ? t.mekki : revelationType === 'Medeni' ? t.medeni : 'Bilinmiyor'}</p>
                </div>
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
                    <p className="text-xs text-gray-500 mt-1">{t.toneHelp}</p>
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
                    <p className="text-xs text-gray-500 mt-1">{t.intellectHelp}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.lengthLabel}</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={filters.responseLength ?? 6}
                    onChange={(e) => updateFilter('responseLength', Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t.lengthHelp}</p>
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
                  <p className="text-xs text-gray-500 mt-1">{t.languageHelp}</p>
                </div>
                
                <div className="text-xs text-gray-500">Müfessir seçimi: Aşağıdaki geniş tabloda yapabilirsiniz.</div>

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
                {/* Performance Bar */}
                <div className="text-xs text-gray-600 mb-3 flex gap-4 flex-wrap">
                  <div><span className="font-medium">{t.perfTitle}:</span></div>
                  <div>{t.perfStart}: {startedAt ? '✓' : '—'}</div>
                  <div>{t.perfFirstByte}: {startedAt && firstByteAt ? `${Math.max(0, Math.round(firstByteAt - startedAt))} ms` : '—'}</div>
                  <div>{t.perfTotal}: {startedAt && completedAt ? `${Math.max(0, Math.round(completedAt - startedAt))} ms` : '—'}</div>
                  <div>{t.perfTokens}: {usage?.totalTokens ?? '—'}</div>
                </div>
                <div className="prose max-w-none whitespace-pre-wrap">
                  {streamContent ? streamContent : (
                    <p className="text-gray-500">{t.resultHelp}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scholar selection – full width */}
          <div className="lg:col-span-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">{t.includeScholarsTitle} / {t.excludeScholarsTitle}</h3>
                <div className="flex items-center gap-2 mb-3 text-xs">
                  <button type="button" onClick={includeAll} className="px-2 py-1 border rounded text-indigo-700 border-indigo-300 hover:bg-indigo-50">{t.includeAll}</button>
                  <button type="button" onClick={excludeAll} className="px-2 py-1 border rounded text-red-700 border-red-300 hover:bg-red-50">{t.excludeAll}</button>
                  <button type="button" onClick={resetSelections} className="px-2 py-1 border rounded text-gray-700 border-gray-300 hover:bg-gray-50">{t.resetSelections}</button>
                </div>
                {/* Search */}
                <input
                  type="text"
                  placeholder={t.scholarsSearchPlaceholder}
                  className="w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 text-sm px-2 py-1 mb-2"
                  onChange={(e) => setScholarQuery(e.target.value)}
                />
                {/* Death year filters with calendar toggle */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{t.deathYearFilterLabel}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{t.calendarMode}:</span>
                      <button type="button" onClick={()=> setCalendarMode('gregorian')} className={`px-2 py-0.5 border rounded ${calendarMode==='gregorian' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700 border-gray-300'}`}>{t.gregorian}</button>
                      <button type="button" onClick={()=> setCalendarMode('hijri')} className={`px-2 py-0.5 border rounded ${calendarMode==='hijri' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700 border-gray-300'}`}>{t.islamic}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    {/* Min */}
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={calendarMode==='gregorian' ? 610 : 1}
                        max={calendarMode==='gregorian' ? 2025 : gToH(2025)}
                        value={calendarMode==='gregorian' ? deathYearMin : gToH(deathYearMin)}
                        onChange={(e)=> {
                          const val = Number(e.target.value);
                          const g = calendarMode==='gregorian' ? val : hToG(val);
                          setDeathYearMin(clampG(g));
                        }}
                        className="w-full"
                      />
                      <input
                        type="number"
                        className="w-20 rounded-md border-gray-300 text-sm px-2 py-1"
                        value={calendarMode==='gregorian' ? deathYearMin : gToH(deathYearMin)}
                        onChange={(e)=> {
                          const val = Number(e.target.value);
                          const g = calendarMode==='gregorian' ? val : hToG(val);
                          setDeathYearMin(clampG(g));
                        }}
                      />
                    </div>
                    {/* Max */}
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={calendarMode==='gregorian' ? 610 : 1}
                        max={calendarMode==='gregorian' ? 2025 : gToH(2025)}
                        value={calendarMode==='gregorian' ? deathYearMax : gToH(deathYearMax)}
                        onChange={(e)=> {
                          const val = Number(e.target.value);
                          const g = calendarMode==='gregorian' ? val : hToG(val);
                          setDeathYearMax(clampG(g));
                        }}
                        className="w-full"
                      />
                      <input
                        type="number"
                        className="w-20 rounded-md border-gray-300 text-sm px-2 py-1"
                        value={calendarMode==='gregorian' ? deathYearMax : gToH(deathYearMax)}
                        onChange={(e)=> {
                          const val = Number(e.target.value);
                          const g = calendarMode==='gregorian' ? val : hToG(val);
                          setDeathYearMax(clampG(g));
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Scholar table with tri-state include/exclude (simplified: hide mezhep/ülke for now) */}
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-3/5" />
                        <col className="w-1/5" />
                        <col className="w-1/5" />
                      </colgroup>
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-3 py-2">Müfessir</th>
                          <th className="text-left px-3 py-2">Vefat</th>
                          <th className="text-right px-3 py-2">Seçim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScholars.map((s) => {
                          const included = includeIds.has(s.id);
                          const excluded = excludeIds.has(s.id);
                          return (
                            <tr key={s.id} className="border-t">
                              <td className="px-3 py-1.5 truncate" title={s.name}>{s.name}</td>
                              <td className="px-3 py-1.5">{s.deathYear ?? '-'}</td>
                              <td className="px-3 py-1.5 text-right space-x-2">
                                <button type="button" className={`px-2 py-0.5 border rounded ${included ? 'bg-indigo-600 text-white border-indigo-600' : 'text-indigo-700 border-indigo-300'}`} onClick={()=> addInclude(s.id)}>Dahil</button>
                                <button type="button" className={`px-2 py-0.5 border rounded ${excluded ? 'bg-red-600 text-white border-red-600' : 'text-red-700 border-red-300'}`} onClick={()=> addExclude(s.id)}>Hariç</button>
                                {(included || excluded) && (
                                  <button type="button" className="px-2 py-0.5 border rounded text-gray-700 border-gray-300" onClick={()=> { removeInclude(s.id); removeExclude(s.id); }}>Sıfırla</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
