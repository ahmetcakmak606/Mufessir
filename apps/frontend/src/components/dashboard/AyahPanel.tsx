"use client";

import { useEffect, useState } from "react";
import { fetchVerseByNumbers, type VersePayload } from "@/lib/tafseer";

interface AyahPanelProps {
  surahNumber: number;
  startVerse: number;
  endVerse: number;
  heading: string;
  labels: {
    mealShow: string;
    mealHide: string;
    loading: string;
  };
}

// Uzun aralıklarda her ayet için ayrı istek atılıyor; ekranda gösterilen üst sınır bu.
const MAX_VERSES = 40;

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
  const [loading, setLoading] = useState(false);
  const [showMeal, setShowMeal] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const last = Math.min(endVerse, startVerse + MAX_VERSES - 1);
    const numbers = Array.from(
      { length: Math.max(0, last - startVerse + 1) },
      (_, i) => startVerse + i,
    );
    setLoading(true);
    void Promise.allSettled(
      numbers.map((n) => fetchVerseByNumbers(surahNumber, n)),
    ).then((results) => {
      if (cancelled) return;
      setVerses(
        results
          .filter(
            (r): r is PromiseFulfilledResult<VersePayload> =>
              r.status === "fulfilled",
          )
          .map((r) => r.value),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNumber, startVerse, endVerse]);

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
          <p className="font-reading mt-4 max-w-[65ch] text-base leading-relaxed text-[var(--ink-soft)]">
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
      </div>
    </div>
  );
}
