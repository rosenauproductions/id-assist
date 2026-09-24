import { generateText, Output } from "ai";
import { z } from "zod";
import {
  minutesFor,
  pickArtifactDelivery,
  pickDelivery,
  unitsFor,
} from "./compile";
import { outlineStatus, runFilters } from "./filters";
import { defaultTeam, estimateProject } from "./estimate";
import { nid } from "./ids";
import { CURRENT_SCHEMA_VERSION } from "./migrations";
import { DEFAULT_METHODOLOGY } from "./types";
import { hasLanguageModel, withLanguageModel } from "./model";
import { mergeRequirements } from "./requirements";
import {
  BLOOM_LEVELS,
  COURSE_PHASES,
  DELIVERY_TARGETS,
  type AssessmentSpec,
  type CourseBrief,
  type DeliveryTarget,
  type IdProject,
  type Lesson,
  type Module,
  type Outcome,
} from "./types";

// --- Digesting a pasted, already-written outline ---------------------------
// Unlike the wizard (which builds a course from a one-line job task via
// deterministic templates in compile.ts), this path starts from an outline
// someone already wrote in whatever shape they had it — headings, bullets,
// a module/lesson list, prose, whatever. There's no reliable rule-based way
// to parse arbitrary prose like that, so this genuinely depends on the
// model: if it's unavailable or the call fails, importing fails outright
// (surfaced to the caller) rather than falling back to something worse.
//
// The schema is deliberately nested (module -> lesson -> its own objective)
// rather than flat lists cross-referenced by index. LLM structured output is
// far more reliable when it never has to get an integer index right — a
// wrong index is a common, hard-to-notice failure mode, whereas a nested
// shape can't reference something that doesn't exist.

const importedOutcomeSchema = z.object({
  kind: z.enum(["terminal", "enabling"]),
  bloom: z.enum(BLOOM_LEVELS),
  condition: z.string(),
  behavior: z.string(),
  criterion: z.string(),
});

const importedAssessmentSchema = z.object({
  format: z.enum(["performance", "scenario", "quiz", "conversation", "artifact"]),
  description: z.string().optional(),
});

const importedLessonSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  estimatedMinutes: z.number().int().positive().max(120).optional(),
  deliveryHint: z.enum(DELIVERY_TARGETS).optional(),
  objective: importedOutcomeSchema,
  assessment: importedAssessmentSchema.optional(),
});

const importedModuleSchema = z.object({
  title: z.string(),
  lessons: z.array(importedLessonSchema).min(1),
});

export const importedOutlineSchema = z.object({
  title: z.string(),
  audience: z.string(),
  jobTask: z.string(),
  whyNow: z.string().optional(),
  durationMinutes: z.number().int().positive().max(600).optional(),
  constraints: z.string().optional(),
  deliveryHints: z.array(z.enum(DELIVERY_TARGETS)).optional(),
  modules: z.array(importedModuleSchema).min(1),
  notes: z
    .array(z.string())
    .optional()
    .describe(
      "Anything you had to guess, invent, or couldn't find in the source text (e.g. no stated audience, no explicit seat time).",
    ),
});

export type ImportedOutline = z.infer<typeof importedOutlineSchema>;

export async function parseOutlineText(rawText: string): Promise<ImportedOutline> {
  if (!hasLanguageModel()) {
    throw new Error(
      "No language model is configured, so a pasted outline can't be digested automatically. Set GOOGLE_GENERATIVE_AI_API_KEY (or another supported provider) and try again.",
    );
  }

  const { output } = await withLanguageModel((model) =>
    generateText({
      model,
      output: Output.object({ schema: importedOutlineSchema }),
      prompt: `You are an instructional designer digesting an existing course outline pasted in by its author. It may be messy, informal, a bullet list, headings with prose, or a table copied as text — reorganize it into a Bloom's-taxonomy-gated, ADDIE-style structure without inventing an unrelated course.

What to extract:
- title, audience, jobTask (the overall terminal job performance), whyNow, durationMinutes (total learner seat time in minutes, only if stated or clearly implied), constraints, deliveryHints (rise/canvas/gdoc/gslides/video/tutor — only if the source names or clearly implies a delivery channel).
- modules: preserve the author's own grouping/order if the outline has one; otherwise group lessons sensibly.
- Each lesson needs its own objective: kind (terminal = the main job performance; enabling = a supporting sub-skill), bloom (one of ${BLOOM_LEVELS.join(", ")} — classify by the actual cognitive demand, not just the verb used), condition (the situation/inputs the learner has), behavior (an observable action, never a hollow verb like understand/know/learn), criterion (what separates pass from fail).
- If the source doesn't state a condition or criterion explicitly, infer a reasonable one from context rather than leaving it generic.
- Give each lesson an optional assessment idea (format + one-line description) when the source suggests how mastery would be checked; otherwise omit it and one will be generated.
- estimatedMinutes per lesson only if stated or clearly implied by the source; otherwise omit it.
- List anything you had to guess or invent (missing audience, missing why-now, no stated seat time, etc.) in notes so the author knows what to double-check.

Do not pad the outline with generic filler modules/lessons that aren't grounded in the source text. Stay close to what was actually written.

Source outline (verbatim, pasted by the author):
"""
${rawText}
"""`,
    }),
  );

  if (!output) {
    throw new Error("The model returned no structured output for this outline.");
  }

  return output;
}

