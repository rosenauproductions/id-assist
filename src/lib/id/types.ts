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
};

export type ContentUnit = {
  id: string;
  purpose: string;
  gagne: GagneEvent;
  delivery: DeliveryTarget;
  riseBlock?: RiseBlockKind;
};

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

export type Lesson = {
  id: string;
  title: string;
  objectiveId: string;
  estimatedMinutes: number;
  delivery: DeliveryTarget;
  supplements: DeliveryTarget[];
  units: ContentUnit[];
  assessmentId?: string;
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
};

export type IdProject = {
  id: string;
  createdAt: string;
  updatedAt: string;
  outline: CourseOutline;
  team: Resource[];
  estimate: ProductionEstimate;
  artifacts: GeneratedArtifact[];
  timeLogs: TimeLog[];
};
