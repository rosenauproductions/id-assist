export const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;

export type Bloom = (typeof BLOOM_LEVELS)[number];

export const DELIVERY_TARGETS = [
  "rise",
  "canvas",
  "gdoc",
  "gslides",
  "video",
  "tutor",
] as const;

export type DeliveryTarget = (typeof DELIVERY_TARGETS)[number];

export const GAGNE_EVENTS = [
  "attention",
  "objectives",
  "recall",
  "present",
  "guide",
  "elicit",
  "feedback",
  "assess",
  "retain",
] as const;

export type GagneEvent = (typeof GAGNE_EVENTS)[number];

export type FilterSeverity = "pass" | "rewrite" | "split" | "block";

export type OutlineStatus = "draft" | "needs_review" | "approved";

export type RiseBlockKind =
  | "statement"
  | "text"
  | "accordion"
  | "process"
  | "scenario"
  | "flashcards"
  | "knowledge-check"
  | "continue"
  | "checklist"
  | "labeled-graphic";

export type CourseBrief = {
  title: string;
  audience: string;
  jobTask: string;
  whyNow: string;
  durationMinutes: number;
  constraints: string;
  delivery: DeliveryTarget[];
};

export type Outcome = {
  id: string;
  kind: "terminal" | "enabling";
  bloom: Bloom;
  condition: string;
  behavior: string;
  criterion: string;
  assessmentId?: string;
};

export type AssessmentSpec = {
  id: string;
  outcomeId: string;
  bloom: Bloom;
  format: "performance" | "scenario" | "quiz" | "conversation" | "artifact";
  correctPerformance: string;
  exemplarStem: string;
  delivery: DeliveryTarget;
  /**
   * Optional target/actual item counts (e.g. "quiz should have 25
   * questions"). Left undefined until someone sets them; filters.ts only
   * flags a gap once both are present.
   */
  targetItemCount?: number;
  actualItemCount?: number;
};

export type ContentUnit = {
  id: string;
  purpose: string;
  gagne: GagneEvent;
  delivery: DeliveryTarget;
  riseBlock?: RiseBlockKind;
  /**
   * The actual instructional content for this beat — script, narration,
   * bullet points, whatever the ID/SME writes by hand. `purpose` stays a
   * short structural label generated at compile time; this is empty until
   * a person fills it in via the Lesson editor. Every generated artifact
   * (adapters.ts) and the live tutor prompt (tutor-prompt.ts) prefer this
   * over `purpose` once it's non-empty — see unitText() below.
   */
  content?: string;
};

/** The text a generated artifact or the live tutor should show for a unit:
 * the hand-written content once someone's written it, otherwise the
 * auto-generated purpose label. Centralized so every export stays in sync
 * once content editing lands. */
export function unitText(unit: ContentUnit): string {
  const written = unit.content?.trim();
  return written ? written : unit.purpose;
}

export type FilterHit = {
  id: string;
  severity: FilterSeverity;
  code: string;
  targetId: string;
  message: string;
  suggestion: string;
  resolved: boolean;
  dismissReason?: string;
};

export type TutorQuizItem = {
  type: "multiple" | "short";
  question: string;
  options?: string[];
  answers?: string[];
  correct?: number;
  explanation: string;
};

export type TutorConcept = {
  id: string;
  type: "concept" | "plugin";
  title: string;
  /**
   * The Knowledge Creator tool stores this as Title Case free text
   * ("Remember" ... "Create"), not the lowercase Bloom union used
   * elsewhere in the outline — kept as the tool's own shape rather than
   * coerced, since a bot's concepts are hand-authored independently of
   * the outline's Bloom-gated objectives.
   */
  bloom: string;
  bloomApproved: boolean;
  prerequisites: string[];
  content: string;
  quiz: TutorQuizItem[];
  plugin?: string;
  widget?: string;
  config?: Record<string, unknown>;
};

export type TutorDiagnosticItem = {
  id: string;
  question: string;
  type: "multiple" | "short";
  options?: string[];
  correct?: number;
  answers?: string[];
  linkedConcepts: string[];
  explanation: string;
};

/**
 * A hand-authored interactive "knowledge tutor" bot linked to one lesson
 * (see Lesson.tutorBotId). Built and edited via the embedded Knowledge
 * Creator tool (public/tutor-builder/), which owns the concepts/
 * diagnostic/settings shape below — kept 1:1 with its own JSON export so
 * the postMessage bridge in tutor-bot-editor.tsx never has to translate.
 */
export type TutorBot = {
  id: string;
  lessonId: string;
  version: string;
  title: string;
  settings: {
    preAssessment: boolean;
    conversational: boolean;
    showKnowledgeTree: boolean;
    theme: string;
  };
  concepts: TutorConcept[];
  diagnostic: TutorDiagnosticItem[];
  /** Last "Export Tutor" output from the tool; feeds generateArtifacts(). */
  exportedHtml?: string;
  exportedAt?: string;
  updatedAt: string;
};

export type Lesson = {
  id: string;
  title: string;
  objectiveIds: string[];
  estimatedMinutes: number;
  delivery: DeliveryTarget;
  supplements: DeliveryTarget[];
  units: ContentUnit[];
  assessmentId?: string;
  /** Links this lesson to a hand-authored TutorBot (see outline.tutorBots). */
  tutorBotId?: string;
};

export type Module = {
  id: string;
  title: string;
  lessonIds: string[];
};

export type SmeEngagement =
  | { kind: "w2"; loadedRateUsd?: number }
  | {
      kind: "per_project";
      feeUsd: number;
      includedHours?: number;
      overageRateUsd?: number;
    };

