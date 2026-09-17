"use client";

import type { CourseMapData, MapNode } from "@/lib/id/course-map";

// Renders the course-structure map as a compact, top-to-bottom tree:
// modules stacked vertically, their lessons nested one level in, and each
// lesson's Gagné-event units (plus its check) drawn as a small horizontal
// chain of connected dots — the "flow" Chris asked for, scaled to fit a
// narrow sticky sidebar rather than a full 2D flowchart.

function byParent(nodes: MapNode[], parentId: string, kind: MapNode["kind"]) {
  return nodes
    .filter((node) => node.parentId === parentId && node.kind === kind)
    .sort((a, b) => a.order - b.order);
}

export function CourseMap({
  data,
  title = "Course map",
  emptyHint = "Nothing to map yet.",
  activeId,
  onSelect,
}: {
  data: CourseMapData;
  title?: string;
  emptyHint?: string;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
}) {
  const modules = data.nodes
    .filter((node) => node.kind === "module")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </p>

      {modules.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyHint}</p>
      ) : (
        <ol className="mt-3 grid gap-3.5">
          {modules.map((courseModule) => {
            const lessons = byParent(data.nodes, courseModule.id, "lesson");
            return (
              <li key={courseModule.id}>
                <MapRow
                  node={courseModule}
                  activeId={activeId}
                  onSelect={onSelect}
                  emphasize
                />
                {lessons.length > 0 ? (
                  <ol className="mt-1.5 ml-1.5 grid gap-2 border-l border-line pl-3">
                    {lessons.map((lesson) => {
                      const chain = [
                        ...byParent(data.nodes, lesson.id, "unit"),
                        ...byParent(data.nodes, lesson.id, "assessment"),
                      ];
                      return (
                        <li key={lesson.id}>
                          <MapRow
                            node={lesson}
                            activeId={activeId}
                            onSelect={onSelect}
                          />
                          {chain.length > 0 ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1 pl-0.5">
                              {chain.map((step, index) => (
                                <span
                                  key={step.id}
                                  className="flex items-center gap-1"
                                >
                                  {index > 0 ? (
                                    <span
                                      aria-hidden
                                      className="h-px w-2.5 bg-line"
                                    />
                                  ) : null}
                                  <FlowDot
                                    node={step}
                                    activeId={activeId}
                                    onSelect={onSelect}
                                  />
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function MapRow({
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
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors ${
        clickable ? "cursor-pointer hover:bg-line/40" : "cursor-default"
      } ${activeId === node.id ? "bg-accent/10 text-accent" : ""} ${
        node.placeholder ? "text-muted opacity-70" : ""
      } ${emphasize ? "font-semibold" : ""}`}
    >
      {node.hasOpenFlag ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
        />
      ) : null}
      <span className="truncate">{node.label}</span>
    </button>
  );
}

function FlowDot({
  node,
  activeId,
  onSelect,
}: {
  node: MapNode;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
}) {
  const clickable = Boolean(onSelect) && !node.placeholder;
  const tone = node.placeholder
    ? "bg-line"
    : node.kind === "assessment"
      ? "bg-accent"
      : "bg-muted";
  return (
    <button
      type="button"
      title={node.label}
      aria-label={node.label}
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone} ${
        clickable ? "cursor-pointer" : ""
      } ${activeId === node.id ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""} ${
        node.hasOpenFlag ? "ring-1 ring-danger" : ""
      }`}
    />
  );
}
