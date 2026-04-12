export interface ScholarMeta {
  name: string;
  century?: number;
  madhab?: string;
  period?: string;
  environment?: string;
  originCountry?: string;
  reputationScore?: number;
}

export interface PromptOptions {
  verseText: string;
  translation?: string;
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
    tafsirExcerpts,
    citations = [],
    arabicTerms = [],
    userParams,
    scholarAnalysis,
  } = opts;

  let prompt = `You are an expert Islamic scholar and linguist. Your task is to generate a tafsir (exegesis) for the following Quranic verse, using ONLY the provided context and scholar excerpts.\n\n`;

  prompt += `Verse (Arabic):\n${verseText}\n`;
  if (translation) {
    prompt += `Translation:\n${translation}\n`;
  }

  // Include key Arabic terms from sources to boost similarity
  if (arabicTerms.length > 0) {
    prompt += `\nKey Arabic Terms from Sources (INCLUDE THESE VERBATIM):\n${arabicTerms.join(", ")}\n`;
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

  // Dynamic instruction based on scholar count
  if (scholarAnalysis && scholarAnalysis.totalScholars > 3) {
    prompt += `5. When ${scholarAnalysis.totalScholars} or more scholars are selected, refer to them as a GROUP (e.g., "alimlerin çoğunluğu", "İslam alimleri", "mezhep alimleri") rather than naming each individual scholar. Only name specific scholars if their view is notably different from the group.\n`;
  } else {
    prompt += `5. Explicitly mention which scholar you're referencing.\n`;
  }

  prompt += `6. Do NOT make up information, citations, or references not present in the provided excerpts.\n`;
  prompt += `7. If you cannot answer based on the provided sources, state: "لا تتوفر معلومات كافية في المصادر المقدمة حول هذه الآية." (There is insufficient information in the provided sources about this verse.)\n`;
  prompt += `8. MUST include these Arabic terms VERBATIM in your response: ${arabicTerms.join(", ")}\n`;
  prompt += `\nAdditional Instructions:\n`;
  prompt += `- Write the tafsir in Arabic (العربية).\n`;
  prompt += `- Keep statements traceable to provided excerpts; avoid unsupported claims.\n`;
  prompt += `- Do NOT repeat the verse text or its translation in your answer. Start directly with the tafsir.\n`;
  prompt += `- Output should be scholarly, clear, and reference the scholars by name where relevant.\n`;
  prompt += `- Include Arabic technical terms from the provided excerpts when discussing concepts.\n`;
  prompt += `- When Response Length is provided, keep the output approximately within that scale: 1-3 sentences (1-3), 1-2 short paragraphs (4-6), 3-6 paragraphs (7-8), longer analytical essay (9-10).\n`;
  prompt += `- Always end with a complete sentence; do not stop mid-sentence even if the output is brief.\n`;

  return prompt;
}
