"use client";

import { useState } from "react";
import type { CourseMapData, MapNode } from "@/lib/id/course-map";

// Renders the course-structure map as a traditional nested tree: modules
// at the root, their lessons indented one level in, and each lesson's
// Gagné-event units (plus its check) indented a level further still, each
// row prefixed with a branch glyph (├─ / └─) — an actual outline, not a
// row of connected dots — scaled to fit a narrow sticky sidebar.

function byParent(nodes: MapNode[], parentId: string, kind: MapNode["kind"]) {
  return nodes
    .filter((node) => node.parentId === parentId && node.kind === kind)
    .sort((a, b) => a.order - b.order);
}

// Right-click "add" menu, wired up only from the project workspace (the
// wizard's skeleton preview passes no addHandlers, so it renders exactly
// as before). Adding is the only structural edit this tree offers today
// — no delete/reorder yet.
export type CourseMapAddHandlers = {
  onAddModule: () => void;
  onAddLesson: (moduleId: string) => void;
  onAddQuiz: (lessonId: string) => void;
};

type MenuItem = { label: string; onClick: () => void };
type MenuState = { x: number; y: number; items: MenuItem[] };

export function CourseMap({
  data,
  title = "Course map",
  emptyHint = "Nothing to map yet.",
  activeId,
  onSelect,
  addHandlers,
}: {
  data: CourseMapData;
  title?: string;
  emptyHint?: string;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
  addHandlers?: CourseMapAddHandlers;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  function openMenu(event: React.MouseEvent, items: MenuItem[]) {
    if (items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  }

  const modules = data.nodes
    .filter((node) => node.kind === "module")
    .sort((a, b) => a.order - b.order);

  return (
    <div
      className="relative rounded-xl border border-line bg-card p-4"
      onContextMenu={
        addHandlers
          ? (event) =>
              openMenu(event, [
                { label: "Add module", onClick: addHandlers.onAddModule },
              ])
          : undefined
      }
    >
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
              <li key={courseModule.id} className="min-w-0">
                <div
                  onContextMenu={
                    addHandlers
                      ? (event) =>
                          openMenu(event, [
                            {
                              label: "Add lesson",
                              onClick: () => addHandlers.onAddLesson(courseModule.id),
                            },
                          ])
                      : undefined
                  }
                >
                  <MapRow
                    node={courseModule}
                    activeId={activeId}
                    onSelect={onSelect}
                    emphasize
                  />
                </div>
                {lessons.length > 0 ? (
                  <ol className="mt-1.5 ml-1.5 grid gap-2 border-l border-line pl-3">
                    {lessons.map((lesson) => {
                      const chain = [
                        ...byParent(data.nodes, lesson.id, "unit"),
                        ...byParent(data.nodes, lesson.id, "assessment"),
                      ];
                      const hasAssessment = byParent(
                        data.nodes,
                        lesson.id,
                        "assessment",
                      ).length > 0;
                      return (
                        <li key={lesson.id} className="min-w-0">
                          <div
                            onContextMenu={
                              addHandlers && !hasAssessment
                                ? (event) =>
                                    openMenu(event, [
                                      {
                                        label: "Add quiz",
                                        onClick: () => addHandlers.onAddQuiz(lesson.id),
                                      },
                                    ])
                                : undefined
                            }
                          >
                            <MapRow
                              node={lesson}
                              activeId={activeId}
                              onSelect={onSelect}
                            />
                          </div>
                          {chain.length > 0 ? (
                            <ol className="mt-1 ml-1.5 grid gap-0.5 border-l border-line pl-3">
                              {chain.map((step, index) => (
                                <li key={step.id} className="min-w-0">
                                  <MapRow
                                    node={step}
                                    activeId={activeId}
                                    onSelect={onSelect}
                                    branch={
                                      index === chain.length - 1 ? "└─" : "├─"
                                    }
                                  />
                                </li>
                              ))}
                            </ol>
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

      {menu ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(null);
            }}
          />
          <ul
            className="fixed z-50 min-w-[9rem] overflow-hidden rounded-md border border-line bg-card py-1 text-sm shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            {menu.items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-line/40"
                  onClick={() => {
                    item.onClick();
                    setMenu(null);
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function MapRow({
  node,
  activeId,
  onSelect,
  emphasize = false,
  branch,
}: {
  node: MapNode;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
  emphasize?: boolean;
  /** Tree connector glyph ("├─" / "└─") shown before the label — set only
   * for a nested row (units/assessments under a lesson) so it reads as an
   * outline branch rather than a top-level item. */
  branch?: string;
}) {
  const clickable = Boolean(onSelect) && !node.placeholder;
  return (
    <button
      type="button"
      title={node.label}
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left ${
        branch ? "text-xs" : "text-sm"
      } transition-colors ${
        clickable ? "cursor-pointer hover:bg-line/40" : "cursor-default"
      } ${activeId === node.id ? "bg-accent/10 text-accent" : ""} ${
        node.placeholder ? "text-muted opacity-70" : ""
      } ${emphasize ? "font-semibold" : ""}`}
    >
      {branch ? (
        <span aria-hidden className="shrink-0 font-mono text-muted">
          {branch}
        </span>
      ) : null}
      {node.hasOpenFlag ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
    </button>
  );
}
