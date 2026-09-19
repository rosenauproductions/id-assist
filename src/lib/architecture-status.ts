// Living status snapshot of ID Assist's pipeline, rendered at /architecture.
// This is plain data — no server/client split needed — so updating it as
// gaps close is just editing an array here, not touching the page. Status
// values reuse the app's existing StatusPill/StatusIcon vocabulary
// (components/status.tsx) so a "blocked" chip here looks like a "blocked"
// phase-timeline card everywhere else in the app.

export type ArchStatus = "done" | "in_progress" | "blocked" | "not_started";

export type ArchChip = {
  label: string;
  status: ArchStatus;
};

export type ArchStage = {
  id: string;
  order: number;
  title: string;
  file: string;
  chips: ArchChip[];
};

export type ArchGap = {
  id: string;
  title: string;
  detail: string;
  status: ArchStatus;
};

export type ArchNote = {
  label: string;
  detail: string;
};

// Bump this whenever the arrays below change so the page's "Updated" line
// stays honest.
export const ARCHITECTURE_UPDATED_AT = "2026-09-18";  // lesson-content editor shipped

export const PIPELINE_STAGES: ArchStage[] = [
  {
    id: "gather",
    order: 1,
    title: "Gather",
    file: "wizard/brief-wizard.tsx, interview/actions.ts",
    chips: [
      { label: "Brief Wizard — 7-step course-brief form", status: "done" },
      { label: "SME Interview — token-shared link", status: "done" },
      { label: "briefReady() gate before compile", status: "done" },
    ],
  },
  {
    id: "organize",
    order: 2,
    title: "Organize",
    file: "lib/id/compile.ts",
    chips: [
      { label: "compileBrief() — deterministic, no LLM", status: "done" },
      { label: "1 lesson per outcome, single module", status: "done" },
      { label: "Gagné-event units from fixed templates", status: "done" },
      { label: "Direct edit of unit content", status: "done" },
    ],
  },
  {
    id: "scrutinize",
    order: 3,
    title: "Scrutinize",
    file: "lib/id/filters.ts, requirements.ts, refine.ts",
    chips: [
      { label: "runFilters() — rule-based pedagogy audit", status: "done" },
      { label: "Phase-scoped requirements checklist", status: "done" },
      { label: "Refine with AI — resets approval on use", status: "in_progress" },
    ],
  },
  {
    id: "map",
    order: 4,
    title: "Map",
    file: "components/flowchart-map.tsx",
    chips: [
      { label: "Construction view — real flowchart", status: "done" },
      { label: "Alignment view", status: "not_started" },
      { label: "Learner Path view", status: "not_started" },
    ],
  },
  {
    id: "assemble-deliver",
    order: 5,
    title: "Assemble & Deliver",
    file: "lib/id/adapters.ts, api/.../artifacts",
    chips: [
      { label: 'Gated on outline.status === "approved"', status: "done" },
      { label: "Rise / Canvas / GDoc / GSlides / video / tutor-pack", status: "in_progress" },
      { label: "Markdown only — no live API, no zip", status: "in_progress" },
    ],
  },
];

export const GAPS: ArchGap[] = [
  {
    id: "map-stubs",
    title: "Two of three Map views are stubs",
    detail:
      "Only Construction (the flowchart) is real. Alignment and Learner Path render placeholder text — nothing computes them yet.",
    status: "not_started",
  },
  {
    id: "delivery-copy-paste",
    title: '"Delivery" means copy-paste',
    detail:
      "Every target — Rise, Canvas, video script, Google Doc, Google Slides, tutor-coach pack — is a Markdown build sheet. None of it calls Rise, Canvas, or Google's APIs.",
    status: "not_started",
  },
  {
    id: "soft-approval",
    title: "Approval doesn't lock anything",
    detail:
      "Approving just unlocks downloads. The next edit — even a small tweak to the title, minutes, or delivery mix, or running AI refine — silently sends the outline back to review and clears out any delivery files you'd already generated.",
    status: "not_started",
  },
  {
    id: "no-unit-editor",
    title: "Lesson content is now hand-editable",
    detail:
      "Each Gagné-event beat in a lesson has its own content field (project-workspace.tsx's LessonEditor, saved by updateLessonAction). Every generated artifact and the live tutor prompt use the written content once it's non-empty, falling back to the auto-generated label until then (see unitText() in lib/id/types.ts).",
    status: "done",
  },
];

export const CROSS_CUTTING: ArchNote[] = [
  {
    label: "Tenancy",
    detail: "Workspace/team scoping is real and enforced everywhere a project is read or written.",
  },
  {
    label: "Time & cost",
    detail: "estimate.ts is fully live and feeds the Time/Cost tab directly from the compiled outline.",
  },
  {
    label: "ADDIE / SAM toggle",
    detail: "Purely cosmetic today — no code branches on it. Reserved for future Alignment/Learner-Path routing.",
  },
];
