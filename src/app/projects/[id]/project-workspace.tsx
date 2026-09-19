"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  addRequirementAction,
  approveProjectAction,
  deleteProjectAction,
  deleteRequirementAction,
  dismissFilterAction,
  generateArtifactsAction,
  logTimeAction,
  refineOutlineAction,
  reopenOutlineAction,
  setPhaseProgressAction,
  toggleRequirementAction,
  updateAssessmentCountsAction,
  updateLessonAction,
  updateMethodologyAction,
  updateOutcomeAction,
  updateSmeAction,
} from "@/app/actions";
import { canApprove } from "@/lib/id/filters";
import { FlagMarker } from "@/components/flag-marker";
import { CourseMap } from "@/components/course-map";
import { FlowchartMap } from "@/components/flowchart-map";
import { ModeIndicator, phasesFor } from "@/components/mode-indicator";
import { ModeSelector } from "@/components/mode-selector";
import { buildCourseMap, type MapNode } from "@/lib/id/course-map";
import { effectivePhaseProgress } from "@/lib/id/requirements";
import { StatusPill, StatusIcon } from "@/components/status";
import {
  BLOOM_LEVELS,
  COURSE_PHASE_LABELS,
  COURSE_PHASES,
  DELIVERY_TARGETS,
  TIME_PHASES,
  type AssessmentSpec,
  type CourseMode,
  type FilterHit,
  type IdProject,
  type Lesson,
  type Methodology,
  type Outcome,
  type RequirementItem,
} from "@/lib/id/types";
import { GAGNE_LABELS, OUTCOME_KIND_LABELS, TIME_PHASE_LABELS, capitalizeFirst } from "@/lib/id/labels";
import type { MapShapeSettings } from "@/lib/id/course-map";

type WorkspaceTabId =
  | "outcomes"
  | "lessons"
  | "assessments"
  | "filters"
  | "requirements"
  | "map"
  | "time-cost"
  | "delivery";

type MapSubView = "construction" | "alignment" | "learner-path";

const MAP_VIEW_STORAGE_PREFIX = "id-assist:map-view:";
const MAP_SUB_VIEWS: MapSubView[] = ["construction", "alignment", "learner-path"];

function loadStoredMapView(projectId: string): MapSubView {
  if (typeof window === "undefined") return "construction";
  try {
    const stored = window.localStorage.getItem(MAP_VIEW_STORAGE_PREFIX + projectId);
    if (stored && (MAP_SUB_VIEWS as string[]).includes(stored)) {
      return stored as MapSubView;
    }
  } catch {
    // best-effort only — fall through to the default
  }
  return "construction";
}

function storeMapView(projectId: string, view: MapSubView) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAP_VIEW_STORAGE_PREFIX + projectId, view);
  } catch {
    // best-effort only
  }
}

