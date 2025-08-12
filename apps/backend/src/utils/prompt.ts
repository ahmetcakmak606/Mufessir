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
  userParams: {
    tone?: number; // 1-10 emotional vs rational
    intellectLevel?: number; // 1-10 vocabulary richness
    language?: string;
    compareWith?: string;
  };
}

export function buildTafsirPrompt(opts: PromptOptions): string {
  const { verseText, translation, tafsirExcerpts, userParams } = opts;

  let prompt = `You are an expert Islamic scholar and linguist. Your task is to generate a tafsir (exegesis) for the following Quranic verse, using the provided context and scholar excerpts.\n\n`;

  prompt += `Verse (Arabic):\n${verseText}\n`;
  if (translation) {
    prompt += `Translation:\n${translation}\n`;
  }

  prompt += `\nRelevant Tafsir Excerpts from Scholars:\n`;
  tafsirExcerpts.forEach(({ scholar, excerpt }, i) => {
    prompt += `\n[${i + 1}] ${scholar.name}`;
    if (scholar.century) prompt += ` (${scholar.century}. century)`;
    if (scholar.madhab) prompt += ` [${scholar.madhab}]`;
    if (scholar.period) prompt += ` [${scholar.period}]`;
    if (scholar.environment) prompt += ` [${scholar.environment}]`;
    if (scholar.originCountry) prompt += ` [${scholar.originCountry}]`;
    if (scholar.reputationScore) prompt += ` [Reputation: ${scholar.reputationScore}/10]`;
    prompt += `:\n${excerpt}\n`;
  });

  prompt += `\nUser Parameters:\n`;
  if (userParams.tone) prompt += `- Tone: ${userParams.tone}/10 (1=emotional, 10=rational)\n`;
  if (userParams.intellectLevel) prompt += `- Intellect Level: ${userParams.intellectLevel}/10 (vocabulary richness)\n`;
  if (userParams.language) prompt += `- Output Language: ${userParams.language}\n`;
  if (userParams.compareWith) prompt += `- Compare with: ${userParams.compareWith}\n`;

  prompt += `\nInstructions:\n`;
  prompt += `- Base your answer strictly on the provided tafsir excerpts and metadata.\n`;
  prompt += `- Do NOT use information from outside sources or the internet.\n`;
  prompt += `- Do NOT repeat the verse text or its translation in your answer. Start directly with the tafsir.\n`;
  prompt += `- If the user requested a comparison, provide a comparative analysis.\n`;
  prompt += `- Output should be scholarly, clear, and reference the scholars by name where relevant.\n`;
  prompt += `- When tone (1-10) is provided, 1 = emotional, 10 = rational. Adjust the writing accordingly.\n`;
  prompt += `- When intellect level (1-10) is provided, 1 = simple vocabulary, 10 = highly academic vocabulary. Adjust the complexity accordingly.\n`;

  return prompt;
} 