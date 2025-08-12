'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { lang, setLang } = useLang();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

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

  if (user) {
    return null; // Will redirect to dashboard
  }

  const t = locales[lang].home;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-screen text-center relative">
          <div className="absolute right-0 top-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setLang('tr')} className={`px-2 py-1 rounded text-sm border ${lang==='tr' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>TR</button>
              <button onClick={() => setLang('en')} className={`px-2 py-1 rounded text-sm border ${lang==='en' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>EN</button>
            </div>
          </div>
          <div className="max-w-3xl">
             <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
               <span className="text-indigo-600">{t.brand}</span>
               <br />
               {t.title}
             </h1>
            
             <p className="text-xl text-gray-600 mb-8 max-w-2xl">{t.subtitle}</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                 {t.getStarted}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                 {t.signIn}
              </Link>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-indigo-600 text-2xl mb-4">📖</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.card1Title}</h3>
              <p className="text-gray-600">{t.card1Text}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-indigo-600 text-2xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.card2Title}</h3>
              <p className="text-gray-600">{t.card2Text}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-indigo-600 text-2xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.card3Title}</h3>
              <p className="text-gray-600">{t.card3Text}</p>
            </div>
          </div>

          <div className="mt-12 text-sm text-gray-500">
            <p>{t.foot}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