/** Context-aware default view for the mode indicator's primary click.
 * Only Construction/Completion exists so far (roadmap section 13, phase
 * 1) — this always resolves there until the Alignment (phase 2) and
 * Learner Path (phase 3) views exist to route to for the mode/phase
 * combinations that call for them. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- methodology param kept for the future Alignment/Learner Path routing
function defaultMapViewFor(_methodology: Methodology): MapSubView {
  return "construction";
}

export function ProjectWorkspace({
  project,
  mapShapes,
}: {
  project: IdProject;
  mapShapes?: MapShapeSettings;
}) {
  const router = useRouter();
  const { outline, estimate } = project;
  const approvable = canApprove(outline.filters);
  const [reason, setReason] = useState("accepted compiler rewrite");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("outcomes");
  const openFilters = outline.filters.filter(
    (filter) => !filter.resolved && filter.severity !== "pass",
  ).length;
  const loggedHours = (project.timeLogs ?? []).reduce(
    (sum, log) => sum + log.hours,
    0,
  );
  const phases = effectivePhaseProgress(project);
  const requirements = useMemo(() => project.requirements ?? [], [project.requirements]);
  const courseMap = useMemo(
    () => buildCourseMap(outline, requirements),
    [outline, requirements],
  );
  const [activeMapNodeId, setActiveMapNodeId] = useState<string | undefined>();
  const [mapSubView, setMapSubViewState] = useState<MapSubView>(() =>
    loadStoredMapView(project.id),
  );
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);

  function setMapSubView(view: MapSubView) {
    setMapSubViewState(view);
    storeMapView(project.id, view);
  }

  // The mode indicator's primary click always overrides whatever view was
  // last viewed with the context-aware default for the project's current
  // mode/phase (only Construction exists so far — see defaultMapViewFor).
  function openMapFromModeIndicator() {
    setMapSubView(defaultMapViewFor(project.methodology));
    setActiveTab("map");
  }

  function handleMethodologyChange(next: Methodology) {
    setModeSelectorOpen(false);
    run(async () => {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("mode", next.mode);
      formData.set("phase", next.phase);
      await updateMethodologyAction(formData);
    });
  }

  // The indicator's slide toggle jumps straight to ADDIE or SAM, same as
  // picking a new mode in the popover selector: land on that mode's first
  // phase rather than trying to carry over a phase index across the two
  // differently-shaped phase lists.
  function handleModeToggle(mode: CourseMode) {
    if (mode === project.methodology.mode) return;
    handleMethodologyChange({ mode, phase: phasesFor(mode)[0] });
  }

  // Clicking a course-map node jumps to that piece in the editor: switches
  // to the tab that owns it, scrolls the matching list item into view (see
  // the id={`lesson-${lesson.id}`}-style ids below), and briefly rings it
  // so it's obvious what just got focused. A module has no editor of its
  // own — it's just a grouping of lessons — so it jumps to its first
  // lesson instead.
  function focusMapNode(node: MapNode) {
    setActiveMapNodeId(node.id);
    let tab: WorkspaceTabId | null = null;
    let targetId: string | null = null;
    if (node.kind === "module") {
      tab = "lessons";
      const firstLesson = courseMap.nodes.find(
        (candidate) => candidate.parentId === node.id && candidate.kind === "lesson",
      );
      targetId = firstLesson ? `lesson-${firstLesson.id}` : null;
    } else if (node.kind === "lesson") {
      tab = "lessons";
      targetId = `lesson-${node.id}`;
    } else if (node.kind === "unit") {
      tab = "lessons";
      targetId = node.parentId ? `lesson-${node.parentId}` : null;
    } else if (node.kind === "assessment") {
      tab = "assessments";
      targetId = `assessment-${node.id}`;
    }
    if (tab) setActiveTab(tab);
    if (targetId) {
      window.setTimeout(() => {
        const el = document.getElementById(targetId!);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-accent");
        window.setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 1500);
      }, 50);
    }
  }

  const tabs: { id: WorkspaceTabId; label: string; badge?: string }[] = [
    { id: "outcomes", label: "Outcomes", badge: String(outline.outcomes.length) },
    { id: "lessons", label: "Lessons", badge: String(outline.lessons.length) },
    {
      id: "assessments",
      label: "Assessments",
      badge: String(outline.assessments.length),
    },
    {
      id: "filters",
      label: "Quality checks",
      badge: openFilters > 0 ? String(openFilters) : undefined,
    },
    {
      id: "requirements",
      label: "Requirements",
      badge: `${requirements.filter((item) => item.done).length}/${requirements.length}`,
    },
    { id: "map", label: "Map" },
    { id: "time-cost", label: "Time & cost" },
    {
      id: "delivery",
      label: "Delivery files",
      badge: project.artifacts.length > 0 ? String(project.artifacts.length) : undefined,
    },
  ];

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something failed");
      }
    });
  }

  function removeProject() {
    if (
      !window.confirm(
        `Delete “${outline.brief.title}”? This removes the project folder and its delivery files.`,
      )
    ) {
      return;
    }
    run(async () => {
      await deleteProjectAction(project.id);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app" className="text-sm text-muted hover:text-foreground">
            ← Projects
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={outline.status} />
            <span className="text-xs text-muted">
              estimate basis: {estimate.basis}
            </span>
            <div className="relative inline-block">
              <ModeIndicator
                mode={project.methodology.mode}
                phase={project.methodology.phase}
                onOpenMap={openMapFromModeIndicator}
                onOpenSelector={() => setModeSelectorOpen((open) => !open)}
                onModeChange={handleModeToggle}
              />
              {modeSelectorOpen ? (
                <ModeSelector
                  methodology={project.methodology}
                  onChange={handleMethodologyChange}
                  onClose={() => setModeSelectorOpen(false)}
                />
              ) : null}
            </div>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {outline.brief.title}
          </h1>
          <p className="mt-1 max-w-3xl text-muted">{outline.brief.jobTask}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending || outline.status === "approved"}
            onClick={() => run(() => refineOutlineAction(project.id))}
            className="btn-secondary disabled:opacity-40"
          >
            {pending ? "Working…" : "Refine with AI"}
          </button>
          <button
            disabled={pending || !approvable || outline.status === "approved"}
            onClick={() => run(() => approveProjectAction(project.id))}
            className="btn-primary disabled:opacity-40"
          >
            Approve outline
          </button>
          {outline.status === "approved" ? (
            <button
              disabled={pending}
              onClick={() => run(() => reopenOutlineAction(project.id))}
              className="btn-secondary"
            >
              Reopen
            </button>
          ) : null}
          <button
            disabled={pending || outline.status !== "approved"}
            onClick={() => run(() => generateArtifactsAction(project.id))}
            className="btn-secondary disabled:opacity-40"
          >
            Create delivery files
          </button>
          <Link href={`/projects/${project.id}/tutor`} className="btn-secondary">
            Open tutor
          </Link>
          <button
            disabled={pending}
            onClick={removeProject}
            className="btn-secondary text-danger disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Workflow
        status={outline.status}
        hasArtifacts={project.artifacts.length > 0}
        openFilters={openFilters}
      />

      <PhaseTimeline projectId={project.id} phases={phases} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Seat time" value={`${estimate.learnerMinutes} min`} />
        <Stat
          label="Production P50 / P90"
          value={`${estimate.p50Hours} / ${estimate.p90Hours} h`}
        />
        <Stat label="Logged" value={`${loggedHours.toFixed(1)} h`} />
        <Stat label="Calendar left" value={`${estimate.calendarDays} d`} />
        <Stat
          label="Cost P50"
          value={`$${estimate.p50CostUsd.toLocaleString()}`}
        />
      </section>
      <p className="mt-2 text-sm text-muted">Bottleneck: {estimate.bottleneck}</p>

      <div
        className={`mt-10 grid gap-6 lg:items-start ${
          activeTab === "map" ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_18rem]"
        }`}
      >
      <div>
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-line bg-card text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="ml-1.5 text-xs text-muted">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="rounded-b-xl rounded-tr-xl border border-line bg-card p-5">
          {activeTab === "outcomes" ? (
            <section>
              <h2 className="text-lg font-semibold">Outcomes</h2>
              <p className="mt-1 text-sm text-muted">
                Edit the pieces of each objective below. Saving checks it against the rules again.
              </p>
              <ul className="mt-4 grid gap-4">
                {outline.outcomes.map((outcome) => (
                  <OutcomeEditor
                    key={outcome.id}
                    projectId={project.id}
                    outcome={outcome}
                    locked={outline.status === "approved"}
                    filters={outline.filters.filter(
                      (filter) => filter.targetId === outcome.id,
                    )}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === "lessons" ? (
            <section>
              <h2 className="text-lg font-semibold">Lessons</h2>
              <ul className="mt-4 grid gap-4">
                {outline.lessons.map((lesson) => (
                  <LessonEditor
                    key={lesson.id}
                    project={project}
                    lesson={lesson}
                    locked={outline.status === "approved"}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === "assessments" ? (
            <section>
              <h2 className="text-lg font-semibold">Assessments</h2>
              <p className="mt-1 text-sm text-muted">
                Set target/actual item counts to catch quantity gaps — e.g. “20
                items built but the spec calls for 25.”
              </p>
              <ul className="mt-4 grid gap-4">
                {outline.assessments.map((assessment) => (
                  <AssessmentCountEditor
                    key={assessment.id}
                    projectId={project.id}
                    assessment={assessment}
                    outcome={outline.outcomes.find(
                      (outcome) => outcome.id === assessment.outcomeId,
                    )}
                    filters={outline.filters.filter(
                      (filter) => filter.targetId === assessment.id,
                    )}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === "filters" ? (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Quality checks</h2>
                <span className="text-xs text-muted">{openFilters} open</span>
              </div>
              <ul className="mt-3 grid max-h-[28rem] gap-2 overflow-auto">
                {outline.filters.map((filter) => (
                  <FilterRow
                    key={filter.id}
                    projectId={project.id}
                    filter={filter}
                    reason={reason}
                    onReason={setReason}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === "requirements" ? (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Requirements checklist</h2>
                <span className="text-xs text-muted">
                  {requirements.filter((item) => item.done).length}/
                  {requirements.length} done
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Required / Recommended / Optional. Auto items track the outline
                live; add your own for anything the automatic checks can&apos;t catch.
              </p>
              <RequirementsChecklist
                projectId={project.id}
                requirements={requirements}
              />
            </section>
          ) : null}

          {activeTab === "map" ? (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Map</h2>
                <div
                  role="tablist"
                  aria-label="Map view"
                  className="flex gap-1 rounded-lg border border-line p-1"
                >
                  {(
                    [
                      { id: "construction", label: "Construction" },
                      { id: "alignment", label: "Alignment" },
                      { id: "learner-path", label: "Learner Path" },
                    ] as { id: MapSubView; label: string }[]
                  ).map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      role="tab"
                      aria-selected={mapSubView === view.id}
                      onClick={() => setMapSubView(view.id)}
                      className={`rounded-md px-3 py-1 text-sm transition-colors ${
                        mapSubView === view.id
                          ? "bg-line/60 text-foreground"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>

              {mapSubView === "construction" ? (
                <>
                  <p className="mt-1 text-sm text-muted">
                    Coloring reflects the Requirements checklist for each
                    piece&apos;s phase, overlaid red where a quality issue is
                    still open.
                  </p>
                  <div className="mt-4">
                    <FlowchartMap
                      data={courseMap}
                      shapes={mapShapes}
                      activeId={activeMapNodeId}
                      onSelect={focusMapNode}
                    />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  {mapSubView === "alignment"
                    ? "Alignment view (outcomes vs. lessons/assessments) is coming in a later phase."
                    : "Learner Path view (full-course sequential flow) is coming in a later phase."}
                </p>
              )}
            </section>
          ) : null}

          {activeTab === "time-cost" ? (
            <div className="grid gap-8 sm:grid-cols-2">
              <section>
                <h2 className="text-lg font-semibold">Log actuals</h2>
                <p className="mt-1 text-sm text-muted">
                  Logged hours reforecast remaining cost and calendar.
                </p>
                <TimeLogForm project={project} />
                {(project.timeLogs ?? []).length > 0 ? (
                  <ul className="mt-3 grid gap-1 text-sm">
                    {[...(project.timeLogs ?? [])]
                      .reverse()
                      .slice(0, 6)
                      .map((log) => (
                        <li key={log.id} className="flex justify-between gap-3">
                          <span className="text-muted">
                            {log.phase}
                            {log.lessonId ? ` · lesson` : ""} · {log.note || "—"}
                          </span>
                          <span>{log.hours} h</span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </section>

              <section>
                <h2 className="text-lg font-semibold">SME</h2>
                <SmeForm project={project} />
              </section>

              <section className="sm:col-span-2">
                <h2 className="text-lg font-semibold">Cost</h2>
                <ul className="mt-3 grid gap-1 text-sm">
                  {estimate.buckets.map((bucket) => (
                    <li key={bucket.label} className="flex justify-between gap-4">
                      <span>
                        {bucket.label}
                        <span className="text-muted"> — {bucket.note}</span>
                      </span>
                      <span>${bucket.amountUsd.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                {estimate.notes.map((note) => (
                  <p key={note} className="mt-2 text-sm text-muted">
                    {note}
                  </p>
                ))}
              </section>
            </div>
          ) : null}

          {activeTab === "delivery" ? (
            <section>
              <h2 className="text-lg font-semibold">Delivery files</h2>
              <p className="mt-2 text-sm text-muted">
                Markdown packs you use to build the course in each channel — not
                finished Rise/Canvas courses. Open a file, then build from it.
              </p>
              {project.artifacts.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Approve the outline, then create delivery files.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 text-sm">
                  {project.artifacts.map((artifact) => (
                    <li key={artifact.id}>
                      <a
                        className="text-accent underline-offset-2 hover:underline"
                        href={`/api/projects/${project.id}/artifacts/${artifact.filename}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {labelForArtifact(artifact.filename, artifact.delivery)}
                      </a>
                      <span className="ml-2 text-xs text-muted">
                        {artifact.filename}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {activeTab === "map" ? null : (
        <aside className="lg:sticky lg:top-6">
          <CourseMap
            data={courseMap}
            activeId={activeMapNodeId}
            onSelect={focusMapNode}
            emptyHint="Nothing compiled yet."
          />
        </aside>
      )}
      </div>

      <style>{`
        .btn-primary {
          border-radius: 0.5rem;
          background: var(--foreground);
          color: var(--background);
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.92;
        }
        .btn-primary:active:not(:disabled) {
          transform: scale(0.97);
        }
        .btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btn-primary[aria-busy="true"] {
          background: var(--accent);
        }
        .btn-secondary {
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--card);
          padding: 0.5rem 0.85rem;
          font-size: 0.875rem;
          font-weight: 500;
          transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
        }
        .btn-secondary:hover:not(:disabled) {
          border-color: color-mix(in oklab, var(--foreground) 25%, var(--line));
          background: var(--background);
        }
        .btn-secondary:active:not(:disabled) {
          transform: scale(0.97);
        }
        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-success {
          border-radius: 0.5rem;
          background: var(--accent);
          color: white;
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.45rem 0.65rem;
        }
      `}</style>
    </main>
  );
}

function Workflow({
  status,
  hasArtifacts,
  openFilters,
}: {
  status: string;
  hasArtifacts: boolean;
  openFilters: number;
}) {
  const steps = [
    { id: "brief", label: "Brief", done: true },
    { id: "outline", label: "Outline", done: true },
    {
      id: "filters",
      label: openFilters ? `Quality issues (${openFilters})` : "No quality issues",
      done: openFilters === 0,
    },
    { id: "approve", label: "Approved", done: status === "approved" },
    { id: "artifacts", label: "Delivery files", done: hasArtifacts },
  ];
  return (
    <ol className="mt-6 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`rounded-md border px-2 py-1.5 text-xs leading-tight ${
            step.done
              ? "border-accent/30 bg-accent/5 text-accent"
              : "border-line bg-card text-muted"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wide">
            Step {index + 1}
          </span>
          <div className="font-medium text-foreground">{step.label}</div>
        </li>
      ))}
    </ol>
  );
}

function labelForArtifact(filename: string, delivery: string): string {
  const labels: Record<string, string> = {
    rise: "Rise build sheet",
    canvas: "Canvas pages to paste",
    video: "Video script + shot list",
    gdoc: "Google Doc job aid",
    gslides: "Google Slides outline",
    tutor: "Live tutor coach pack",
  };
  if (filename.includes("rise")) return labels.rise;
  if (filename.includes("canvas")) return labels.canvas;
  if (filename.includes("video")) return labels.video;
  if (filename.includes("google-doc") || filename.includes("gdoc")) {
    return labels.gdoc;
  }
  if (filename.includes("slides")) return labels.gslides;
  if (filename.includes("tutor")) return labels.tutor;
  return labels[delivery] ?? filename;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function HintLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span>{label}</span>
      <span className="text-[11px] font-normal leading-4 text-muted">{hint}</span>
      {children}
    </label>
  );
}

function ActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: (state: { pending: boolean; saved: boolean }) => ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  return (
    <form
      className={className}
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          setSaved(true);
        });
      }}
    >
      {children({ pending, saved })}
    </form>
  );
}

function SaveButton({
  pending,
  saved,
  idle = "Save",
  saving = "Saving…",
  done = "Saved",
}: {
  pending: boolean;
  saved: boolean;
  idle?: string;
  saving?: string;
  done?: string;
}) {
  const label = pending ? saving : saved ? done : idle;
  const className = saved && !pending ? "btn-success w-fit" : "btn-primary w-fit";
  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={className}
      >
        {label}
      </button>
      {saved && !pending ? (
        <span className="text-xs font-medium text-accent" role="status">
          Changes applied · filters re-run
        </span>
      ) : null}
      {pending ? (
        <span className="text-xs text-muted" role="status">
          Working…
        </span>
      ) : null}
    </div>
  );
}

/** For nested submit buttons that need useFormStatus (native action forms). */
function NativePendingButton({
  idle,
  pendingLabel,
  className = "btn-secondary w-fit",
}: {
  idle: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingLabel : idle}
    </button>
  );
}

