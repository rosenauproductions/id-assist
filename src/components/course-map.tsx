"use client";

import { useState } from "react";
import type { CourseMapData, MapNode } from "@/lib/id/course-map";

// Renders the course-structure map as a small timeline-style tree: modules
// at the root, their lessons indented one level in and separated by thin
// dividers, and each lesson's check connected in with a small corner
// glyph — scaled to fit a narrow sticky sidebar.

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
  /** Opens the tutor-bot editor for a lesson, linking a fresh bot first if needed. */
  onOpenTutorBot: (lessonId: string) => void;
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
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </p>

      {modules.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyHint}</p>
      ) : (
        <ol className="mt-3 grid divide-y divide-line">
          {modules.map((courseModule) => {
            const lessons = byParent(data.nodes, courseModule.id, "lesson");
            return (
              <li key={courseModule.id} className="min-w-0 py-3 first:pt-0 last:pb-0">
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
                  <ol className="mt-2 ml-[0.4rem] grid divide-y divide-line border-l-2 border-accent/25 pl-3">
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
                        <li key={lesson.id} className="min-w-0 py-2 first:pt-0 last:pb-0">
                          <div
                            onContextMenu={
                              addHandlers
                                ? (event) =>
                                    openMenu(event, [
                                      ...(hasAssessment
                                        ? []
                                        : [
                                            {
                                              label: "Add quiz",
                                              onClick: () => addHandlers.onAddQuiz(lesson.id),
                                            },
                                          ]),
                                      {
                                        label: "Tutor bot",
                                        onClick: () => addHandlers.onOpenTutorBot(lesson.id),
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
                            <ol className="mt-1.5 ml-[0.4rem] grid gap-1">
                              {chain.map((step) => (
                                <li key={step.id} className="min-w-0">
                                  <MapRow node={step} activeId={activeId} onSelect={onSelect} branch />
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

/** Small decorative "signal" glyph prefixed on every module/lesson row —
 * a stand-in for a richer per-row status icon later; purely visual today. */
function RowGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 ${className}`}
      fill="none"
    >
      <path
        d="M1 5.5c1.2-1.2 2.4-1.2 3.6 0s2.4 1.2 3.6 0 2.4-1.2 3.6 0 2.4 1.2 3.6 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M1 9.5c1.2-1.2 2.4-1.2 3.6 0s2.4 1.2 3.6 0 2.4-1.2 3.6 0 2.4 1.2 3.6 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Clipboard glyph used on the nested assessment ("check") row. */
function ClipboardGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 ${className}`}
      fill="none"
    >
      <rect x="3" y="2.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="5.5" y="1.5" width="5" height="2" rx="0.75" fill="currentColor" />
      <path d="M5.5 8h5M5.5 10.5h5M5.5 5.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Small corner connector leading into the nested assessment row, standing
 * in for a straight tree line since a check hangs off just one lesson. */
function CornerConnector() {
  return (
    <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0 text-accent/40">
      <path
        d="M2 0v5c0 2.2 1.8 4 4 4h6"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapRow({
  node,
  activeId,
  onSelect,
  emphasize = false,
  branch = false,
}: {
  node: MapNode;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
  emphasize?: boolean;
  /** True for a nested row (the lesson's check) — shown with a corner
   * connector + clipboard glyph instead of the wave glyph + dot. */
  branch?: boolean;
}) {
  const clickable = Boolean(onSelect) && !node.placeholder;
  return (
    <button
      type="button"
      title={node.label}
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left ${
        branch ? "text-xs" : emphasize ? "text-[0.95rem]" : "text-sm"
      } transition-colors ${
        clickable ? "cursor-pointer hover:bg-line/40" : "cursor-default"
      } ${activeId === node.id ? "bg-accent/10 text-accent" : ""} ${
        node.placeholder ? "text-muted opacity-70" : ""
      } ${emphasize ? "font-semibold" : ""}`}
    >
      {branch ? (
        <>
          <CornerConnector />
          <ClipboardGlyph className="text-muted" />
        </>
      ) : (
        <>
          <RowGlyph className="text-muted/60" />
          <span
            aria-hidden
            className={`shrink-0 rounded-full ${emphasize ? "h-2.5 w-2.5" : "h-2 w-2"} ${
              node.hasOpenFlag ? "bg-danger" : "bg-foreground/70"
            }`}
          />
        </>
      )}
      <span className={`min-w-0 flex-1 truncate ${branch ? "text-muted" : ""}`}>
        {node.label}
      </span>
    </button>
  );
}
