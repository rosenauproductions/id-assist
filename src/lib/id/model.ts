import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { mistral } from "@ai-sdk/mistral";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { openai } from "@ai-sdk/openai";
import { gateway, type LanguageModel } from "ai";
import { getWorkspaceModelOverride } from "@/lib/settings/store";

const NO_MODEL_MESSAGE =
  "No language model configured. Set GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_MODEL, or AI_GATEWAY_API_KEY.";

export function hasLanguageModel(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.MISTRAL_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OLLAMA_MODEL,
  );
}

async function googleModel(): Promise<LanguageModel> {
  // An owner can override the model name from Settings; falls back to the
  // env var, then the hard default. Never throws — a lookup failure just
  // means "no override," not "fail the whole generation call."
  const workspaceOverride = await getWorkspaceModelOverride();
  return google(
    workspaceOverride || process.env.GOOGLE_MODEL || "gemini-2.5-flash",
  );
}

function groqModel(): LanguageModel {
  return groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile");
}

function mistralModel(): LanguageModel {
  return mistral(process.env.MISTRAL_MODEL ?? "mistral-small-latest");
}

function ollamaModel(): LanguageModel {
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
  });
  return ollama(process.env.OLLAMA_MODEL ?? "llama3.2");
}

function anthropicModel(): LanguageModel {
  return anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5");
}

function openaiModel(): LanguageModel {
  return openai(process.env.OPENAI_MODEL ?? "gpt-5.6");
}

function gatewayModel(): LanguageModel {
  return gateway(process.env.ID_ASSIST_MODEL ?? "anthropic/claude-sonnet-5");
}

/** Explicit ID_ASSIST_PROVIDER=<name> still picks exactly one provider,
 * same as before — no fallback chain, and it errors like before if that
 * one isn't configured or fails. This is only used by "auto" mode below,
 * and by getLanguageModel() for any caller that still wants a single
 * model rather than the fallback-aware withLanguageModel(). */
export async function getLanguageModel(): Promise<LanguageModel> {
  const provider = (process.env.ID_ASSIST_PROVIDER ?? "auto").toLowerCase();

  if (
    provider === "google" ||
    (provider === "auto" && process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  ) {
    return googleModel();
  }
  if (provider === "groq" || (provider === "auto" && process.env.GROQ_API_KEY)) {
    return groqModel();
  }
  if (
    provider === "mistral" ||
    (provider === "auto" && process.env.MISTRAL_API_KEY)
  ) {
    return mistralModel();
  }
  if (provider === "ollama" || (provider === "auto" && process.env.OLLAMA_MODEL)) {
    return ollamaModel();
  }
  if (
    provider === "anthropic" ||
    (provider === "auto" && process.env.ANTHROPIC_API_KEY)
  ) {
    return anthropicModel();
  }
  if (
    provider === "openai" ||
    (provider === "auto" && process.env.OPENAI_API_KEY)
  ) {
    return openaiModel();
  }
  if (provider === "gateway" || process.env.AI_GATEWAY_API_KEY) {
    return gatewayModel();
  }

  throw new Error(NO_MODEL_MESSAGE);
}

type ModelCandidate = { name: string; create: () => LanguageModel | Promise<LanguageModel> };

// Free tiers first (Google, Groq, Mistral, in the order Chris picked them),
// then any paid provider that happens to be configured, then Ollama last —
// it's local-dev-only in practice (nothing hosted sets OLLAMA_MODEL), so it
// belongs at the end of the line rather than ahead of a real paid fallback.
function autoCandidates(): ModelCandidate[] {
  const candidates: ModelCandidate[] = [];
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    candidates.push({ name: "google", create: googleModel });
  }
  if (process.env.GROQ_API_KEY) {
    candidates.push({ name: "groq", create: groqModel });
  }
  if (process.env.MISTRAL_API_KEY) {
    candidates.push({ name: "mistral", create: mistralModel });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    candidates.push({ name: "anthropic", create: anthropicModel });
  }
  if (process.env.OPENAI_API_KEY) {
    candidates.push({ name: "openai", create: openaiModel });
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    candidates.push({ name: "gateway", create: gatewayModel });
  }
  if (process.env.OLLAMA_MODEL) {
    candidates.push({ name: "ollama", create: ollamaModel });
  }
  return candidates;
}

/** True for a rate-limit/quota/overload style failure — the kind where
 * trying the exact same request against a different provider is likely to
 * just work. False (the default) for anything else, so a real bug in the
 * prompt or schema fails fast instead of silently retrying three more
 * times against providers that would hit the same error. */
function isRetryableModelError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { statusCode?: number; message?: string; name?: string };
  if (err.statusCode === 429 || err.statusCode === 503) return true;
  const text = `${err.name ?? ""} ${err.message ?? ""}`.toLowerCase();
  return (
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("quota") ||
    text.includes("resource_exhausted") ||
    text.includes("overloaded") ||
    text.includes("too many requests")
  );
}

/**
 * Runs `run` against each configured "auto" provider in turn — Google,
 * then Groq, then Mistral, then whatever paid provider is configured —
 * moving to the next only when the current one fails with something that
 * looks like a rate limit or capacity error. Stacking a few free tiers
 * this way means one of them being throttled doesn't take the whole
 * feature down with it; it just quietly falls through to the next.
 *
 * An explicit ID_ASSIST_PROVIDER override (or no configured provider at
 * all) skips the chain entirely and behaves exactly like getLanguageModel()
 * always has — one provider, fails the same way it always did.
 */
export async function withLanguageModel<T>(
  run: (model: LanguageModel) => Promise<T>,
): Promise<T> {
  const provider = (process.env.ID_ASSIST_PROVIDER ?? "auto").toLowerCase();
  if (provider !== "auto") {
    return run(await getLanguageModel());
  }

  const candidates = autoCandidates();
  if (candidates.length === 0) {
    throw new Error(NO_MODEL_MESSAGE);
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const model = await candidate.create();
      return await run(model);
    } catch (error) {
      lastError = error;
      if (!isRetryableModelError(error)) throw error;
      // Capacity error — fall through and try the next configured provider.
    }
  }
  throw lastError;
}
