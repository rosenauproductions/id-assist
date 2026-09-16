import { nid } from "./ids";
import type { AssessmentSpec, GeneratedArtifact, IdProject, Lesson } from "./types";

function heading(project: IdProject): string {
  const { brief } = project.outline;
  return [
    `# ${brief.title}`,
    "",
    `Audience: ${brief.audience}`,
    `Job task: ${brief.jobTask}`,
    `Why now: ${brief.whyNow}`,
    `Seat time budget: ${brief.durationMinutes} minutes`,
    "",
  ].join("\n");
}

function assessmentEntries(assessments: AssessmentSpec[]): string[] {
  const lines: string[] = [];
  for (const assessment of assessments) {
    lines.push(
      `### ${assessment.exemplarStem}`,
      "",
      `- Bloom: ${assessment.bloom}`,
      `- Format: ${assessment.format}`,
      `- Correct performance: ${assessment.correctPerformance}`,
      "",
    );
  }
  return lines;
}

function lessonBlock(project: IdProject, lesson: Lesson): string {
  const objective = project.outline.outcomes.find(
    (outcome) => outcome.id === lesson.objectiveId,
  );
  const lines = [
    `## ${lesson.title}`,
    "",
    `- Delivery: ${lesson.delivery}${lesson.supplements.length ? ` + ${lesson.supplements.join(", ")}` : ""}`,
    `- Minutes: ${lesson.estimatedMinutes}`,
    `- Bloom: ${objective?.bloom ?? "?"}`,
    `- Objective: ${objective ? `${objective.condition}, ${objective.behavior}. Criterion: ${objective.criterion}` : "missing"}`,
    "",
  ];
  for (const unit of lesson.units) {
    lines.push(
      `- [${unit.gagne}${unit.riseBlock ? ` / ${unit.riseBlock}` : ""}] ${unit.purpose}`,
    );
  }
  return lines.join("\n");
}

function riseSheet(project: IdProject): string {
  const lessons = project.outline.lessons.filter(
    (lesson) => lesson.delivery === "rise" || lesson.supplements.includes("rise"),
  );
  const assessments = project.outline.assessments.filter(
    (assessment) => assessment.delivery === "rise",
  );
  const parts = [
    heading(project),
    "Rise build sheet (implement in Rise 360; this is not a .rise file).",
    "",
    ...lessons.map((lesson) => lessonBlock(project, lesson)),
  ];
  if (assessments.length) {
    parts.push("## Evidence to build", "", ...assessmentEntries(assessments));
  }
  return parts.join("\n");
}

function canvasMarkdown(project: IdProject): string {
  const pages = project.outline.lessons.filter(
    (lesson) =>
      lesson.delivery === "canvas" || lesson.supplements.includes("canvas"),
  );
  const assessments = project.outline.assessments.filter(
    (assessment) => assessment.delivery === "canvas",
  );
  const parts = [
    heading(project),
    "Paste each section into a Canvas page. Create a module in this order.",
    "",
  ];
  for (const lesson of pages.length ? pages : project.outline.lessons) {
    parts.push(lessonBlock(project, lesson), "");
  }
  parts.push("## Assignments / quizzes", "", ...assessmentEntries(assessments));
  return parts.join("\n");
}

function videoScript(project: IdProject): string {
  const lessons = project.outline.lessons.filter(
    (lesson) => lesson.delivery === "video" || lesson.supplements.includes("video"),
  );
  const lines = [
    heading(project),
    "Video script + shot list. No rendered video in v1.",
    "",
  ];
  let shot = 1;
  for (const lesson of lessons) {
    lines.push(`## ${lesson.title} (${lesson.estimatedMinutes} min)`, "");
    for (const unit of lesson.units) {
      lines.push(
        `### Shot ${shot} — ${unit.gagne}`,
        "",
        `On-screen: ${unit.purpose}`,
        "",
        `VO: ${unit.purpose}. Keep this beat under 75 seconds.`,
        "",
      );
      shot += 1;
    }
  }
  if (lessons.length === 0) {
    lines.push("_No lesson is assigned to video in this outline._");
  }
  return lines.join("\n");
}

function googleDoc(project: IdProject): string {
  const lessons = project.outline.lessons.filter(
    (lesson) => lesson.delivery === "gdoc" || lesson.supplements.includes("gdoc"),
  );
  const assessments = project.outline.assessments.filter(
    (assessment) => assessment.delivery === "gdoc",
  );
  const parts = [
    heading(project),
    "Google Doc source. Create in Drive when OAuth is connected; this file is the payload.",
    "",
    ...lessons.map((lesson) => lessonBlock(project, lesson)),
  ];
  if (assessments.length) {
    parts.push("## Evidence to collect", "", ...assessmentEntries(assessments));
  }
  return parts.join("\n");
}

function googleSlides(project: IdProject): string {
  const lessons = project.outline.lessons.filter(
    (lesson) =>
      lesson.delivery === "gslides" || lesson.supplements.includes("gslides"),
  );
  const lines = [
    heading(project),
    "Google Slides source. One idea per slide.",
    "",
  ];
  let n = 1;
  for (const lesson of lessons) {
    for (const unit of lesson.units) {
      lines.push(`## Slide ${n}: ${unit.purpose}`, "", `(${unit.gagne})`, "");
      n += 1;
    }
  }
  return lines.join("\n");
}

function tutorPack(project: IdProject): string {
  return [
    heading(project),
    "Live tutor curriculum pack. The in-app tutor reads the approved outline, not this file.",
    "",
    "## Guardrails",
    "",
    "- Teach only the assigned lessons.",
    "- Remember/Understand may be evidenced in conversation.",
    "- Apply/Analyze/Evaluate/Create require an artifact (Doc or Canvas).",
    "- Never invent a new terminal objective.",
    "",
    ...project.outline.lessons
      .filter((lesson) => lesson.delivery === "tutor")
      .map((lesson) => lessonBlock(project, lesson)),
  ].join("\n");
}

export function generateArtifacts(project: IdProject): GeneratedArtifact[] {
  const files: {
    delivery: GeneratedArtifact["delivery"];
    filename: string;
    body: string;
  }[] = [
    {
      delivery: "rise",
      filename: "01-rise-build-sheet.md",
      body: riseSheet(project),
    },
    {
      delivery: "canvas",
      filename: "02-canvas-pages.md",
      body: canvasMarkdown(project),
    },
    {
      delivery: "video",
      filename: "03-video-script.md",
      body: videoScript(project),
    },
    {
      delivery: "gdoc",
      filename: "04-google-doc-job-aid.md",
      body: googleDoc(project),
    },
    {
      delivery: "gslides",
      filename: "05-google-slides.md",
      body: googleSlides(project),
    },
    {
      delivery: "tutor",
      filename: "06-tutor-coach-pack.md",
      body: tutorPack(project),
    },
  ];

  const selected = new Set(project.outline.brief.delivery);
  return files
    .filter((file) => selected.has(file.delivery))
    .map((file) => ({
      id: nid("art"),
      delivery: file.delivery,
      filename: file.filename,
      body: file.body,
    }));
}
