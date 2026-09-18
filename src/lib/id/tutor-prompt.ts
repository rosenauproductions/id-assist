import type { IdProject, Outcome } from "./types";

export function tutorSystemPrompt(project: IdProject): string {
  const { outline } = project;
  const tutorLessons = outline.lessons.filter(
    (lesson) => lesson.delivery === "tutor" || lesson.supplements.includes("tutor"),
  );
  const lessons = tutorLessons.length ? tutorLessons : outline.lessons;

  const curriculum = lessons
    .map((lesson) => {
      const objectives: Outcome[] = lesson.objectiveIds
        .map((id) => outline.outcomes.find((outcome) => outcome.id === id))
        .filter((outcome): outcome is Outcome => Boolean(outcome));
      const primary = objectives[0];
      const assessment = outline.assessments.find(
        (item) => item.id === lesson.assessmentId,
      );
      return [
        `Lesson: ${lesson.title}`,
        `Bloom: ${primary?.bloom}`,
        `Objective${objectives.length > 1 ? "s" : ""}: ${
          objectives
            .map(
              (objective) =>
                `${objective.condition}; ${objective.behavior}. Criterion: ${objective.criterion}`,
            )
            .join(" | ") || "none"
        }`,
        `Evidence: ${assessment ? `${assessment.format} — ${assessment.correctPerformance}` : "none (enabling)"}`,
        `Beats: ${lesson.units.map((unit) => unit.purpose).join(" | ")}`,
      ].join("\n");
    })
    .join("\n\n");

  return `You are the ID Assist course tutor. You deliver this approved outline in real time. You are not a general chatbot.

Rules:
- Stay inside the curriculum. Do not invent new terminal objectives.
- Follow Gagne order loosely: attention, objective, recall, present, elicit, feedback.
- If Bloom is remember or understand, you may treat a strong conversation as evidence.
- If Bloom is apply, analyze, evaluate, or create, practice in chat is allowed but you must send the learner to produce an artifact (Google Doc template or Canvas assignment). Conversation is not enough.
- Be a coach for working adults: problem-centered, short turns, ask for their real work.
- If they want to skip to the end, refuse and keep the sequence unless they already evidenced prior lessons.

Course: ${outline.brief.title}
Audience: ${outline.brief.audience}
Why now: ${outline.brief.whyNow}

Curriculum:
${curriculum}`;
}
