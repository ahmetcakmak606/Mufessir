"use client";

import { useEffect, useState } from "react";
import { fetchVerseByNumbers, MAX_VERSE_RANGE, type VersePayload } from "@/lib/tafseer";

interface AyahPanelProps {
  surahNumber: number;
  startVerse: number;
  endVerse: number;
  heading: string;
  labels: {
    mealShow: string;
    mealHide: string;
    loading: string;
    verseFailed: string;
    retry: string;
  };
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicDigits(n: number) {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

// Veritabanındaki meal kolonu (ayah_text_tr) şu an Arapça metin + "Fâtiha 1/1"
// tarzı referans içeriyor; gerçek Türkçe meal yok. Meal ancak Latin harfler
// Arapça harflerden çoğunuktaysa gösterilir — aksi halde Arapçayı ikiye
// katlamaktan başka işe yaramıyor.
function isUsableMeal(translation: string | null | undefined) {
  if (!translation) return false;
  const latin = (translation.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length;
  const arabic = (translation.match(/[\u0600-\u06FF]/g) || []).length;
  return latin > 0 && latin >= arabic;
}

export function AyahPanel({
  surahNumber,
  startVerse,
  endVerse,
  heading,
  labels,
}: AyahPanelProps) {
  const [verses, setVerses] = useState<VersePayload[]>([]);
  const [failedNumbers, setFailedNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMeal, setShowMeal] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const last = Math.min(endVerse, startVerse + MAX_VERSE_RANGE - 1);
    const numbers = Array.from(
      { length: Math.max(0, last - startVerse + 1) },
      (_, i) => startVerse + i,
    );
    // Yeni seçim: eski ayetler yeni başlık altında yanlışlıkla görünmesin.
    setVerses([]);
    setFailedNumbers([]);
    setLoading(true);
    void Promise.allSettled(
      numbers.map((n) => fetchVerseByNumbers(surahNumber, n)),
    ).then((results) => {
      if (cancelled) return;
      const loaded: VersePayload[] = [];
      const failed: number[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") loaded.push(result.value);
        else failed.push(numbers[i]);
      });
      setVerses(loaded);
      setFailedNumbers(failed);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNumber, startVerse, endVerse, retryCount]);

  const withText = verses.filter((v) => v.arabicText);
  const withMeal = verses.filter((v) => isUsableMeal(v.translation));

  return (
    <div>
      <div className="ui-eyebrow">{heading}</div>
      <div className="ui-rule-gold mt-3 py-5">
        {withText.length === 0 ? (
          <p className="ui-muted text-sm">{loading ? labels.loading : "—"}</p>
        ) : (
          <p className="ui-ayat font-quran" lang="ar">
            {withText.map((verse) => (
              <span key={verse.id}>
                {verse.arabicText}{" "}
                <span className="ui-ayat-num">
                  ﴿{toArabicDigits(verse.verseNumber)}﴾
                </span>{" "}
              </span>
            ))}
          </p>
        )}

        {showMeal && withMeal.length > 0 && (
          <p className="font-reading mt-4 text-base leading-relaxed text-justify text-[var(--ink-soft)]">
            {withMeal.map((verse) => (
              <span key={verse.id}>
                <sup className="mr-0.5 font-sans text-[0.7rem] text-[var(--gold-ink)]">
                  {verse.verseNumber}
                </sup>
                {verse.translation}{" "}
              </span>
            ))}
          </p>
        )}

        {withMeal.length > 0 && (
          <button
            type="button"
            className="ui-link mt-2 text-sm text-[var(--gold-ink)] underline underline-offset-4"
            onClick={() => setShowMeal((v) => !v)}
          >
            {showMeal ? labels.mealHide : labels.mealShow}
          </button>
        )}

        {failedNumbers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <p className="ui-muted">
              {labels.verseFailed.replace(
                "{n}",
                failedNumbers.map(String).join(", "),
              )}
            </p>
            <button
              type="button"
              className="ui-button-secondary px-3 py-1.5 text-xs"
              onClick={() => setRetryCount((c) => c + 1)}
            >
              {labels.retry}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