export type HumanResource = {
  id: string;
  kind: "human";
  name: string;
  roles: string[];
  skills: string[];
  hoursPerWeek: number;
  hourlyRateUsd?: number;
  sme?: SmeEngagement;
};

export type AiResource = {
  id: string;
  kind: "ai";
  name: string;
  skills: string[];
  costPerRunUsd: number;
};

export type Resource = HumanResource | AiResource;

export type CostBucket = {
  label: string;
  amountUsd: number;
  note: string;
};

export type ProductionEstimate = {
  asOf: string;
  basis: "prior" | "outline" | "velocity";
  learnerMinutes: number;
  p50Hours: number;
  p90Hours: number;
  calendarDays: number;
  bottleneck: string;
  p50CostUsd: number;
  p90CostUsd: number;
  buckets: CostBucket[];
  notes: string[];
};

export type GeneratedArtifact = {
  id: string;
  delivery: DeliveryTarget;
  filename: string;
  /** Rendered markdown — stored inline now that there's no local filesystem. */
  body: string;
};

export const TIME_PHASES = [
  "analyze",
  "design",
  "develop",
  "review",
  "build",
  "qa",
] as const;

export type TimePhase = (typeof TIME_PHASES)[number];

export type TimeLog = {
  id: string;
  lessonId?: string;
  phase: TimePhase;
  hours: number;
  note: string;
  loggedAt: string;
};

export type CourseOutline = {
  status: OutlineStatus;
  brief: CourseBrief;
  outcomes: Outcome[];
  assessments: AssessmentSpec[];
  modules: Module[];
  lessons: Lesson[];
  filters: FilterHit[];
  tutorBots: TutorBot[];
};

/**
 * Course-assembly phase timeline (Discovery → Publishing). Distinct from
 * TIME_PHASES above, which is only the ADDIE-ish dropdown used for manual
 * hour-logging in the cost estimator — this is the visible project timeline
 * requested alongside the requirements checklist.
 */
export const COURSE_PHASES = [
  "discovery",
  "design",
  "content_development",
  "assessment",
  "review",
  "qa",
  "assembly",
  "publishing",
] as const;

export type CoursePhase = (typeof COURSE_PHASES)[number];

/**
 * Instructional-design methodology + where the project currently sits
 * within it. Distinct from CoursePhase/COURSE_PHASES above (the 8-step
 * Discovery→Publishing production/assembly timeline) — this is the
 * coarser ADDIE/SAM methodology framing shown by the course mode
 * indicator. ADDIE's phases are sequential; SAM's are not (its active
 * phase can move freely, reflecting SAM's iterative-loop nature).
 */
export const ADDIE_PHASES = [
  "analyze",
  "design",
  "develop",
  "implement",
  "evaluate",
] as const;

export type AddiePhase = (typeof ADDIE_PHASES)[number];

export const ADDIE_PHASE_LABELS: Record<AddiePhase, string> = {
  analyze: "Analyze",
  design: "Design",
  develop: "Develop",
  implement: "Implement",
  evaluate: "Evaluate",
};

export const SAM_PHASES = [
  "preparation",
  "iterative_design",
  "iterative_development",
] as const;

export type SamPhase = (typeof SAM_PHASES)[number];

export const SAM_PHASE_LABELS: Record<SamPhase, string> = {
  preparation: "Preparation",
  iterative_design: "Iterative Design",
  iterative_development: "Iterative Development",
};

export type CourseMode = "addie" | "sam";

export type MethodologyPhase = AddiePhase | SamPhase;

export type Methodology = {
  mode: CourseMode;
  phase: MethodologyPhase;
};

export const DEFAULT_METHODOLOGY: Methodology = {
  mode: "addie",
  phase: "analyze",
};

export const COURSE_PHASE_LABELS: Record<CoursePhase, string> = {
  discovery: "Discovery",
  design: "Design",
  content_development: "Content Development",
  assessment: "Assessment",
  review: "Review",
  qa: "QA",
  assembly: "Assembly",
  publishing: "Publishing",
};

export type RequirementPriority = "required" | "recommended" | "optional";

export type RequirementItem = {
  id: string;
  phase: CoursePhase;
  label: string;
  priority: RequirementPriority;
  /** "auto" items are derived live from the outline/filters and can't be
   * manually checked off — their `done` reflects real state. "manual" items
   * are added via the checklist's form and toggled by hand. */
  source: "auto" | "manual";
  done: boolean;
  /** Stable key an auto item keeps across recompute so its identity (and
   * any future per-item notes) survives re-derivation. */
  autoCode?: string;
  note?: string;
  createdAt: string;
};

export type PhaseStatus = "not_started" | "in_progress" | "blocked" | "done";

export type PhaseProgress = {
  phase: CoursePhase;
  /** Manual override, 0-100. Undefined means "use the auto-calculated
   * percent from the requirements checklist." */
  manualPercent?: number;
  manualStatus?: PhaseStatus;
};

export type IdProject = {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Shape version of this object, per src/lib/id/migrations.ts. Every
   * stored project is brought up to CURRENT_SCHEMA_VERSION when it's
   * loaded, so new code never has to guard against an old shape by hand —
   * add a migration instead. Absent on a project written before this
   * field existed; treated as version 0. */
  schemaVersion: number;
  outline: CourseOutline;
  team: Resource[];
  estimate: ProductionEstimate;
  artifacts: GeneratedArtifact[];
  timeLogs: TimeLog[];
  requirements: RequirementItem[];
  phaseProgress: PhaseProgress[];
  methodology: Methodology;
};