function OutcomeEditor({
  projectId,
  outcome,
  locked,
  filters,
}: {
  projectId: string;
  outcome: Outcome;
  locked: boolean;
  filters: FilterHit[];
}) {
  return (
    <li
      id={`outcome-${outcome.id}`}
      className="rounded-lg border border-line bg-background p-4 transition-shadow"
    >
      <p
        className="text-[11px] font-medium uppercase tracking-wide text-muted"
        title={outcome.kind === "terminal" ? "Terminal objective" : "Enabling objective"}
      >
        {OUTCOME_KIND_LABELS[outcome.kind]}
        <FlagMarker projectId={projectId} filters={filters} />
      </p>
      <ActionForm
        className="mt-3 grid gap-2 text-sm"
        action={async (formData) => {
          formData.set("projectId", projectId);
          formData.set("outcomeId", outcome.id);
          await updateOutcomeAction(formData);
        }}
      >
        {({ pending, saved }) => (
          <>
            <HintLabel
              label="Bloom"
              hint="The level of thinking the learner needs to demonstrate — from remembering information to applying, analyzing, evaluating, or creating."
            >
              <select
                name="bloom"
                defaultValue={outcome.bloom}
                disabled={locked || pending}
                className="field"
              >
                {BLOOM_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </HintLabel>
            <HintLabel
              label="Condition"
              hint="The situation, information, tools, or resources the learner will have when performing the task."
            >
              <input
                name="condition"
                defaultValue={outcome.condition}
                disabled={locked || pending}
                className="field"
              />
            </HintLabel>
            <HintLabel
              label="Behavior"
              hint="Something you can actually observe the learner doing. Avoid vague verbs like “understand” or “know” because they aren't directly observable."
            >
              <input
                name="behavior"
                defaultValue={outcome.behavior}
                disabled={locked || pending}
                className="field"
              />
            </HintLabel>
            <HintLabel
              label="Criterion"
              hint="How well the learner must perform the task to be considered successful."
            >
              <input
                name="criterion"
                defaultValue={outcome.criterion}
                disabled={locked || pending}
                className="field"
              />
            </HintLabel>
            {!locked ? (
              <SaveButton
                pending={pending}
                saved={saved}
                idle="Save outcome"
                saving="Saving outcome…"
                done="Outcome saved"
              />
            ) : (
              <p className="text-xs text-muted">Reopen outline to edit.</p>
            )}
          </>
        )}
      </ActionForm>
    </li>
  );
}

function LessonEditor({
  project,
  lesson,
  locked,
}: {
  project: IdProject;
  lesson: Lesson;
  locked: boolean;
}) {
  const objectives = lesson.objectiveIds
    .map((id) => project.outline.outcomes.find((outcome) => outcome.id === id))
    .filter((outcome): outcome is NonNullable<typeof outcome> => Boolean(outcome));
  return (
    <li
      id={`lesson-${lesson.id}`}
      className="rounded-lg border border-line bg-background p-4 transition-shadow"
    >
      <ActionForm
        className="grid gap-2 text-sm"
        action={async (formData) => {
          formData.set("projectId", project.id);
          formData.set("lessonId", lesson.id);
          await updateLessonAction(formData);
        }}
      >
        {({ pending, saved }) => (
          <>
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem]">
              <HintLabel label="Title" hint="Learner-facing lesson name.">
                <input
                  name="title"
                  defaultValue={lesson.title}
                  disabled={locked || pending}
                  className="field"
                />
              </HintLabel>
              <HintLabel
                label="Minutes"
                hint="Learner seat time for this lesson (target 5–9)."
              >
                <input
                  name="estimatedMinutes"
                  type="number"
                  min={4}
                  max={12}
                  defaultValue={lesson.estimatedMinutes}
                  disabled={locked || pending}
                  className="field"
                />
              </HintLabel>
              <HintLabel
                label="Delivery"
                hint="Primary channel this lesson ships in."
              >
                <select
                  name="delivery"
                  defaultValue={lesson.delivery}
                  disabled={locked || pending}
                  className="field"
                >
                  {DELIVERY_TARGETS.map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
              </HintLabel>
            </div>
            <p className="text-xs text-muted">
              {objectives.map((o) => o.bloom).join(", ") || "?"} ·{" "}
              {lesson.supplements.length
                ? `+ ${lesson.supplements.join(", ")}`
                : "no supplements"}
              <FlagMarker
                projectId={project.id}
                filters={project.outline.filters.filter(
                  (filter) => filter.targetId === lesson.id,
                )}
              />
            </p>
            <ul className="grid gap-2">
              {lesson.units.map((unit) => (
                <li
                  key={unit.id}
                  className="grid gap-1.5 rounded-md border border-line/60 bg-card/40 p-2.5"
                >
                  <p className="text-xs text-muted">
                    <span className="font-medium text-foreground">
                      {GAGNE_LABELS[unit.gagne]}
                      {unit.riseBlock ? ` / ${unit.riseBlock}` : ""}
                    </span>{" "}
                    — {unit.purpose}
                  </p>
                  <textarea
                    name={`unit-content-${unit.id}`}
                    defaultValue={unit.content ?? ""}
                    disabled={locked || pending}
                    rows={2}
                    placeholder="Write the actual content for this beat — script, narration, bullet points…"
                    className="field"
                  />
                </li>
              ))}
            </ul>
            {!locked ? (
              <SaveButton
                pending={pending}
                saved={saved}
                idle="Save lesson"
                saving="Saving lesson…"
                done="Lesson saved"
              />
            ) : (
              <p className="text-xs text-muted">Reopen outline to edit.</p>
            )}
          </>
        )}
      </ActionForm>
    </li>
  );
}

function FilterRow({
  projectId,
  filter,
  reason,
  onReason,
}: {
  projectId: string;
  filter: FilterHit;
  reason: string;
  onReason: (value: string) => void;
}) {
  const tone =
    filter.severity === "block"
      ? "border-danger/30"
      : filter.severity === "pass"
        ? "border-accent/20"
        : "border-line";
  return (
    <li className={`rounded-md border bg-background px-3 py-2 text-sm ${tone}`}>
      <p
        className="text-[11px] font-medium uppercase tracking-wide text-muted"
        title={filter.code}
      >
        {filter.severity}
        {filter.resolved ? " · resolved" : ""}
      </p>
      <p className="mt-1">{filter.message}</p>
      <p className="text-muted">{filter.suggestion}</p>
      {!filter.resolved &&
      filter.severity !== "block" &&
      filter.severity !== "pass" ? (
        <form
          className="mt-2 flex gap-2"
          action={dismissFilterAction.bind(null, projectId, filter.id, reason)}
        >
          <input
            value={reason}
            onChange={(event) => onReason(event.target.value)}
            className="field min-w-0 flex-1 text-xs"
            aria-label="Resolve reason"
            placeholder="Why you accept this"
          />
          <NativePendingButton
            idle="Resolve"
            pendingLabel="Resolving…"
            className="text-xs font-medium text-accent disabled:opacity-50"
          />
        </form>
      ) : null}
    </li>
  );
}

function TimeLogForm({ project }: { project: IdProject }) {
  return (
    <ActionForm
      className="mt-3 grid gap-2 text-sm"
      action={async (formData) => {
        formData.set("projectId", project.id);
        await logTimeAction(formData);
      }}
    >
      {({ pending, saved }) => (
        <>
          <div className="grid grid-cols-2 gap-2">
            <HintLabel
              label="Hours"
              hint="Actual production time you spent — not learner seat time."
            >
              <input
                name="hours"
                type="number"
                min={0.25}
                step={0.25}
                required
                disabled={pending}
                className="field"
                placeholder="2"
              />
            </HintLabel>
            <HintLabel
              label="Phase"
              hint="Which phase of building the course this was."
            >
              <select
                name="phase"
                defaultValue="develop"
                disabled={pending}
                className="field"
              >
                {TIME_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {TIME_PHASE_LABELS[phase]}
                  </option>
                ))}
              </select>
            </HintLabel>
          </div>
          <HintLabel
            label="Lesson (optional)"
            hint="Link hours to a specific lesson to track pace by lesson. Leave blank if this was work on the whole course."
          >
            <select
              name="lessonId"
              defaultValue=""
              disabled={pending}
              className="field"
            >
              <option value="">Whole course / phase only</option>
              {project.outline.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </HintLabel>
          <HintLabel label="Note" hint="Short reminder of what you did.">
            <input
              name="note"
              disabled={pending}
              className="field"
              placeholder="Drafted L1 scenario"
            />
          </HintLabel>
          <SaveButton
            pending={pending}
            saved={saved}
            idle="Log hours"
            saving="Logging…"
            done="Hours logged"
          />
        </>
      )}
    </ActionForm>
  );
}

