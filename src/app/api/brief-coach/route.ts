import { generateText, Output } from "ai";
import { z } from "zod";
import {
  composeFieldFromAnswers,
  enrichEvaluation,
  FIELD_COACH,
  suggestRewrites,
} from "@/lib/id/brief-coach";
import {
  type BriefDraft,
  type WizardStepId,
  WIZARD_STEPS,
} from "@/lib/id/brief-validate";
import { getLanguageModel, hasLanguageModel } from "@/lib/id/model";
import { assertAndConsumeGeneration } from "@/lib/billing/store";
import { requireWorkspaceContext } from "@/lib/team/store";

const coachSchema = z.object({
  suggestedRewrites: z.array(z.string()).max(3),
  clarifyingQuestions: z.array(z.string()).max(4),
  composedValue: z.string().optional(),
  coachNote: z.string(),
});

export async function POST(request: Request) {
  const body = (await request.json()) as {
    step: WizardStepId;
    draft: BriefDraft;
    mode?: "suggest" | "compose";
    answers?: Record<string, string>;
    attempts?: number;
  };

  const step = body.step;
  if (!WIZARD_STEPS.some((item) => item.id === step)) {
    return Response.json({ error: "Unknown wizard step" }, { status: 400 });
  }
  if (!body.draft) {
    return Response.json({ error: "draft required" }, { status: 400 });
  }

  const draft = body.draft;
  const mode = body.mode ?? "suggest";
  const attempts = body.attempts ?? 0;
  const evaluation = enrichEvaluation(step, draft, attempts);
  const localRewrites = suggestRewrites(step, draft);
  const composedLocal =
    mode === "compose" && body.answers
      ? composeFieldFromAnswers(step, body.answers, draft)
      : "";

  if (!hasLanguageModel()) {
    return Response.json({
      evaluation,
      suggestedRewrites: localRewrites,
      clarifyingQuestions:
        evaluation.clarifyingQuestions.length > 0
          ? evaluation.clarifyingQuestions
          : FIELD_COACH[step].questions.map((q) => q.prompt),
      composedValue: composedLocal || undefined,
      coachNote: evaluation.looksStuck
        ? "Answer the development questions to shape this field."
        : evaluation.ok
          ? evaluation.summary
          : "Try a suggested rewrite, or open Help me develop this.",
      source: "rules" as const,
    });
  }

  try {
    const context = await requireWorkspaceContext();
    await assertAndConsumeGeneration(context.workspaceId);
  } catch (error) {
    return Response.json({
      evaluation,
      suggestedRewrites: localRewrites,
      clarifyingQuestions:
        evaluation.clarifyingQuestions.length > 0
          ? evaluation.clarifyingQuestions
          : FIELD_COACH[step].questions.map((q) => q.prompt),
      composedValue: composedLocal || undefined,
      coachNote:
        error instanceof Error
          ? `${error.message} Using rule-based suggestions for now.`
          : "Using rule-based suggestions for now.",
      source: "rules" as const,
    });
  }

  const stepMeta = WIZARD_STEPS.find((item) => item.id === step)!;
  const currentValue =
    step === "durationMinutes"
      ? String(draft.durationMinutes)
      : step === "delivery"
        ? draft.delivery.join(", ")
        : String(draft[step] ?? "");

  try {
    const { output } = await generateText({
      model: await getLanguageModel(),
      output: Output.object({ schema: coachSchema }),
      prompt: `You are an instructional-design brief coach helping an author fill one field.

Field: ${stepMeta.title}
Prompt: ${stepMeta.prompt}
Hint: ${stepMeta.hint}
Mode: ${mode}

Current draft JSON:
${JSON.stringify(draft, null, 2)}

Current field value: ${JSON.stringify(currentValue)}

Rule-based issues: ${JSON.stringify(evaluation.issues)}
Rule-based clarifying questions: ${JSON.stringify(evaluation.clarifyingQuestions)}
Local rewrite seeds: ${JSON.stringify(localRewrites)}
${mode === "compose" ? `Author answers to development questions: ${JSON.stringify(body.answers ?? {})}
Local composed draft: ${JSON.stringify(composedLocal)}` : ""}

Return:
- suggestedRewrites: up to 3 concrete replacement strings for THIS field only (not advice).
- clarifyingQuestions: up to 4 short questions if the field is weak or empty.
- composedValue: if mode is compose, one strong field value built from the answers (and local draft if useful).
- coachNote: one short sentence of coaching.

Rules:
- Prefer observable job performance over topics or hollow verbs (understand/know/learn).
- For jobTask, prefer Mager style: condition + behavior + criterion.
- Do not invent unrelated industries. Stay close to the author's draft.
- Keep each rewrite under 220 characters.`,
    });

    if (!output) {
      throw new Error("No coach output");
    }

    return Response.json({
      evaluation,
      suggestedRewrites: [
        ...output.suggestedRewrites,
        ...localRewrites,
      ]
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, all) => all.indexOf(item) === index)
        .slice(0, 3),
      clarifyingQuestions:
        output.clarifyingQuestions.length > 0
          ? output.clarifyingQuestions
          : evaluation.clarifyingQuestions,
      composedValue:
        (output.composedValue || composedLocal || "").trim() || undefined,
      coachNote: output.coachNote,
      source: "model" as const,
    });
  } catch (error) {
    // Previously swallowed silently, which made this failure mode
    // undiagnosable from the deployed app alone — log it so Vercel's
    // runtime logs actually show why the model call failed.
    console.error("[brief-coach] model call failed:", error);
    return Response.json({
      evaluation,
      suggestedRewrites: localRewrites,
      clarifyingQuestions: evaluation.clarifyingQuestions,
      composedValue: composedLocal || undefined,
      coachNote:
        "Model coach unavailable — using rule-based suggestions.",
      source: "rules" as const,
    });
  }
}
