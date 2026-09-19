import { estimateProject, defaultTeam } from "./estimate";
import { nid } from "./ids";
import { CURRENT_SCHEMA_VERSION } from "./migrations";
import { DEFAULT_METHODOLOGY } from "./types";
import { outlineStatus, runFilters } from "./filters";
import { mergeRequirements } from "./requirements";
import {
  COURSE_PHASES,
  type AssessmentSpec,
  type Bloom,
  type ContentUnit,
  type CourseBrief,
  type DeliveryTarget,
  type GagneEvent,
  type IdProject,
  type Lesson,
  type Outcome,
  type RiseBlockKind,
} from "./types";

const PREFERRED: Record<Bloom, DeliveryTarget[]> = {
  remember: ["rise", "canvas", "gslides", "tutor"],
  understand: ["video", "gslides", "rise", "gdoc"],
  apply: ["gdoc", "rise", "canvas", "tutor"],
  analyze: ["tutor", "rise", "gdoc", "canvas"],
  evaluate: ["gdoc", "tutor", "canvas"],
  create: ["gdoc", "canvas", "tutor"],
};

export function pickDelivery(
  bloom: Bloom,
  available: DeliveryTarget[],
  fallback: DeliveryTarget,
): DeliveryTarget {
  const pool = available.length ? available : [...PREFERRED[bloom]];
  return PREFERRED[bloom].find((target) => pool.includes(target)) ?? fallback;
}

/**
 * Best non-conversation channel for apply-and-above evidence, restricted to
 * channels the brief actually selected. Returns null if the build mix has no
 * real artifact channel at all (e.g. delivery = ["tutor"] only) — filters.ts
 * turns that into a block so it surfaces to the human instead of silently
 * dropping the evidence.
 */
export function pickArtifactDelivery(available: DeliveryTarget[]): DeliveryTarget | null {
  return (
    PREFERRED.apply
      .filter((target) => target !== "tutor")
      .find((target) => available.includes(target)) ?? null
  );
}

function inferBloom(jobTask: string): Bloom {
  const text = jobTask.toLowerCase();
  if (/\b(create|design|author|produce|build)\b/.test(text)) return "create";
  if (/\b(evaluate|judge|select|decide)\b/.test(text)) return "evaluate";
  if (/\b(critique|analyze|audit|diagnose|identify)\b/.test(text)) {
    return "analyze";
  }
  if (/\b(write|do|apply|use|perform|handle|run)\b/.test(text)) return "apply";
  if (/\b(explain|describe|summarize)\b/.test(text)) return "understand";
  return "apply";
}

function unit(
  purpose: string,
  gagne: GagneEvent,
  delivery: DeliveryTarget,
  riseBlock?: RiseBlockKind,
): ContentUnit {
  return { id: nid("u"), purpose, gagne, delivery, riseBlock };
}

function riseUnits(jobTask: string): ContentUnit[] {
  return [
    unit("Why this job fails today", "attention", "rise", "statement"),
    unit("Main objective in plain language", "objectives", "rise", "text"),
    unit("Activate a recent messy example", "recall", "rise", "text"),
    unit(`Worked example of: ${jobTask}`, "present", "rise", "process"),
    unit("Guided attempt with checklist", "elicit", "rise", "checklist"),
    unit("Knowledge check at the lesson verb", "assess", "rise", "knowledge-check"),
  ];
}

function videoUnits(jobTask: string): ContentUnit[] {
  return [
    unit("Cold open: the workplace cost", "attention", "video"),
    unit("Two-case contrast (wrong vs right)", "present", "video"),
    unit(`Name the job: ${jobTask}`, "objectives", "video"),
    unit("What to do next in the following lesson", "retain", "video"),
  ];
}

function docUnits(jobTask: string): ContentUnit[] {
  return [
    unit("Job aid purpose and when to use it", "objectives", "gdoc"),
    unit(`Worked example of ${jobTask}`, "present", "gdoc"),
    unit("Blank template the learner fills", "elicit", "gdoc"),
    unit("Quality criterion checklist", "assess", "gdoc"),
  ];
}

function slidesUnits(): ContentUnit[] {
  return [
    unit("Title + why now", "attention", "gslides"),
    unit("One idea per slide, contrast cases", "present", "gslides"),
    unit("Practice prompt", "elicit", "gslides"),
  ];
}

function tutorUnits(jobTask: string): ContentUnit[] {
  return [
    unit("Tutor states the job and constraints", "objectives", "tutor"),
    unit("Learner pastes or describes a real artifact", "recall", "tutor"),
    unit(`Guided critique against: ${jobTask}`, "elicit", "tutor"),
    unit("Feedback mapped to the criterion", "feedback", "tutor"),
    unit("Send learner to the required artifact if Bloom ≥ apply", "assess", "tutor"),
  ];
}

function canvasUnits(): ContentUnit[] {
  return [
    unit("Page: assignment brief", "objectives", "canvas"),
    unit("Upload or quiz matching the verb", "assess", "canvas"),
  ];
}

