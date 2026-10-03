"use client";

import { useState } from "react";

interface ResultStreamProps {
  title: string;
  streamContent: string;
  arabicTafsir?: string;
  turkishTafsir?: string;
  placeholder: string;
  isAnalyzing: boolean;
  noTafsirMessage?: string | null;
  missingScholars?: string[];
  labels: {
    analyzing: string;
    arabic: string;
    turkish: string;
    noTafsirTitle: string;
    missingScholars: string;
  };
}

export function ResultStream({
  title,
  streamContent,
  arabicTafsir,
  turkishTafsir,
  placeholder,
  isAnalyzing,
  noTafsirMessage,
  missingScholars,
  labels,
}: ResultStreamProps) {
  const [displayLang, setDisplayLang] = useState<"tr" | "ar">("tr");

  const hasBothLanguages = Boolean(arabicTafsir && turkishTafsir);
  const showArabic = hasBothLanguages && displayLang === "ar";
  const displayContent = hasBothLanguages
    ? showArabic
      ? arabicTafsir
      : turkishTafsir
    : streamContent;

  return (
    <section aria-labelledby="result-title" aria-busy={isAnalyzing}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="result-title" className="font-display text-[1.6rem]">
          {title}
          {isAnalyzing && (
            <span className="ml-3 align-middle font-sans text-sm font-normal text-[var(--gold-ink)]">
              {labels.analyzing}
            </span>
          )}
        </h2>
        {hasBothLanguages && (
          <div role="tablist" className="flex gap-0.5 text-sm">
            {(
              [
                ["tr", labels.turkish],
                ["ar", labels.arabic],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={displayLang === code}
                onClick={() => setDisplayLang(code)}
                className={`border-b-2 px-2.5 py-1 ${
                  displayLang === code
                    ? "border-[var(--gold)] text-[var(--ink)]"
                    : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mt-4 min-h-[10rem]">
        {noTafsirMessage ? (
          <div className="ui-warn rounded-[0.5rem] p-4 text-sm">
            <p className="font-semibold">{labels.noTafsirTitle}</p>
            <p className="mt-1">{noTafsirMessage}</p>
            {missingScholars && missingScholars.length > 0 && (
              <p className="mt-2">
                {labels.missingScholars}: {missingScholars.join(", ")}
              </p>
            )}
          </div>
        ) : displayContent ? (
          <div
            className="ui-prose"
            dir={showArabic ? "rtl" : "ltr"}
            lang={showArabic ? "ar" : undefined}
          >
            {displayContent}
          </div>
        ) : (
          <p className="ui-muted max-w-[60ch] text-[0.95rem]">{placeholder}</p>
        )}
      </div>
    </section>
  );
}