function SmeForm({ project }: { project: IdProject }) {
  const sme = project.team.find(
    (resource) => resource.kind === "human" && resource.roles.includes("SME"),
  );
  if (!sme || sme.kind !== "human") return null;
  const perProject = sme.sme?.kind === "per_project";

  return (
    <ActionForm
      className="mt-3 grid gap-3 text-sm"
      action={async (formData) => {
        formData.set("projectId", project.id);
        await updateSmeAction(formData);
      }}
    >
      {({ pending, saved }) => (
        <>
          <HintLabel label="Name" hint="Who signs off on accuracy — the expert you go to with questions.">
            <input
              name="smeName"
              defaultValue={sme.name}
              disabled={pending}
              className="field"
            />
          </HintLabel>
          <HintLabel
            label="Hours / week"
            hint="Their real, available hours — staff experts are often the bottleneck on scheduling."
          >
            <input
              name="smeHours"
              type="number"
              min={0}
              defaultValue={sme.hoursPerWeek}
              disabled={pending}
              className="field"
            />
          </HintLabel>
          <HintLabel
            label="Engagement"
            hint="Staff (W2): no separate invoice. Contractor: enter the fee you agreed on — there's no cap."
          >
            <select
              name="smeKind"
              defaultValue={sme.sme?.kind ?? "w2"}
              disabled={pending}
              className="field"
            >
              <option value="w2">W2 (invoice $0)</option>
              <option value="per_project">Per-project fee</option>
            </select>
          </HintLabel>
          <HintLabel
            label="Fee USD"
            hint="Typically $1k–$5k as a reference — enter the actual amount you agreed on."
          >
            <input
              name="smeFee"
              type="number"
              min={0}
              defaultValue={
                perProject && sme.sme?.kind === "per_project"
                  ? sme.sme.feeUsd
                  : 3500
              }
              disabled={pending}
              className="field"
            />
          </HintLabel>
          <SaveButton
            pending={pending}
            saved={saved}
            idle="Recalculate cost"
            saving="Recalculating…"
            done="Cost updated"
          />
        </>
      )}
    </ActionForm>
  );
}

