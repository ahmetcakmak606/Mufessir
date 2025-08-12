import OpenAI from "openai";
import { buildTafsirPrompt, type PromptOptions } from "./prompt.js";

const aiDisabled = process.env.AI_MODE === "off" || process.env.OPENAI_DISABLED === "1";

const openai = process.env.OPENAI_API_KEY && !aiDisabled
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface TafsirGenerationOptions {
  promptOptions: PromptOptions;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface TafsirGenerationResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function generateTafsirStream(
  options: TafsirGenerationOptions,
  onChunk: (chunk: string) => void
): Promise<TafsirGenerationResult> {
  if (!openai) {
    throw new Error(aiDisabled ? "OpenAI disabled by environment" : "OpenAI API key not configured");
  }

  const {
    promptOptions,
    model = process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.7),
    maxTokens = Number(process.env.OPENAI_MAX_TOKENS ?? 800),
  } = options;

  const prompt = buildTafsirPrompt(promptOptions);

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert Islamic scholar and linguist. Provide accurate, scholarly tafsir based on the provided context."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    let fullContent = "";
    let usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        onChunk(content);
      }

      // Track usage if available
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens || 0,
          completionTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        };
      }
    }

    return {
      content: fullContent,
      usage,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(`Failed to generate tafsir: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateTafsirNonStreaming(
  options: TafsirGenerationOptions
): Promise<TafsirGenerationResult> {
  if (!openai) {
    throw new Error(aiDisabled ? "OpenAI disabled by environment" : "OpenAI API key not configured");
  }

  const {
    promptOptions,
    model = process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.7),
    maxTokens = Number(process.env.OPENAI_MAX_TOKENS ?? 800),
  } = options;

  const prompt = buildTafsirPrompt(promptOptions);

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert Islamic scholar and linguist. Provide accurate, scholarly tafsir based on the provided context."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    const content = response.choices[0]?.message?.content || "";
    const usage = response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    } : undefined;

    return {
      content,
      usage,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(`Failed to generate tafsir: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 