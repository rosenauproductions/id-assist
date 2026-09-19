import type {
  Bloom,
  CourseOutline,
  DeliveryTarget,
  FilterHit,
  Lesson,
  Outcome,
} from "./types";
import { nid } from "./ids";

const HOLLOW_VERBS = /\b(understand|know|learn|be aware|appreciate|be familiar)\b/i;

const PRACTICE_OK: Record<Bloom, DeliveryTarget[]> = {
  remember: ["rise", "canvas", "gslides", "tutor"],
  understand: ["rise", "gslides", "video", "gdoc", "tutor"],
  apply: ["rise", "gdoc", "canvas", "tutor", "video"],
  analyze: ["rise", "tutor", "gdoc", "canvas"],
  evaluate: ["tutor", "gdoc", "canvas", "rise"],
  create: ["gdoc", "canvas", "tutor", "rise"],
};

function hit(
  severity: FilterHit["severity"],
  code: string,
  targetId: string,
  message: string,
  suggestion: string,
): FilterHit {
  return {
    id: nid("flt"),
    severity,
    code,
    targetId,
    message,
    suggestion,
    resolved: severity === "pass",
  };
}

function lessonObjectives(outline: CourseOutline, lesson: Lesson): Outcome[] {
  return lesson.objectiveIds
    .map((id) => outline.outcomes.find((outcome) => outcome.id === id))
    .filter((outcome): outcome is Outcome => Boolean(outcome));
}

