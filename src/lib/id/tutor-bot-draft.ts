import { generateText, Output } from "ai";
import { z } from "zod";
import { hasLanguageModel, withLanguageModel } from "./model";
import { nid } from "./ids";
import {
  unitText,
  type AssessmentSpec,
  type CourseBrief,
  type Lesson,
  type Outcome,
  type TutorConcept,
  type TutorQuizItem,
} from "./types";

const BLOOM_TITLE_CASE = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
] as const;

const draftedQuizItemSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(5),
  correct: z.number().min(0),
  explanation: z.string(),
});

const draftedConceptSchema = z.object({
  title: z.string(),
  bloom: z.enum(BLOOM_TITLE_CASE),
  /** Titles of other concepts in this same draft that must be understood
   * first — resolved to real ids after generation. Referencing by title
   * rather than by index/id avoids the classic "wrong integer index"
   * failure mode structured LLM output is prone to (see import-outline.ts). */
  prerequisiteTitles: z.array(z.string()),
  content: z.string(),
  quiz: z.array(draftedQuizItemSchema).min(1).max(3),
});

const draftSchema = z.object({
  concepts: z.array(draftedConceptSchema).min(2).max(6),
});

/** Draft a first-pass set of tutor-bot concepts (with content and quiz
 * questions) from a lesson's own objective(s), assessment, and content
 * units — so linking a tutor bot to a lesson starts from something real
 * instead of one empty placeholder concept. The person still reviews and
 * edits everything in the Knowledge Creator editor before ever exporting;
 * this only changes what it starts from. */
export async function draftTutorConcepts({
  lesson,
  objectives,
  assessment,
  brief,
}: {
  lesson: Lesson;
  objectives: Outcome[];
  assessment: AssessmentSpec | undefined;
  brief: CourseBrief;
}): Promise<TutorConcept[]> {
  if (!hasLanguageModel()) {
    throw new Error(
      "No AI model is configured for this deployment. Set GOOGLE_GENERATIVE_AI_API_KEY (or another supported provider) in the environment.",
    );
  }

  const objectiveLines = objectives.length
    ? objectives
        .map(
          (objective) =>
            `${objective.condition}; ${objective.behavior}. Criterion: ${objective.criterion}`,
        )
        .join(" | ")
    : "none";

  const beats = lesson.units.length
    ? lesson.units.map((unit) => `${unit.gagne}: ${unitText(unit)}`).join(" | ")
    : "none";

  const { output } = await withLanguageModel((model) =>
    generateText({
      model,
      output: Output.object({ schema: draftSchema }),
      prompt: `You are an instructional designer converting one lesson into a self-paced knowledge-tutor bot. The bot steps a learner through a sequence of small concepts, gated by a quiz: a concept only unlocks once its prerequisites are mastered, and only counts as mastered once every quiz question about it is answered correctly.

Break this lesson into 2-6 teachable concepts, ordered so a learner can move through them in a sensible sequence. For each concept, write 2-4 sentences of real, grounded content — use only what's stated below (the objective, the assessment, the lesson's own beats); do not invent facts the lesson doesn't support. Then write 1-3 short multiple-choice quiz questions per concept whose correct answer is directly checkable from that concept's own content.

For prerequisiteTitles, list the titles of other concepts in this same set that a learner must understand first — use the exact title text you gave that concept. Leave it empty for a foundational concept with no prerequisite.

Course: ${brief.title}
Audience: ${brief.audience}

Lesson: ${lesson.title}
Objective(s): ${objectiveLines}
Evidence: ${assessment ? `${assessment.format} — ${assessment.correctPerformance}` : "none (enabling)"}
Beats: ${beats}

Return JSON matching the schema.`,
    }),
  );

  if (!output) {
    throw new Error("Model returned no structured tutor-bot draft.");
  }

  const idByTitle = new Map<string, string>();
  const drafted = output.concepts.map((concept) => {
    const id = nid("concept");
    idByTitle.set(concept.title, id);
    return { id, concept };
  });

  return drafted.map(({ id, concept }) => {
    const prerequisites = concept.prerequisiteTitles
      .map((title) => [title, idByTitle.get(title)] as const)
      .filter((pair): pair is [string, string] => {
        const [title, id] = pair;
        if (id) return true;
        console.error(
          `draftTutorConcepts: dropping unresolved prerequisite title "${title}" for concept "${concept.title}"`,
        );
        return false;
      })
      .map(([, id]) => id);

    const quiz: TutorQuizItem[] = concept.quiz.map((item) => ({
      type: "multiple",
      question: item.question,
      options: item.options,
      correct: item.correct,
      explanation: item.explanation,
    }));

    const result: TutorConcept = {
      id,
      type: "concept",
      title: concept.title,
      bloom: concept.bloom,
      bloomApproved: false,
      prerequisites,
      content: concept.content,
      quiz,
    };
    return result;
  });
}
