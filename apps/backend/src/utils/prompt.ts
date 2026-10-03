export interface ScholarMeta {
  name: string;
  century?: number;
  madhab?: string;
  period?: string;
  environment?: string;
  originCountry?: string;
  reputationScore?: number;
}

export interface VerseEntry {
  verseNumber: number;
  arabicText: string;
  translation?: string | null;
}

export interface PromptOptions {
  verseText: string;
  translation?: string;
  /** When summarising a range, all verses are passed here (overrides verseText/translation). */
  verses?: VerseEntry[];
  tafsirExcerpts: Array<{
    scholar: ScholarMeta;
    excerpt: string;
  }>;
  citations?: Array<{
    scholarName: string;
    sourceTitle: string;
    sourceType?: string | null;
    volume?: string | null;
    page?: string | null;
  }>;
  arabicTerms?: string[];
  userParams: {
    methodTags?: string[];
    language?: string;
    responseLength?: number;
  };
  scholarAnalysis?: {
    dominantMadhab: string | null;
    dominantPeriod: string | null;
    totalScholars: number;
    hasMultipleMadhhabs: boolean;
    scholarContext: string;
  };
}

export function buildTafsirPrompt(opts: PromptOptions): string {
  const {
    verseText,
    translation,
    verses,
    tafsirExcerpts,
    citations = [],
    arabicTerms = [],
    userParams,
    scholarAnalysis,
  } = opts;

  const isRange = verses && verses.length > 1;

  let prompt = isRange
    ? `You are an expert Islamic scholar and linguist. Your task is to generate a unified tafsir SUMMARY for the following range of Quranic verses, using ONLY the provided scholar excerpts. Synthesise the themes and meanings across the entire passage.\n\n`
    : `You are an expert Islamic scholar and linguist. Your task is to generate a tafsir (exegesis) for the following Quranic verse, using ONLY the provided context and scholar excerpts.\n\n`;

  if (isRange) {
    prompt += `Verse Range (${verses.length} verses):\n`;
    for (const v of verses) {
      prompt += `[Verse ${v.verseNumber}] ${v.arabicText}\n`;
      if (v.translation) prompt += `  Translation: ${v.translation}\n`;
    }
  } else {
    prompt += `Verse (Arabic):\n${verseText}\n`;
    if (translation) {
      prompt += `Translation:\n${translation}\n`;
    }
  }

  // Arabic terminology observed in the sources, offered as optional context.
  // Never mandate verbatim inclusion: forcing terms to "boost similarity"
  // pushes the model to use concepts the clipped excerpts may not support.
  if (arabicTerms.length > 0) {
    prompt += `\nArabic Terms Observed in Sources (use only when relevant to the meaning):\n${arabicTerms.join(", ")}\n`;
  }

  // Add scholar group context if available
  if (scholarAnalysis && scholarAnalysis.scholarContext) {
    prompt += `\n${scholarAnalysis.scholarContext}\n`;
  }

  prompt += `\nRelevant Tafsir Excerpts from Scholars:\n`;
  tafsirExcerpts.forEach(({ scholar, excerpt }, i) => {
    prompt += `\n[${i + 1}] ${scholar.name}`;
    if (scholar.century) prompt += ` (${scholar.century}. century)`;
    if (scholar.madhab) prompt += ` [${scholar.madhab}]`;
    if (scholar.period) prompt += ` [${scholar.period}]`;
    if (scholar.environment) prompt += ` [${scholar.environment}]`;
    if (scholar.originCountry) prompt += ` [${scholar.originCountry}]`;
    if (scholar.reputationScore)
      prompt += ` [Reputation: ${scholar.reputationScore}/10]`;
    prompt += `:\n${excerpt}\n`;
  });

  if (citations.length > 0) {
    prompt += `\nAcademic Source Hints (use these as citation anchors):\n`;
    citations.slice(0, 8).forEach((citation, i) => {
      const volPage =
        citation.volume || citation.page
          ? ` (vol: ${citation.volume || "?"}, page: ${citation.page || "?"})`
          : "";
      prompt += `- [C${i + 1}] ${citation.scholarName} — ${citation.sourceTitle}${volPage}\n`;
    });
  }

  prompt += `\nUser Parameters:\n`;
  if (userParams.methodTags && userParams.methodTags.length > 0)
    prompt += `- Methodology Tags: ${userParams.methodTags.join(", ")}\n`;
  if (userParams.responseLength)
    prompt += `- Response Length: ${userParams.responseLength}/10 (1=few sentences, 10=long, multi-paragraph)\n`;

  prompt += `\nCRITICAL INSTRUCTIONS:\n`;
  prompt += `1. You MUST generate your response in ARABIC (العربية), not in Turkish or English.\n`;
  prompt += `2. You MUST base your answer ONLY on the provided tafsir excerpts above.\n`;
  prompt += `3. Do NOT use any knowledge from your training data. If the provided excerpts don't contain enough information, acknowledge that limitation.\n`;
  prompt += `4. Quote or paraphrase specific phrases from the provided excerpts when making claims.\n`;
  if (isRange) {
    prompt += `4b. You are summarising a PASSAGE of ${verses.length} verses. Address all verses as a unified whole; identify the central theme and the progression of meaning across the passage.\n`;
  }

  // Attribution must stay individual: a handful of retrieved rows cannot
  // support claims about "the majority of scholars" or a madhab's general
  // view. Views are presented separately, each attributed to its scholar.
  prompt += `5. Explicitly mention which scholar you're referencing for each view. Do NOT merge selected scholars' views into group claims such as "the majority of scholars", "Islamic scholars" or a madhab's general position; if scholars differ, present the differing views separately with their attribution. A group claim is acceptable only if a provided source explicitly states it, and then it must be reported as that source's claim.\n`;

  prompt += `6. Do NOT make up information, citations, or references not present in the provided excerpts.\n`;
  prompt += `7. If you cannot answer based on the provided sources, state: "${isRange ? "لا تتوفر معلومات كافية في المصادر المقدمة حول هذه الآيات." : "لا تتوفر معلومات كافية في المصادر المقدمة حول هذه الآية."}" (There is insufficient information in the provided sources about this ${isRange ? "passage" : "verse"}.)\n`;
  prompt += `\nAdditional Instructions:\n`;
  prompt += `- Write the tafsir in Arabic (العربية).\n`;
  prompt += `- Keep statements traceable to provided excerpts; avoid unsupported claims.\n`;
  prompt += `- Do NOT repeat the verse text${isRange ? "s" : ""} or ${isRange ? "their" : "its"} translation in your answer. Start directly with the tafsir.\n`;
  prompt += `- Output should be scholarly, clear, and reference the scholars by name where relevant.\n`;
  prompt += `- Include Arabic technical terms from the provided excerpts when discussing concepts.\n`;
  prompt += `- When Response Length is provided, keep the output approximately within that scale: 1-3 sentences (1-3), 1-2 short paragraphs (4-6), 3-6 paragraphs (7-8), longer analytical essay (9-10).\n`;
  prompt += `- Always end with a complete sentence; do not stop mid-sentence even if the output is brief.\n`;

  return prompt;
}