export function runFilters(outline: CourseOutline): FilterHit[] {
  const hits: FilterHit[] = [];

  if (!outline.brief.whyNow.trim()) {
    hits.push(
      hit(
        "block",
        "andragogy.why_now",
        "brief",
        "Adult learners need a job-relevant “why now.” The brief has none.",
        "Add the workplace consequence of not doing this.",
      ),
    );
  } else {
    hits.push(
      hit(
        "pass",
        "andragogy.why_now",
        "brief",
        "Why-now is present.",
        "Keep it visible in the first lesson.",
      ),
    );
  }

  if (outline.brief.durationMinutes <= 0) {
    hits.push(
      hit(
        "block",
        "duration.missing",
        "brief",
        "Duration budget is missing.",
        "Set a hard learner-minute budget.",
      ),
    );
  }

  const seat = outline.lessons.reduce(
    (sum, lesson) => sum + lesson.estimatedMinutes,
    0,
  );
  if (
    outline.brief.durationMinutes > 0 &&
    seat > outline.brief.durationMinutes + 2
  ) {
    hits.push(
      hit(
        "split",
        "duration.over",
        "course",
        `Lessons sum to ${seat} min against a ${outline.brief.durationMinutes} min budget.`,
        "Cut a supporting lesson or shorten video. Do not densify copy.",
      ),
    );
  }

  for (const outcome of outline.outcomes) {
    const text = `${outcome.behavior} ${outcome.criterion}`;
    if (HOLLOW_VERBS.test(text) || !outcome.criterion.trim()) {
      hits.push(
        hit(
          "rewrite",
          "objective.quality",
          outcome.id,
          "This objective isn't measurable yet — it's missing an observable verb or a clear standard.",
          "Rewrite it as: given [the situation], [an observable action], to [a clear standard].",
        ),
      );
    }

    const boundLessons = outline.lessons.filter((lesson) =>
      lesson.objectiveIds.includes(outcome.id),
    );
    if (boundLessons.length === 0) {
      hits.push(
        hit(
          "block",
          "outcome.uncovered",
          outcome.id,
          "This objective has no lesson teaching it yet.",
          "Add a lesson bound to this objective, or drop it from the brief.",
        ),
      );
    } else if (
      boundLessons.every(
        (lesson) => !lesson.units.some((unit) => unit.gagne === "elicit"),
      )
    ) {
      hits.push(
        hit(
          "rewrite",
          "objective.no_activity",
          outcome.id,
          "This objective has a lesson but no guided-practice activity in it.",
          "Add a practice step — a guided attempt or try-it — before the test.",
        ),
      );
    }

    if (outcome.kind === "terminal") {
      const evidence = outline.assessments.find(
        (assessment) => assessment.outcomeId === outcome.id,
      );
      if (!evidence) {
        hits.push(
          hit(
            "block",
            "coverage.missing",
            outcome.id,
            "This is one of the course's final objectives, but it has no test attached yet.",
            "Add a way to prove they've hit this Bloom level — not just a quick check.",
          ),
        );
      } else if (
        BLOOM_RANK[evidence.bloom] < BLOOM_RANK[outcome.bloom]
      ) {
        hits.push(
          hit(
            "rewrite",
            "alignment.bloom",
            outcome.id,
            `This objective is set at "${outcome.bloom}" but the test only proves "${evidence.bloom}."`,
            "Either make the test harder to match the objective, or ease the objective to match the test.",
          ),
        );
      } else {
        hits.push(
          hit(
            "pass",
            "coverage.ok",
            outcome.id,
            "This final objective has a test that actually proves it.",
            "Keep practice at this level.",
          ),
        );
      }

      if (
        evidence &&
        ["apply", "analyze", "evaluate", "create"].includes(outcome.bloom) &&
        evidence.format === "conversation"
      ) {
        hits.push(
          hit(
            "block",
            "tutor.evidence",
            evidence.id,
            "For an objective at this level, a chat conversation alone isn't enough proof.",
            "Keep the tutor for practice; attach a Doc, Canvas assignment, or performance artifact.",
          ),
        );
      }

      if (
        evidence &&
        ["apply", "analyze", "evaluate", "create"].includes(outcome.bloom) &&
        evidence.delivery === "tutor"
      ) {
        hits.push(
          hit(
            "block",
            "coverage.no_artifact_channel",
            evidence.id,
            "An objective at this level needs real proof — a Doc, Canvas page, or Rise module — not just the chat tutor by itself.",
            "Add at least one non-tutor delivery channel so this evidence has somewhere to live.",
          ),
        );
      }

      if (
        evidence &&
        evidence.targetItemCount !== undefined &&
        evidence.actualItemCount !== undefined
      ) {
        if (evidence.actualItemCount < evidence.targetItemCount) {
          hits.push(
            hit(
              "block",
              "assessment.item_count_gap",
              evidence.id,
              `Assessment has ${evidence.actualItemCount} item(s) but requirements specify ${evidence.targetItemCount}.`,
              `Add ${evidence.targetItemCount - evidence.actualItemCount} more item(s), or lower the target if the spec changed.`,
            ),
          );
        } else {
          hits.push(
            hit(
              "pass",
              "assessment.item_count_ok",
              evidence.id,
              `Assessment item count meets the requirement (${evidence.actualItemCount}/${evidence.targetItemCount}).`,
              "Keep the count in sync if the requirement changes.",
            ),
          );
        }
      }
    }
  }

  for (const lesson of outline.lessons) {
    const objectives = lessonObjectives(outline, lesson);
    if (objectives.length === 0) {
      hits.push(
        hit(
          "block",
          "lesson.orphan",
          lesson.id,
          "Lesson has no objective.",
          "Bind at least one objective.",
        ),
      );
      continue;
    }
    // Bloom-based practice/delivery checks below key off the lesson's
    // primary (first) objective. Generation still produces one objective
    // per lesson today; true per-objective Bloom validation for
    // multi-objective lessons is Alignment-view work (roadmap Phase 2),
    // not part of this migration.
    const objective = objectives[0];

    const stacked = lesson.objectiveIds.some(
      (id) =>
        outline.lessons.filter((other) => other.objectiveIds.includes(id))
          .length > 1,
    );
    if (stacked) {
      hits.push(
        hit(
          "split",
          "lesson.stacked",
          lesson.id,
          "More than one lesson claims this objective.",
          "Split objectives or merge lessons.",
        ),
      );
    }

    if (lesson.estimatedMinutes < 5 || lesson.estimatedMinutes > 12) {
      hits.push(
        hit(
          "rewrite",
          "chunk.size",
          lesson.id,
          `Lesson is ${lesson.estimatedMinutes} min (target 5–9, hard cap 12).`,
          "Split this into smaller pieces instead of watering down the objective to make it fit.",
        ),
      );
    }

    if (
      lesson.delivery === "rise" &&
      (lesson.units.length < 3 || lesson.units.length > 8)
    ) {
      hits.push(
        hit(
          "rewrite",
          "rise.blocks",
          lesson.id,
          `Rise lesson has ${lesson.units.length} blocks (need 3–8).`,
          "Add or cut blocks; keep one objective.",
        ),
      );
    }

    const allowed = PRACTICE_OK[objective.bloom];
    if (!allowed.includes(lesson.delivery)) {
      hits.push(
        hit(
          "rewrite",
          "delivery.mismatch",
          lesson.id,
          `"${lesson.delivery}" isn't a strong way to practice a "${objective.bloom}"-level objective.`,
          `Prefer: ${allowed.join(", ")}.`,
        ),
      );
    }

    if (
      objective.bloom !== "remember" &&
      lesson.units.some((unit) => unit.riseBlock === "flashcards")
    ) {
      hits.push(
        hit(
          "rewrite",
          "bloom.flashcards",
          lesson.id,
          "Flashcards aren't enough practice for an objective at this level.",
          "Swap to contrast, scenario, process, or try-prompt.",
        ),
      );
    }
  }

  // Module-level rollup: this is the "Module 2 has three objectives but
  // only two activities" quantity check — counts objectives this module's
  // lessons actually cover against how many of those lessons have a real
  // practice activity (a guided-attempt/elicit unit), not just content.
  for (const courseModule of outline.modules) {
    const moduleLessons = outline.lessons.filter((lesson) =>
      courseModule.lessonIds.includes(lesson.id),
    );
    const coveredOutcomeIds = new Set(
      moduleLessons.flatMap((lesson) => lesson.objectiveIds),
    );
    const moduleOutcomeCount = outline.outcomes.filter((outcome) =>
      coveredOutcomeIds.has(outcome.id),
    ).length;
    const activityCount = moduleLessons.filter((lesson) =>
      lesson.units.some((unit) => unit.gagne === "elicit"),
    ).length;
    if (moduleOutcomeCount > 0 && activityCount < moduleOutcomeCount) {
      hits.push(
        hit(
          "rewrite",
          "module.objective_gap",
          courseModule.id,
          `Module “${courseModule.title}” has ${moduleOutcomeCount} objective(s) but only ${activityCount} lesson(s) with a practice activity.`,
          "Add a guided-practice activity for every objective in this module before calling it ready.",
        ),
      );
    }
  }

  return hits;
}

const BLOOM_RANK: Record<Bloom, number> = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
  create: 6,
};

export function outlineStatus(filters: FilterHit[]): CourseOutline["status"] {
  if (filters.some((filter) => filter.severity === "block" && !filter.resolved)) {
    return "needs_review";
  }
  if (
    filters.some(
      (filter) =>
        (filter.severity === "rewrite" || filter.severity === "split") &&
        !filter.resolved,
    )
  ) {
    return "needs_review";
  }
  return "draft";
}

export function canApprove(filters: FilterHit[]): boolean {
  return !filters.some(
    (filter) => filter.severity === "block" && !filter.resolved,
  );
}