function ensureAssessment(
  outcome: Outcome,
  delivery: DeliveryTarget[],
  assessments: AssessmentSpec[],
): AssessmentSpec {
  const format: AssessmentSpec["format"] =
    outcome.bloom === "remember" || outcome.bloom === "understand"
      ? "conversation"
      : "performance";
  const assessDelivery =
    format === "conversation"
      ? pickDelivery("understand", delivery, "tutor")
      : pickDelivery("apply", delivery, "gdoc");
  const finalDelivery =
    assessDelivery === "tutor" && format !== "conversation"
      ? pickArtifactDelivery(delivery) ?? assessDelivery
      : assessDelivery;
  const created: AssessmentSpec = {
    id: nid("as"),
    outcomeId: outcome.id,
    bloom: outcome.bloom,
    format,
    correctPerformance: `Learner can ${outcome.behavior} to this criterion: ${outcome.criterion}`,
    exemplarStem: `Using your own work, ${outcome.behavior}.`,
    delivery: finalDelivery,
  };
  assessments.push(created);
  return created;
}

/**
 * Pure mapping from the model's (or, in tests, a hand-built) parsed outline
 * into a full IdProject — no AI call in here, so it's easy to reason about
 * and test independent of the model. Runs the same post-processing pipeline
 * compileBrief() does (filters, status, estimate, requirements) so an
 * imported course gets the same gap-detection as one built via the wizard.
 */
export function buildProjectFromImportedOutline(parsed: ImportedOutline): IdProject {
  const delivery: DeliveryTarget[] =
    parsed.deliveryHints && parsed.deliveryHints.length
      ? parsed.deliveryHints
      : [...DELIVERY_TARGETS];

  const outcomes: Outcome[] = [];
  const assessments: AssessmentSpec[] = [];
  const lessons: Lesson[] = [];
  const modules: Module[] = [];

  for (const parsedModule of parsed.modules) {
    const lessonIds: string[] = [];
    for (const parsedLesson of parsedModule.lessons) {
      const outcome: Outcome = {
        id: nid("out"),
        kind: parsedLesson.objective.kind,
        bloom: parsedLesson.objective.bloom,
        condition: parsedLesson.objective.condition.trim(),
        behavior: parsedLesson.objective.behavior.trim(),
        criterion: parsedLesson.objective.criterion.trim(),
      };
      outcomes.push(outcome);

      let assessment: AssessmentSpec;
      if (parsedLesson.assessment) {
        const assessDelivery = pickDelivery(outcome.bloom, delivery, "gdoc");
        assessment = {
          id: nid("as"),
          outcomeId: outcome.id,
          bloom: outcome.bloom,
          format: parsedLesson.assessment.format,
          correctPerformance:
            parsedLesson.assessment.description?.trim() ||
            `Learner can ${outcome.behavior} to this criterion: ${outcome.criterion}`,
          exemplarStem: `Using your own work, ${outcome.behavior}.`,
          delivery: assessDelivery,
        };
        assessments.push(assessment);
      } else {
        assessment = ensureAssessment(outcome, delivery, assessments);
      }
      outcome.assessmentId = assessment.id;

      const chosen: DeliveryTarget =
        parsedLesson.deliveryHint ?? pickDelivery(outcome.bloom, delivery, "rise");
      const taskText = parsedLesson.summary?.trim() || outcome.behavior;
      const lessonId = nid("les");
      lessons.push({
        id: lessonId,
        title: parsedLesson.title.trim() || "Untitled lesson",
        objectiveIds: [outcome.id],
        estimatedMinutes: parsedLesson.estimatedMinutes ?? minutesFor(chosen),
        delivery: chosen,
        supplements: [],
        units: unitsFor(chosen, taskText),
        assessmentId: assessment.id,
      });
      lessonIds.push(lessonId);
    }

    modules.push({
      id: nid("mod"),
      title: parsedModule.title.trim() || "Untitled module",
      lessonIds,
    });
  }

  const terminalBehavior = outcomes.find((item) => item.kind === "terminal")?.behavior;

  const brief: CourseBrief = {
    title: parsed.title.trim() || "Imported course",
    audience: parsed.audience.trim() || "Unspecified audience — add this.",
    jobTask: parsed.jobTask.trim() || terminalBehavior || "Unspecified job task — add this.",
    whyNow: (parsed.whyNow ?? "").trim() || "Not stated in the source outline — add this.",
    durationMinutes:
      parsed.durationMinutes ||
      lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0) ||
      25,
    constraints: (parsed.constraints ?? "").trim() || "None",
    delivery,
  };

  const project: IdProject = {
    id: nid("prj"),
    createdAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    outline: {
      status: "draft",
      brief,
      outcomes,
      assessments,
      modules,
      lessons,
      filters: [],
      tutorBots: [],
    },
    team: defaultTeam(),
    estimate: {
      asOf: new Date().toISOString(),
      basis: "outline",
      learnerMinutes: brief.durationMinutes,
      p50Hours: 0,
      p90Hours: 0,
      calendarDays: 0,
      bottleneck: "",
      p50CostUsd: 0,
      p90CostUsd: 0,
      buckets: [],
      notes: parsed.notes ?? [],
    },
    artifacts: [],
    timeLogs: [],
    requirements: [],
    phaseProgress: COURSE_PHASES.map((phase) => ({ phase })),
    methodology: { ...DEFAULT_METHODOLOGY },
  };

  project.outline.filters = runFilters(project.outline);
  project.outline.status = outlineStatus(project.outline.filters);
  project.estimate = estimateProject(project);
  project.requirements = mergeRequirements(project.requirements, project);
  return project;
}

export async function importOutlineFromText(rawText: string): Promise<IdProject> {
  const trimmed = rawText.trim();
  if (trimmed.length < 40) {
    throw new Error(
      "That looks too short to be a real outline — paste in the full thing.",
    );
  }
  const parsed = await parseOutlineText(trimmed);
  return buildProjectFromImportedOutline(parsed);
}
