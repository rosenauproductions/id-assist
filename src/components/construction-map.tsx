"use client";

import type { CourseMapData, MapCompletion, MapNode } from "@/lib/id/course-map";

// Full-width Construction/Completion view for the new "Map" tab (roadmap
// section 13, phase 1). Same underlying CourseMapData the sidebar
// src/components/course-map.tsx renders, but laid out as a grid of module
// cards sized for the tab's full width, and colored by each node's
// `completion` state instead of just a red open-flag dot.

const COMPLETION_STYLES: Record<
  MapCompletion,
  { dot: string; ring: string; label: string }
> = {
  empty: { dot: "bg-line", ring: "", label: "Not started" },
  partial: { dot: "bg-warn", ring: "", label: "In progress" },
  complete: { dot: "bg-accent", ring: "", label: "Complete" },
  issue: { dot: "bg-danger", ring: "ring-1 ring-danger", label: "Needs attention" },
};

function completionOf(node: MapNode): MapCompletion {
  return node.completion ?? "empty";
}

function byParent(nodes: MapNode[], parentId: string, kind: MapNode["kind"]) {
  return nodes
    .filter((node) => node.parentId === parentId && node.kind === kind)
    .sort((a, b) => a.order - b.order);
}

export function ConstructionMap({
  data,
  activeId,
  onSelect,
}: {
  data: CourseMapData;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
}) {
  const modules = data.nodes
    .filter((node) => node.kind === "module")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        {(Object.keys(COMPLETION_STYLES) as MapCompletion[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${COMPLETION_STYLES[key].dot}`}
            />
            {COMPLETION_STYLES[key].label}
          </span>
        ))}
      </div>

      {modules.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing to map yet — compile or approve an outline first.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((courseModule) => {
            const lessons = byParent(data.nodes, courseModule.id, "lesson");
            return (
              <div
                key={courseModule.id}
                className="rounded-xl border border-line bg-background p-4"
              >
                <NodeRow
                  node={courseModule}
                  activeId={activeId}
                  onSelect={onSelect}
                  emphasize
                />
                <ol className="mt-3 grid gap-2">
                  {lessons.map((lesson) => {
                    const chain = [
                      ...byParent(data.nodes, lesson.id, "unit"),
                      ...byParent(data.nodes, lesson.id, "assessment"),
                    ];
                    return (
                      <li
                        key={lesson.id}
                        className="rounded-lg border border-line/70 p-2"
                      >
                        <NodeRow node={lesson} activeId={activeId} onSelect={onSelect} />
                        {chain.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-3.5">
                            {chain.map((step, index) => (
                              <span key={step.id} className="flex items-center gap-1">
                                {index > 0 ? (
                                  <span aria-hidden className="h-px w-2 bg-line" />
                                ) : null}
                                <Dot node={step} activeId={activeId} onSelect={onSelect} />
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NodeRow({
  node,
  activeId,
  onSelect,
  emphasize = false,
}: {
  node: MapNode;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
  emphasize?: boolean;
}) {
  const clickable = Boolean(onSelect) && !node.placeholder;
  const style = COMPLETION_STYLES[completionOf(node)];
  return (
    <button
      type="button"
      title={node.label}
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm transition-colors ${
        clickable ? "cursor-pointer hover:bg-line/30" : "cursor-default"
      } ${activeId === node.id ? "text-accent" : ""} ${
        emphasize ? "font-semibold" : ""
      }`}
    >
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot} ${style.ring}`}
      />
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
    </button>
  );
}

function Dot({
  node,
  activeId,
  onSelect,
}: {
  node: MapNode;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
}) {
  const clickable = Boolean(onSelect) && !node.placeholder;
  const style = COMPLETION_STYLES[completionOf(node)];
  return (
    <button
      type="button"
      title={node.label}
      aria-label={node.label}
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot} ${style.ring} ${
        clickable ? "cursor-pointer" : ""
      } ${activeId === node.id ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""}`}
    />
  );
}
