'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type LangCode = 'tr' | 'en';

interface LangContextType {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  // Maps UI lang to backend language label
  backendLanguageLabel: string; // 'Turkish' | 'English'
}

const LangContext = createContext<LangContextType | undefined>(undefined);

const STORAGE_KEY = 'mufessir_lang';

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('tr');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as LangCode | null) : null;
    if (saved === 'tr' || saved === 'en') {
      setLangState(saved);
    }
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
  };

  const backendLanguageLabel = useMemo(() => (lang === 'tr' ? 'Turkish' : 'English'), [lang]);

  const value = useMemo(() => ({ lang, setLang, backendLanguageLabel }), [lang, backendLanguageLabel]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}


