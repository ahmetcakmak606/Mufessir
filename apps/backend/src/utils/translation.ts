import OpenAI from "openai";

const aiDisabled =
  process.env.AI_MODE === "off" || process.env.OPENAI_DISABLED === "1";

const openai =
  process.env.OPENAI_API_KEY && !aiDisabled
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

export interface TranslationResult {
  translatedText: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  if (!openai) {
    throw new Error("OpenAI not configured for translation");
  }

  if (!text || text.trim().length === 0) {
    return { translatedText: "" };
  }

  const sourceName =
    sourceLanguage === "ar"
      ? "Arabic (العربية)"
      : sourceLanguage === "tr"
        ? "Turkish (Türkçe)"
        : sourceLanguage;
  const targetName =
    targetLanguage === "ar"
      ? "Arabic (العربية)"
      : targetLanguage === "tr"
        ? "Turkish (Türkçe)"
        : targetLanguage;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text from ${sourceName} to ${targetName}. Preserve the meaning, tone, and scholarly style. Do not add any explanations or comments.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const translatedText = response.choices[0]?.message?.content || "";
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return { translatedText, usage };
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error(
      `Failed to translate: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function translateToTurkish(
  arabicText: string,
): Promise<TranslationResult> {
  return translateText(arabicText, "ar", "tr");
}
