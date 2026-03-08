"use client";
import { useState } from "react";
import type React from "react";
import { authApi } from "@/lib/auth";
import { useLang } from "@/context/LangContext";
import { locales } from "@/locales";

export default function ResetPasswordPage() {
  const { lang, setLang } = useLang();
  const t = locales[lang].resetPassword;

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMessageType(null);
    try {
      await authApi.requestPasswordReset(email);
      setMessage(t.requestSuccess);
      setMessageType("success");
      setStep("confirm");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t.requestError);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMessageType(null);
    try {
      if (newPassword !== newPassword2) throw new Error(t.mismatchError);
      await authApi.confirmPasswordReset(email, code, newPassword);
      setMessage(t.confirmSuccess);
      setMessageType("success");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : t.confirmError);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-shell flex items-center justify-center px-4 py-8">
      <div className="ui-panel-strong w-full max-w-md p-6 sm:p-7">
        <div className="mb-3 flex justify-end">
          <div className="ui-panel flex items-center gap-1 rounded-full p-1">
            <button onClick={() => setLang("tr")} className="ui-button-ghost" data-active={lang === "tr"}>TR</button>
            <button onClick={() => setLang("en")} className="ui-button-ghost" data-active={lang === "en"}>EN</button>
          </div>
        </div>

        <h1 className="font-display ui-title text-3xl">{t.title}</h1>
        <p className="ui-muted mt-2 text-sm">{t.subtitle}</p>
        {message && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${messageType === "error" ? "ui-danger" : "ui-panel"}`}>
            {message}
          </p>
        )}

        {step === "request" && (
          <form onSubmit={onRequest} className="mt-4 space-y-3">
            <input
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ui-input"
              required
            />
            <button disabled={loading} className="ui-button w-full py-2.5 text-sm">
              {loading ? t.sending : t.sendCode}
            </button>
          </form>
        )}

        {step === "confirm" && (
          <form onSubmit={onConfirm} className="mt-4 space-y-3">
            <input
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ui-input"
              required
            />
            <input
              type="text"
              placeholder={t.codePlaceholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="ui-input"
              required
            />
            <input
              type="password"
              placeholder={t.newPasswordPlaceholder}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="ui-input"
              required
            />
            <input
              type="password"
              placeholder={t.repeatPasswordPlaceholder}
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className="ui-input"
              required
            />
            <button disabled={loading} className="ui-button w-full py-2.5 text-sm">
              {loading ? t.updating : t.updatePassword}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
