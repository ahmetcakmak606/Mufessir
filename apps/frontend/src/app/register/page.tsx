'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { locales } from '@/locales';
import { requestGoogleIdToken } from '@/lib/google-sso';
import { requestAppleIdToken } from '@/lib/apple-sso';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { register, loginWithGoogleIdToken, loginWithAppleIdToken } = useAuth();
  const { lang, setLang } = useLang();
  const t = locales[lang].register;
  const brand = locales[lang].home.brand;
  const router = useRouter();
  const hasGoogleSso = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const hasAppleSso = Boolean(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, password, name);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error(t.googleConfigMissing);
      }
      const idToken = await requestGoogleIdToken(clientId);
      await loginWithGoogleIdToken(idToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.googleSignInFailed);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setAppleLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
      if (!clientId) {
        throw new Error(t.appleConfigMissing);
      }
      const { idToken, name } = await requestAppleIdToken({ clientId });
      await loginWithAppleIdToken(idToken, name || undefined);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.appleSignInFailed);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="ui-shell flex items-center justify-center px-4 py-7 sm:px-6">
      <div className="pointer-events-none absolute -left-20 top-20 h-56 w-56 rounded-full bg-[rgba(14,122,105,0.18)] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-12 h-64 w-64 rounded-full bg-[rgba(12,57,61,0.16)] blur-3xl" />
      <div className="relative grid w-full max-w-5xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="ui-panel hidden flex-col justify-between p-8 lg:flex">
          <div>
            <span className="ui-badge">{brand}</span>
            <h1 className="font-display ui-title mt-4 text-4xl">{t.sideTitle}</h1>
            <p className="ui-muted mt-4 text-sm leading-relaxed">
              {t.sideText}
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="ui-panel-strong rounded-xl px-3 py-2 ui-muted">{t.sidePoint1}</p>
            <p className="ui-panel-strong rounded-xl px-3 py-2 ui-muted">{t.sidePoint2}</p>
            <p className="ui-panel-strong rounded-xl px-3 py-2 ui-muted">{t.sidePoint3}</p>
          </div>
        </aside>

        <section className="ui-panel-strong p-5 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display ui-title text-3xl sm:text-4xl">{t.title}</h2>
              <p className="ui-muted mt-2 text-sm sm:text-base">{t.subtitle}</p>
            </div>
            <div className="ui-panel flex items-center gap-1 rounded-full p-1">
              <button onClick={() => setLang('tr')} className="ui-button-ghost" data-active={lang === 'tr'}>TR</button>
              <button onClick={() => setLang('en')} className="ui-button-ghost" data-active={lang === 'en'}>EN</button>
            </div>
          </div>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div>
                <label htmlFor="name" className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
                  {t.name}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="ui-input"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="email" className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
                  {t.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="ui-input"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="ui-muted mb-1 block text-xs font-semibold uppercase tracking-[0.08em]">
                  {t.password}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="ui-input"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="ui-danger rounded-xl px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ui-button w-full px-4 py-3 text-sm"
            >
              {loading ? t.submitting : t.submit}
            </button>

            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-[var(--border-soft)]" />
              <span className="ui-muted text-xs">{t.dividerOr}</span>
              <span className="h-px flex-1 bg-[var(--border-soft)]" />
            </div>

            {hasGoogleSso && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || appleLoading || loading}
                className="ui-button-secondary w-full px-4 py-3 text-sm"
              >
                {googleLoading ? t.googleConnecting : t.googleContinue}
              </button>
            )}

            {hasAppleSso && (
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={appleLoading || googleLoading || loading}
                className="ui-button-secondary w-full px-4 py-3 text-sm"
              >
                {appleLoading ? t.appleConnecting : t.appleContinue}
              </button>
            )}

            <div className="text-right text-sm">
              <span className="ui-muted">
                {t.haveAccount}{' '}
                <Link href="/login" className="font-semibold text-[var(--brand-dark)] hover:text-[var(--brand)]">
                  {t.signin}
                </Link>
              </span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
} 