export function unitsFor(delivery: DeliveryTarget, jobTask: string): ContentUnit[] {
  switch (delivery) {
    case "rise":
      return riseUnits(jobTask);
    case "video":
      return videoUnits(jobTask);
    case "gdoc":
      return docUnits(jobTask);
    case "gslides":
      return slidesUnits();
    case "tutor":
      return tutorUnits(jobTask);
    case "canvas":
      return canvasUnits();
  }
}

export function minutesFor(delivery: DeliveryTarget): number {
  switch (delivery) {
    case "video":
      return 5;
    case "tutor":
      return 9;
    case "gdoc":
      return 8;
    case "gslides":
      return 6;
    case "canvas":
      return 6;
    default:
      return 8;
  }
}

export function compileBrief(brief: CourseBrief): IdProject {
  const delivery = brief.delivery.length
    ? brief.delivery
    : (["rise", "canvas", "gdoc", "video", "tutor"] as DeliveryTarget[]);

  const terminalBloom = inferBloom(brief.jobTask);
  const enabling: Outcome = {
    id: nid("out"),
    kind: "enabling",
    bloom: "understand",
    condition: `Given ${brief.audience} in their current role`,
    behavior: `explain why ${brief.jobTask} matters now`,
    criterion: "names the workplace cost in their own words",
  };

  const terminal: Outcome = {
    id: nid("out"),
    kind: "terminal",
    bloom: terminalBloom,
    condition: `Given a real workplace situation for ${brief.audience}`,
    behavior: brief.jobTask.trim(),
    criterion: "meets the quality bar stated in the assessment spec",
  };

  const analyzeExtra: Outcome | null = /\b(and|then)\b/i.test(brief.jobTask)
    ? {
        id: nid("out"),
        kind: "terminal",
        bloom: "analyze",
        condition: "Given a flawed first draft of the work product",
        behavior: "critique it against the criterion and rewrite the failures",
        criterion: "every failing instance is marked and rewritten",
      }
    : null;

  const outcomes = analyzeExtra
    ? [enabling, terminal, analyzeExtra]
    : [enabling, terminal];

  const assessments: AssessmentSpec[] = outcomes
    .filter((outcome) => outcome.kind === "terminal")
    .map((outcome) => {
      const format =
        outcome.bloom === "remember" || outcome.bloom === "understand"
          ? "conversation"
          : "artifact";
      const assessDelivery =
        format === "artifact"
          ? pickDelivery("apply", delivery, "gdoc")
          : pickDelivery("understand", delivery, "tutor");
      const finalDelivery =
        assessDelivery === "tutor" && format === "artifact"
          ? pickArtifactDelivery(delivery) ?? assessDelivery
          : assessDelivery;
      return {
        id: nid("as"),
        outcomeId: outcome.id,
        bloom: outcome.bloom,
        format: format === "conversation" ? "conversation" : "performance",
        correctPerformance: `Learner can ${outcome.behavior} to this criterion: ${outcome.criterion}`,
        exemplarStem: `Using your own work, ${outcome.behavior}.`,
        delivery: finalDelivery,
      };
    });

  for (const outcome of outcomes) {
    if (outcome.kind === "terminal") {
      outcome.assessmentId = assessments.find(
        (assessment) => assessment.outcomeId === outcome.id,
      )?.id;
    }
  }

  const lessons: Lesson[] = outcomes.map((outcome) => {
    const chosen = pickDelivery(outcome.bloom, delivery, "rise");
    const assessment = assessments.find(
      (item) => item.outcomeId === outcome.id,
    );
    const supplements: DeliveryTarget[] = [];
    if (
      outcome.kind === "terminal" &&
      chosen === "tutor" &&
      delivery.includes("canvas")
    ) {
      supplements.push("canvas");
    }
    if (chosen === "video" && delivery.includes("gslides")) {
      supplements.push("gslides");
    }
    return {
      id: nid("les"),
      title: titleFor(outcome),
      objectiveIds: [outcome.id],
      estimatedMinutes: minutesFor(chosen),
      delivery: chosen,
      supplements,
      units: unitsFor(chosen, brief.jobTask),
      assessmentId: assessment?.id,
    };
  });

  const project: IdProject = {
    id: nid("prj"),
    createdAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    outline: {
      status: "draft",
      brief: { ...brief, delivery },
      outcomes,
      assessments,
      modules: [
        {
          id: nid("mod"),
          title: brief.title.trim() || "Course",
          lessonIds: lessons.map((lesson) => lesson.id),
        },
      ],
      lessons,
      filters: [],
    },
    team: defaultTeam(),
    estimate: {
      asOf: new Date().toISOString(),
      basis: "prior",
      learnerMinutes: brief.durationMinutes,
      p50Hours: 0,
      p90Hours: 0,
      calendarDays: 0,
      bottleneck: "",
      p50CostUsd: 0,
      p90CostUsd: 0,
      buckets: [],
      notes: [],
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

function titleFor(outcome: Outcome): string {
  const verb = outcome.behavior.split(/\s+/).slice(0, 8).join(" ");
  return verb.charAt(0).toUpperCase() + verb.slice(1);
}