function PhaseTimeline({
  projectId,
  phases,
}: {
  projectId: string;
  phases: ReturnType<typeof effectivePhaseProgress>;
}) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">Phase timeline</h2>
      <p className="mt-1 text-sm text-muted">
        Discovery → Publishing. Auto-calculated from the requirements
        checklist below — override a phase if reality doesn&apos;t match yet.
      </p>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {phases.map((phase) => (
          <PhaseCard key={phase.phase} projectId={projectId} phase={phase} />
        ))}
      </ol>
    </section>
  );
}

const PHASE_STATUS_TONE: Record<string, string> = {
  done: "border-accent/30 bg-accent/5 text-accent",
  in_progress: "border-line bg-background text-foreground",
  blocked: "border-danger/30 bg-danger/5 text-danger",
  not_started: "border-line bg-card text-muted",
};

function PhaseCard({
  projectId,
  phase,
}: {
  projectId: string;
  phase: ReturnType<typeof effectivePhaseProgress>[number];
}) {
  const [editing, setEditing] = useState(false);
  const tone = PHASE_STATUS_TONE[phase.status] ?? PHASE_STATUS_TONE.not_started;
  return (
    <li className={`rounded-md border p-2 text-xs ${tone}`}>
      <div className="flex items-center gap-1 font-medium leading-tight">
        <StatusIcon status={phase.status} className="h-3 w-3 shrink-0" />
        <span className="truncate" title={COURSE_PHASE_LABELS[phase.phase]}>
          {COURSE_PHASE_LABELS[phase.phase]}
        </span>
        {phase.overridden ? (
          <span
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60"
            title="Manually overridden"
          />
        ) : null}
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line/60">
        <div
          className="h-full rounded-full bg-current opacity-70"
          style={{ width: `${phase.percent}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted">{phase.percent}%</p>
      {editing ? (
        <ActionForm
          className="mt-2 grid gap-1"
          action={async (formData) => {
            formData.set("projectId", projectId);
            formData.set("phase", phase.phase);
            await setPhaseProgressAction(formData);
            setEditing(false);
          }}
        >
          {({ pending }) => (
            <>
              <input
                name="percent"
                type="number"
                min={0}
                max={100}
                defaultValue={phase.overridden ? phase.percent : ""}
                placeholder="auto"
                className="field text-xs"
                disabled={pending}
              />
              <select
                name="status"
                defaultValue={phase.overridden ? phase.status : "auto"}
                className="field text-xs"
                disabled={pending}
              >
                <option value="auto">Auto</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="text-xs font-medium text-accent disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs text-muted"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </ActionForm>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-muted underline-offset-2 hover:underline"
        >
          Override
        </button>
      )}
    </li>
  );
}

function RequirementsChecklist({
  projectId,
  requirements,
}: {
  projectId: string;
  requirements: RequirementItem[];
}) {
  const grouped = COURSE_PHASES.map((phase) => ({
    phase,
    items: requirements.filter((item) => item.phase === phase),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mt-3 grid gap-4">
      {grouped.map((group) => (
        <div key={group.phase}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {COURSE_PHASE_LABELS[group.phase]}
          </p>
          <ul className="mt-1 grid gap-1.5">
            {group.items.map((item) => (
              <RequirementRow key={item.id} projectId={projectId} item={item} />
            ))}
          </ul>
        </div>
      ))}
      <AddRequirementForm projectId={projectId} />
    </div>
  );
}

const PRIORITY_TONE: Record<string, string> = {
  required: "text-danger",
  recommended: "text-warn",
  optional: "text-muted",
};

function RequirementRow({
  projectId,
  item,
}: {
  projectId: string;
  item: RequirementItem;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-start gap-2 rounded-md border border-line bg-background px-2.5 py-1.5 text-sm">
      <input
        type="checkbox"
        checked={item.done}
        disabled={item.source === "auto" || pending}
        onChange={() => {
          startTransition(async () => {
            await toggleRequirementAction(projectId, item.id);
          });
        }}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={item.done ? "text-muted line-through" : ""}>
          {item.label}
        </p>
        <p className="text-[11px]">
          <span className={PRIORITY_TONE[item.priority] ?? ""}>
            {item.priority}
          </span>
          {item.source === "auto" ? (
            <span className="text-muted"> · auto-tracked</span>
          ) : (
            <span className="text-muted"> · added by you</span>
          )}
        </p>
      </div>
      {item.source === "manual" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await deleteRequirementAction(projectId, item.id);
            });
          }}
          className="text-xs text-muted hover:text-danger"
        >
          Remove
        </button>
      ) : null}
    </li>
  );
}

function AddRequirementForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm
      className="grid gap-2 rounded-md border border-dashed border-line p-3 text-sm"
      action={async (formData) => {
        formData.set("projectId", projectId);
        await addRequirementAction(formData);
      }}
    >
      {({ pending }) => (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Add your own item
          </p>
          <input
            name="label"
            required
            disabled={pending}
            className="field text-sm"
            placeholder="e.g. Get SME sign-off on Module 2"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="phase"
              defaultValue="discovery"
              disabled={pending}
              className="field text-sm"
            >
              {COURSE_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {COURSE_PHASE_LABELS[phase]}
                </option>
              ))}
            </select>
            <select
              name="priority"
              defaultValue="recommended"
              disabled={pending}
              className="field text-sm"
            >
              <option value="required">Required</option>
              <option value="recommended">Recommended</option>
              <option value="optional">Optional</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-secondary w-fit text-xs"
          >
            {pending ? "Adding…" : "Add item"}
          </button>
        </>
      )}
    </ActionForm>
  );
}

function AssessmentCountEditor({
  projectId,
  assessment,
  outcome,
  filters,
}: {
  projectId: string;
  assessment: AssessmentSpec;
  outcome: Outcome | undefined;
  filters: FilterHit[];
}) {
  return (
    <li
      id={`assessment-${assessment.id}`}
      className="rounded-lg border border-line bg-background p-4 transition-shadow"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {capitalizeFirst(assessment.format)} · {capitalizeFirst(assessment.bloom)}
        <FlagMarker projectId={projectId} filters={filters} />
      </p>
      <p className="mt-1 text-sm text-muted">
        {outcome ? outcome.behavior : "Objective not found"}
      </p>
      <ActionForm
        className="mt-3 grid grid-cols-2 gap-2 text-sm"
        action={async (formData) => {
          formData.set("projectId", projectId);
          formData.set("assessmentId", assessment.id);
          await updateAssessmentCountsAction(formData);
        }}
      >
        {({ pending, saved }) => (
          <>
            <HintLabel
              label="Target item count"
              hint="What the requirements call for."
            >
              <input
                name="targetItemCount"
                type="number"
                min={0}
                defaultValue={assessment.targetItemCount ?? ""}
                disabled={pending}
                className="field"
                placeholder="e.g. 25"
              />
            </HintLabel>
            <HintLabel label="Actual item count" hint="What's built so far.">
              <input
                name="actualItemCount"
                type="number"
                min={0}
                defaultValue={assessment.actualItemCount ?? ""}
                disabled={pending}
                className="field"
                placeholder="e.g. 20"
              />
            </HintLabel>
            <div className="col-span-2">
              <SaveButton
                pending={pending}
                saved={saved}
                idle="Save counts"
                saving="Saving…"
                done="Saved"
              />
            </div>
          </>
        )}
      </ActionForm>
    </li>
  );
}
