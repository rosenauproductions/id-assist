import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { openai } from "@ai-sdk/openai";
import { gateway } from "ai";

export function hasLanguageModel(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OLLAMA_MODEL,
  );
}

export function getLanguageModel() {
  const provider = (process.env.ID_ASSIST_PROVIDER ?? "auto").toLowerCase();

  // Google Gemini first in "auto": it's the default for the hosted deployment
  // (free tier, no card required) and Ollama won't be reachable there anyway.
  // Local dev with only OLLAMA_MODEL set still falls through to Ollama below.
  if (
    provider === "google" ||
    (provider === "auto" && process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  ) {
    return google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash");
  }

  if (provider === "ollama" || (provider === "auto" && process.env.OLLAMA_MODEL)) {
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
    });
    return ollama(process.env.OLLAMA_MODEL ?? "llama3.2");
  }

  if (
    provider === "anthropic" ||
    (provider === "auto" && process.env.ANTHROPIC_API_KEY)
  ) {
    return anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5");
  }

  if (
    provider === "openai" ||
    (provider === "auto" && process.env.OPENAI_API_KEY)
  ) {
    return openai(process.env.OPENAI_MODEL ?? "gpt-5.6");
  }

  if (provider === "gateway" || process.env.AI_GATEWAY_API_KEY) {
    return gateway(process.env.ID_ASSIST_MODEL ?? "anthropic/claude-sonnet-5");
  }

  throw new Error(
    "No language model configured. Set GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_MODEL, or AI_GATEWAY_API_KEY.",
  );
}
