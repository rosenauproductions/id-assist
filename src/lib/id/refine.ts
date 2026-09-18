import { generateText, Output } from "ai";
import { z } from "zod";
import { hasLanguageModel, withLanguageModel } from "./model";
import { BLOOM_LEVELS, DELIVERY_TARGETS, type IdProject } from "./types";

const refineSchema = z.object({
  outcomes: z.array(
    z.object({
      id: z.string(),
      bloom: z.enum(BLOOM_LEVELS),
      condition: z.string(),
      behavior: z.string(),
      criterion: z.string(),
    }),
  ),
  lessons: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      estimatedMinutes: z.number().min(4).max(12),
      delivery: z.enum(DELIVERY_TARGETS),
      units: z.array(
        z.object({
          id: z.string().optional(),
          purpose: z.string(),
          gagne: z.string(),
          riseBlock: z.string().optional(),
        }),
      ),
    }),
  ),
  notes: z.array(z.string()).optional(),
});

export async function refineOutlineWithModel(
  project: IdProject,
): Promise<IdProject> {
  if (!hasLanguageModel()) {
    throw new Error(
      "No AI model is configured for this deployment. Set GOOGLE_GENERATIVE_AI_API_KEY (or another supported provider) in the environment.",
    );
  }

  const snapshot = {
    brief: project.outline.brief,
    outcomes: project.outline.outcomes,
    lessons: project.outline.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      objectiveIds: lesson.objectiveIds,
      estimatedMinutes: lesson.estimatedMinutes,
      delivery: lesson.delivery,
      units: lesson.units,
    })),
    openFilters: project.outline.filters.filter(
      (filter) => !filter.resolved && filter.severity !== "pass",
    ),
  };

  const { output } = await withLanguageModel((model) =>
    generateText({
      model,
      output: Output.object({ schema: refineSchema }),
      prompt: `You are an instructional designer refining an ID Assist course outline.

Rules:
- Keep the same outcome ids and lesson ids. Do not add or remove ids.
- Rewrite hollow verbs into observable Mager-style outcomes (condition + behavior + criterion).
- Keep Bloom authentic: practice intent in unit purposes must match Bloom.
- Keep seat-time near the budget (${project.outline.brief.durationMinutes} minutes total).
- Fix open filter issues when possible.
- Purpose lines only — no body copy paragraphs.
- Return JSON matching the schema.

Current outline JSON:
${JSON.stringify(snapshot, null, 2)}`,
    }),
  );

  if (!output) {
    throw new Error("Model returned no structured refine output.");
  }

  const next = structuredClone(project);
  for (const refined of output.outcomes) {
    const outcome = next.outline.outcomes.find((item) => item.id === refined.id);
    if (!outcome) continue;
    outcome.bloom = refined.bloom;
    outcome.condition = refined.condition.trim();
    outcome.behavior = refined.behavior.trim();
    outcome.criterion = refined.criterion.trim();
  }

  for (const refined of output.lessons) {
    const lesson = next.outline.lessons.find((item) => item.id === refined.id);
    if (!lesson) continue;
    lesson.title = refined.title.trim();
    lesson.estimatedMinutes = refined.estimatedMinutes;
    lesson.delivery = refined.delivery;
    lesson.units = refined.units.map((unit, index) => {
      const existing = lesson.units[index] ?? lesson.units[0];
      return {
        id: unit.id || existing?.id || `u_${index}`,
        purpose: unit.purpose.trim(),
        gagne: (unit.gagne as typeof existing.gagne) || existing?.gagne || "present",
        delivery: lesson.delivery,
        riseBlock:
          (unit.riseBlock as typeof existing.riseBlock) ||
          (lesson.delivery === "rise" ? existing?.riseBlock : undefined),
      };
    });
  }

  if (next.outline.status === "approved") {
    next.outline.status = "needs_review";
  }
  next.artifacts = [];
  return next;
}
