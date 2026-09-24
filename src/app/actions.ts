"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateArtifacts } from "@/lib/id/adapters";
import { briefReady, type BriefDraft } from "@/lib/id/brief-validate";
import { compileBrief, unitsFor } from "@/lib/id/compile";
import { estimateProject } from "@/lib/id/estimate";
import { canApprove, outlineStatus, runFilters } from "@/lib/id/filters";
import { nid } from "@/lib/id/ids";
import { capitalizeFirst } from "@/lib/id/labels";
import { importOutlineFromText } from "@/lib/id/import-outline";
import { refineOutlineWithModel } from "@/lib/id/refine";
import { mergeRequirements } from "@/lib/id/requirements";
import { deleteProject, loadProject, saveProject } from "@/lib/id/store";
import { addAcceptableRule } from "@/lib/id/acceptable-rules";
import { requireWorkspaceContext } from "@/lib/team/store";
import {
  ADDIE_PHASES,
  BLOOM_LEVELS,
  COURSE_PHASES,
  DELIVERY_TARGETS,
  SAM_PHASES,
  TIME_PHASES,
  type AssessmentSpec,
  type Bloom,
  type CourseMode,
  type CoursePhase,
  type DeliveryTarget,
  type Lesson,
  type MethodologyPhase,
  type PhaseStatus,
  type RequirementPriority,
  type SmeEngagement,
  type TimePhase,
  type TutorBot,
  type TutorConcept,
} from "@/lib/id/types";

function parseDelivery(formData: FormData): DeliveryTarget[] {
  return DELIVERY_TARGETS.filter((target) => formData.get(`delivery-${target}`) === "on");
}

function refilter(project: Awaited<ReturnType<typeof loadProject>>) {
  if (!project) return;
  project.outline.filters = runFilters(project.outline);
  if (project.outline.status !== "approved") {
    project.outline.status = outlineStatus(project.outline.filters);
  }
  project.estimate = estimateProject(project);
  project.requirements = mergeRequirements(project.requirements ?? [], project);
}

export async function createProjectAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const jobTask = String(formData.get("jobTask") ?? "").trim();
  if (!title || !audience || !jobTask) {
    throw new Error("Title, audience, and job task are required.");
  }

  const project = compileBrief({
    title,
    audience,
    jobTask,
    whyNow: String(formData.get("whyNow") ?? "").trim(),
    durationMinutes: Number(formData.get("durationMinutes") ?? 25) || 25,
    constraints: String(formData.get("constraints") ?? "").trim(),
    delivery: parseDelivery(formData),
  });

  await saveProject(project);
  redirect(`/projects/${project.id}`);
}

export async function createProjectFromDraftAction(draft: BriefDraft) {
  if (!briefReady(draft)) {
    throw new Error("Brief still has quality issues. Finish the wizard checks.");
  }
  const project = compileBrief({
    title: draft.title.trim(),
    audience: draft.audience.trim(),
    jobTask: draft.jobTask.trim(),
    whyNow: draft.whyNow.trim(),
    durationMinutes: draft.durationMinutes || 25,
    constraints: draft.constraints.trim() || "None",
    delivery: draft.delivery.length ? draft.delivery : [...DELIVERY_TARGETS],
  });
  await saveProject(project);
  return project.id;
}

export async function importOutlineAction(rawText: string): Promise<string> {
  const project = await importOutlineFromText(rawText);
  await saveProject(project);
  return project.id;
}

export async function approveProjectAction(projectId: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  project.outline.filters = runFilters(project.outline);
  if (!canApprove(project.outline.filters)) {
    throw new Error("Resolve blocking filters before approval.");
  }
  project.outline.status = "approved";
  project.estimate = estimateProject(project);
  project.requirements = mergeRequirements(project.requirements ?? [], project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function reopenOutlineAction(projectId: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  project.outline.status = outlineStatus(project.outline.filters);
  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
  }
  project.artifacts = [];
  project.estimate = estimateProject(project);
  project.requirements = mergeRequirements(project.requirements ?? [], project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function generateArtifactsAction(projectId: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  if (project.outline.status !== "approved") {
    throw new Error("Approve the outline before creating delivery files.");
  }
  project.artifacts = generateArtifacts(project);
  project.requirements = mergeRequirements(project.requirements ?? [], project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function refineOutlineAction(projectId: string) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const refined = await refineOutlineWithModel(project);
  refilter(refined);
  await saveProject(refined);
  revalidatePath(`/projects/${projectId}`);
}

export async function dismissFilterAction(
  projectId: string,
  filterId: string,
  reason: string,
) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const filter = project.outline.filters.find((item) => item.id === filterId);
  if (!filter) throw new Error("Filter not found");
  if (filter.severity === "block") {
    throw new Error("Blocking filters cannot be dismissed.");
  }
  filter.resolved = true;
  filter.dismissReason = reason.trim() || "accepted";
  project.outline.status =
    project.outline.status === "approved"
      ? "approved"
      : outlineStatus(project.outline.filters);
  project.estimate = estimateProject(project);
  project.requirements = mergeRequirements(project.requirements ?? [], project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

/** The other half of the right-click flag-marker menu: "Always allow this
 * issue" — mutes this filter code for the whole workspace going forward
 * (Settings → Acceptable issues manages the list) and immediately
 * resolves every currently-open hit with that code on this project, not
 * just future ones. */
export async function alwaysAllowFilterAction(projectId: string, filterCode: string) {
  const { workspaceId, userId } = await requireWorkspaceContext();
  await addAcceptableRule(workspaceId, filterCode, userId);

  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  for (const filter of project.outline.filters) {
    if (!filter.resolved && filter.code === filterCode) {
      filter.resolved = true;
      filter.dismissReason = "Always allowed (workspace rule)";
    }
  }
  project.outline.status =
    project.outline.status === "approved"
      ? "approved"
      : outlineStatus(project.outline.filters);
  project.estimate = estimateProject(project);
  project.requirements = mergeRequirements(project.requirements ?? [], project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateOutcomeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const outcomeId = String(formData.get("outcomeId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const outcome = project.outline.outcomes.find((item) => item.id === outcomeId);
  if (!outcome) throw new Error("Outcome not found");

  const bloom = String(formData.get("bloom") ?? outcome.bloom);
  if ((BLOOM_LEVELS as readonly string[]).includes(bloom)) {
    outcome.bloom = bloom as Bloom;
  }
  outcome.condition = String(formData.get("condition") ?? outcome.condition).trim();
  outcome.behavior = String(formData.get("behavior") ?? outcome.behavior).trim();
  outcome.criterion = String(formData.get("criterion") ?? outcome.criterion).trim();

  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
    project.artifacts = [];
  }
  refilter(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateLessonAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const lesson = project.outline.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error("Lesson not found");

  lesson.title = String(formData.get("title") ?? lesson.title).trim() || lesson.title;
  lesson.estimatedMinutes =
    Number(formData.get("estimatedMinutes") ?? lesson.estimatedMinutes) ||
    lesson.estimatedMinutes;
  const delivery = String(formData.get("delivery") ?? lesson.delivery);
  if ((DELIVERY_TARGETS as readonly string[]).includes(delivery)) {
    lesson.delivery = delivery as DeliveryTarget;
  }

  for (const unitItem of lesson.units) {
    const raw = formData.get(`unit-content-${unitItem.id}`);
    if (raw === null) continue;
    const trimmed = String(raw).trim();
    unitItem.content = trimmed === "" ? undefined : trimmed;
  }

  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
    project.artifacts = [];
  }
  refilter(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateAssessmentCountsAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const assessment = project.outline.assessments.find(
    (item) => item.id === assessmentId,
  );
  if (!assessment) throw new Error("Assessment not found");

  const targetRaw = String(formData.get("targetItemCount") ?? "").trim();
  const actualRaw = String(formData.get("actualItemCount") ?? "").trim();
  assessment.targetItemCount =
    targetRaw === "" ? undefined : Math.max(0, Number(targetRaw) || 0);
  assessment.actualItemCount =
    actualRaw === "" ? undefined : Math.max(0, Number(actualRaw) || 0);

  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
    project.artifacts = [];
  }
  refilter(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function addRequirementAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");

  const phase = String(formData.get("phase") ?? "discovery");
  if (!(COURSE_PHASES as readonly string[]).includes(phase)) {
    throw new Error("Invalid phase");
  }
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Requirement needs a label");
  const priorityRaw = String(formData.get("priority") ?? "recommended");
  const priority: RequirementPriority = (
    ["required", "recommended", "optional"] as const
  ).includes(priorityRaw as RequirementPriority)
    ? (priorityRaw as RequirementPriority)
    : "recommended";

  project.requirements = project.requirements ?? [];
  project.requirements.push({
    id: nid("req"),
    phase: phase as CoursePhase,
    label,
    priority,
    source: "manual",
    done: false,
    createdAt: new Date().toISOString(),
  });
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleRequirementAction(
  projectId: string,
  requirementId: string,
) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const item = (project.requirements ?? []).find(
    (candidate) => candidate.id === requirementId,
  );
  if (!item) throw new Error("Requirement not found");
  if (item.source !== "manual") {
    throw new Error(
      "This item is auto-tracked and reflects the outline's real state.",
    );
  }
  item.done = !item.done;
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteRequirementAction(
  projectId: string,
  requirementId: string,
) {
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  project.requirements = (project.requirements ?? []).filter(
    (item) => !(item.id === requirementId && item.source === "manual"),
  );
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateMethodologyAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");

  const mode = String(formData.get("mode") ?? "");
  if (mode !== "addie" && mode !== "sam") {
    throw new Error("Invalid course mode");
  }
  const phase = String(formData.get("phase") ?? "");
  const validPhases: readonly string[] = mode === "sam" ? SAM_PHASES : ADDIE_PHASES;
  if (!validPhases.includes(phase)) {
    throw new Error("Invalid phase for mode");
  }

  project.methodology = {
    mode: mode as CourseMode,
    phase: phase as MethodologyPhase,
  };

  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function setPhaseProgressAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");

  const phase = String(formData.get("phase") ?? "");
  if (!(COURSE_PHASES as readonly string[]).includes(phase)) {
    throw new Error("Invalid phase");
  }
  const percentRaw = String(formData.get("percent") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();

  project.phaseProgress =
    project.phaseProgress ?? COURSE_PHASES.map((item) => ({ phase: item }));
  let entry = project.phaseProgress.find((item) => item.phase === phase);
  if (!entry) {
    entry = { phase: phase as CoursePhase };
    project.phaseProgress.push(entry);
  }

  if (percentRaw === "") {
    delete entry.manualPercent;
  } else {
    entry.manualPercent = Math.max(0, Math.min(100, Number(percentRaw) || 0));
  }

  const validStatuses: PhaseStatus[] = [
    "not_started",
    "in_progress",
    "blocked",
    "done",
  ];
  if (statusRaw === "" || statusRaw === "auto") {
    delete entry.manualStatus;
  } else if (validStatuses.includes(statusRaw as PhaseStatus)) {
    entry.manualStatus = statusRaw as PhaseStatus;
  }

  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function logTimeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");

  const hours = Number(formData.get("hours") ?? 0);
  if (!hours || hours <= 0) throw new Error("Hours must be > 0");

  const phase = String(formData.get("phase") ?? "develop");
  if (!(TIME_PHASES as readonly string[]).includes(phase)) {
    throw new Error("Invalid phase");
  }

  const lessonId = String(formData.get("lessonId") ?? "").trim();
  project.timeLogs = project.timeLogs ?? [];
  project.timeLogs.push({
    id: nid("time"),
    lessonId: lessonId || undefined,
    phase: phase as TimePhase,
    hours,
    note: String(formData.get("note") ?? "").trim(),
    loggedAt: new Date().toISOString(),
  });
  project.estimate = estimateProject(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateSmeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");

  const sme = project.team.find(
    (resource) => resource.kind === "human" && resource.roles.includes("SME"),
  );
  if (!sme || sme.kind !== "human") throw new Error("No SME on the team");

  sme.name = String(formData.get("smeName") ?? sme.name).trim() || sme.name;
  sme.hoursPerWeek = Number(formData.get("smeHours") ?? sme.hoursPerWeek) || 0;
  const kind = String(formData.get("smeKind") ?? "w2");
  if (kind === "per_project") {
    const engagement: SmeEngagement = {
      kind: "per_project",
      feeUsd: Number(formData.get("smeFee") ?? 3500) || 0,
      includedHours: Number(formData.get("smeIncludedHours") ?? 0) || undefined,
    };
    sme.sme = engagement;
  } else {
    sme.sme = { kind: "w2" };
  }

  project.estimate = estimateProject(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

// Manual add actions for the course-map sidebar's right-click menu
// (project-workspace.tsx). Each mirrors the shape compileBrief()/
// unitsFor() already produce, so a manually added lesson gets the same
// Gagne-event beat skeleton as a compiled one instead of a bare shell.

export async function addModuleAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");

  const title = String(formData.get("title") ?? "").trim() || "New module";
  project.outline.modules.push({
    id: nid("mod"),
    title,
    lessonIds: [],
  });

  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
    project.artifacts = [];
  }
  refilter(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function addLessonAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const moduleId = String(formData.get("moduleId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const courseModule = project.outline.modules.find(
    (item) => item.id === moduleId,
  );
  if (!courseModule) throw new Error("Module not found");

  const title = String(formData.get("title") ?? "").trim() || "New lesson";
  const objectiveId = String(formData.get("objectiveId") ?? "").trim();
  const objective = objectiveId
    ? project.outline.outcomes.find((item) => item.id === objectiveId)
    : undefined;
  if (objectiveId && !objective) throw new Error("Objective not found");

  const delivery: DeliveryTarget = "rise";
  const jobTask = objective ? objective.behavior : title;

  const lesson: Lesson = {
    id: nid("les"),
    title,
    objectiveIds: objective ? [objective.id] : [],
    estimatedMinutes: 6,
    delivery,
    supplements: [],
    units: unitsFor(delivery, jobTask),
  };
  project.outline.lessons.push(lesson);
  courseModule.lessonIds.push(lesson.id);

  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
    project.artifacts = [];
  }
  refilter(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

const ASSESSMENT_FORMATS: AssessmentSpec["format"][] = [
  "performance",
  "scenario",
  "quiz",
  "conversation",
  "artifact",
];

export async function addAssessmentAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const lesson = project.outline.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error("Lesson not found");
  if (lesson.assessmentId) throw new Error("This lesson already has a quiz.");

  let objectiveId = lesson.objectiveIds[0];
  if (!objectiveId) {
    objectiveId = String(formData.get("objectiveId") ?? "").trim();
    if (!objectiveId) {
      throw new Error("This lesson needs an objective before it can have a quiz.");
    }
    lesson.objectiveIds = [objectiveId];
  }
  const objective = project.outline.outcomes.find(
    (item) => item.id === objectiveId,
  );
  if (!objective) throw new Error("Objective not found");

  const formatRaw = String(formData.get("format") ?? "quiz");
  const format = (ASSESSMENT_FORMATS as string[]).includes(formatRaw)
    ? (formatRaw as AssessmentSpec["format"])
    : "quiz";

  const assessment: AssessmentSpec = {
    id: nid("as"),
    outcomeId: objective.id,
    bloom: objective.bloom,
    format,
    correctPerformance: "",
    exemplarStem: "",
    delivery: lesson.delivery,
  };
  project.outline.assessments.push(assessment);
  lesson.assessmentId = assessment.id;

  if (project.outline.status === "approved") {
    project.outline.status = "needs_review";
    project.artifacts = [];
  }
  refilter(project);
  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

// Tutor bot ("Knowledge Creator") actions — links a lesson to a
// hand-authored interactive knowledge-tutor bot, saves edits made in the
// embedded editor (tutor-bot-editor.tsx, via postMessage), and stores its
// "Export Tutor" HTML so generateArtifacts() can surface it as a
// downloadable artifact. These intentionally skip the approved -> needs_
// review guard and refilter() that structural outline edits trigger: a
// tutor bot is supplementary lesson content (same tier as hand-written
// ContentUnit.content), not outline structure the quality filters check.

export async function linkTutorBotAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const lesson = project.outline.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error("Lesson not found");
  if (lesson.tutorBotId) throw new Error("This lesson already has a tutor bot.");

  const objective = lesson.objectiveIds
    .map((id) => project.outline.outcomes.find((item) => item.id === id))
    .find((item): item is NonNullable<typeof item> => Boolean(item));

  const starterConcept: TutorConcept = {
    id: nid("concept"),
    type: "concept",
    title: objective ? capitalizeFirst(objective.behavior) : lesson.title,
    bloom: objective ? capitalizeFirst(objective.bloom) : "Understand",
    bloomApproved: false,
    prerequisites: [],
    content: "",
    quiz: [],
  };

  const bot: TutorBot = {
    id: nid("tb"),
    lessonId: lesson.id,
    version: "2.0",
    title: lesson.title,
    settings: {
      preAssessment: true,
      conversational: true,
      showKnowledgeTree: false,
      theme: "conversational",
    },
    concepts: [starterConcept],
    diagnostic: [],
    updatedAt: new Date().toISOString(),
  };

  project.outline.tutorBots.push(bot);
  lesson.tutorBotId = bot.id;

  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function saveTutorBotContentAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const tutorBotId = String(formData.get("tutorBotId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const bot = project.outline.tutorBots.find((item) => item.id === tutorBotId);
  if (!bot) throw new Error("Tutor bot not found");

  const raw = String(formData.get("data") ?? "");
  let data: Partial<TutorBot>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid tutor bot data");
  }

  bot.title = typeof data.title === "string" && data.title.trim() ? data.title : bot.title;
  if (data.settings) bot.settings = { ...bot.settings, ...data.settings };
  if (Array.isArray(data.concepts)) bot.concepts = data.concepts;
  if (Array.isArray(data.diagnostic)) bot.diagnostic = data.diagnostic;
  bot.updatedAt = new Date().toISOString();

  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function saveTutorBotExportAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const tutorBotId = String(formData.get("tutorBotId") ?? "");
  const project = await loadProject(projectId);
  if (!project) throw new Error("Project not found");
  const bot = project.outline.tutorBots.find((item) => item.id === tutorBotId);
  if (!bot) throw new Error("Tutor bot not found");

  const html = String(formData.get("html") ?? "");
  if (!html.trim()) throw new Error("Missing exported HTML");
  bot.exportedHtml = html;
  bot.exportedAt = new Date().toISOString();

  await saveProject(project);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(projectId: string) {
  await deleteProject(projectId);
  revalidatePath("/");
  revalidatePath("/app");
  revalidatePath(`/projects/${projectId}`);
}
