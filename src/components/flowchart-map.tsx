"use client";

import { useId } from "react";
import Link from "next/link";
import {
  DEFAULT_MAP_SHAPES,
  MAP_NODE_KINDS,
  MAP_NODE_KIND_LABELS,
  type CourseMapData,
  type MapCompletion,
  type MapNode,
  type MapNodeKind,
  type MapShapeSettings,
  type NodeShape,
} from "@/lib/id/course-map";
import { ShapeSwatch, shapeClipStyle } from "@/components/node-shape";

// Full-width flowchart view for the Map tab's Construction sub-view
// (roadmap section 13 follow-up: "assign shapes to different tasks").
// Renders the same CourseMapData the old grid-of-cards ConstructionMap
// did, but as an actual flowchart: a module-by-module spine down the
// left, each module fanning out to its lessons, each lesson chaining
// rightward through its instructional units to its assessment — with
// every node drawn in its account-configured shape (see Settings) and
// colored by its Construction/Completion status, same semantics as
// before. Course-level Start/Finish bookends are fixed ovals, not part
// of the configurable shape set (they aren't a MapNodeKind).

const BOX_W = 176;
const BOX_H = 60;
const ROW_H = 96;
const COL_W = 208;
const MARGIN_X = 40;
const MARGIN_Y = 32;

const COMPLETION_STYLES: Record<
  MapCompletion,
  { bg: string; border: string; label: string }
> = {
  empty: { bg: "bg-card", border: "border-line", label: "Not started" },
  partial: { bg: "bg-warn/15", border: "border-warn", label: "In progress" },
  complete: { bg: "bg-accent/15", border: "border-accent", label: "Complete" },
  issue: { bg: "bg-danger/15", border: "border-danger", label: "Needs attention" },
};

function byParent(nodes: MapNode[], parentId: string, kind: MapNodeKind) {
  return nodes
    .filter((node) => node.parentId === parentId && node.kind === kind)
    .sort((a, b) => a.order - b.order);
}

function chainFor(nodes: MapNode[], lessonId: string) {
  return [
    ...byParent(nodes, lessonId, "unit"),
    ...byParent(nodes, lessonId, "assessment"),
  ];
}

function colX(col: number) {
  return MARGIN_X + col * COL_W + BOX_W / 2;
}

function elbowPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = x1 + (x2 - x1) / 2;
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
}

function straightPath(x1: number, y1: number, x2: number, y2: number) {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

type Placed = { node: MapNode; row: number; col: number };

export function FlowchartMap({
  data,
  shapes,
  activeId,
  onSelect,
}: {
  data: CourseMapData;
  shapes?: MapShapeSettings;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
}) {
  const resolvedShapes: MapShapeSettings = { ...DEFAULT_MAP_SHAPES, ...shapes };
  const arrowId = useId();

  const modules = data.nodes
    .filter((node) => node.kind === "module")
    .sort((a, b) => a.order - b.order);

  if (modules.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing to map yet — compile or approve an outline first.
      </p>
    );
  }

  // Row 0 is reserved for the Start bookend. Each module occupies the row
  // of its first lesson (top-aligned, so the module-to-module spine only
  // ever moves down the page); a module with no lessons gets a row of its
  // own. Each lesson gets exactly one row, and its unit/assessment chain
  // lays out rightward on that same row.
  const placed: Placed[] = [];
  const moduleRows: number[] = [];
  let row = 1;
  let maxChainLen = 0;

  modules.forEach((courseModule) => {
    const lessons = byParent(data.nodes, courseModule.id, "lesson");
    const moduleRow = row;
    moduleRows.push(moduleRow);
    placed.push({ node: courseModule, row: moduleRow, col: 0 });

    if (lessons.length === 0) {
      row += 1;
      return;
    }

    lessons.forEach((lesson) => {
      const lessonRow = row;
      placed.push({ node: lesson, row: lessonRow, col: 1 });
      const chain = chainFor(data.nodes, lesson.id);
      maxChainLen = Math.max(maxChainLen, chain.length);
      chain.forEach((step, index) => {
        placed.push({ node: step, row: lessonRow, col: 2 + index });
      });
      row += 1;
    });
  });

  const startRow = 0;
  const endRow = row; // one past the last row actually used
  const totalCols = Math.max(2, 2 + maxChainLen);
  const rowY = (r: number) => MARGIN_Y + r * ROW_H + BOX_H / 2;
  const width = MARGIN_X * 2 + totalCols * COL_W;
  const height = rowY(endRow) + BOX_H / 2 + MARGIN_Y;

  const spineX = colX(0);
  const startY = rowY(startRow);
  const endY = rowY(endRow);

  const edges: { key: string; d: string }[] = [
    {
      key: "start-edge",
      d: straightPath(spineX, startY + BOX_H / 2, spineX, rowY(moduleRows[0]) - BOX_H / 2),
    },
    {
      key: "end-edge",
      d: straightPath(
        spineX,
        rowY(moduleRows[moduleRows.length - 1]) + BOX_H / 2,
        spineX,
        endY - BOX_H / 2,
      ),
    },
  ];

  for (let i = 0; i < moduleRows.length - 1; i += 1) {
    edges.push({
      key: `module-chain-${modules[i].id}`,
      d: straightPath(spineX, rowY(moduleRows[i]) + BOX_H / 2, spineX, rowY(moduleRows[i + 1]) - BOX_H / 2),
    });
  }

  modules.forEach((courseModule, moduleIndex) => {
    const moduleY = rowY(moduleRows[moduleIndex]);
    const lessons = byParent(data.nodes, courseModule.id, "lesson");
    lessons.forEach((lesson) => {
      const lessonPlacement = placed.find((p) => p.node.id === lesson.id);
      if (!lessonPlacement) return;
      const lessonY = rowY(lessonPlacement.row);

      edges.push({
        key: `module-lesson-${lesson.id}`,
        d: elbowPath(spineX + BOX_W / 2, moduleY, colX(1) - BOX_W / 2, lessonY),
      });

      const chain = chainFor(data.nodes, lesson.id);
      let prevRightEdge = colX(1) + BOX_W / 2;
      chain.forEach((step, index) => {
        const stepX = colX(2 + index);
        edges.push({
          key: `chain-${lesson.id}-${step.id}`,
          d: straightPath(prevRightEdge, lessonY, stepX - BOX_W / 2, lessonY),
        });
        prevRightEdge = stepX + BOX_W / 2;
      });
    });
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-4">
          {(Object.keys(COMPLETION_STYLES) as MapCompletion[]).map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full border ${COMPLETION_STYLES[key].bg} ${COMPLETION_STYLES[key].border}`}
              />
              {COMPLETION_STYLES[key].label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {MAP_NODE_KINDS.map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <ShapeSwatch shape={resolvedShapes[kind]} className="h-3 w-3" />
              {MAP_NODE_KIND_LABELS[kind]}
            </span>
          ))}
          <Link href="/settings" className="text-accent hover:underline">
            Customize shapes
          </Link>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-line bg-background">
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} className="pointer-events-none absolute inset-0">
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="var(--line)" />
              </marker>
            </defs>
            {edges.map((edge) => (
              <path
                key={edge.key}
                d={edge.d}
                fill="none"
                stroke="var(--line)"
                strokeWidth={1.5}
                markerEnd={`url(#${arrowId})`}
              />
            ))}
          </svg>

          <Bookend label="Start" x={spineX} y={startY} />
          {placed.map(({ node, row: r, col }) => (
            <FlowNode
              key={node.id}
              node={node}
              x={colX(col)}
              y={rowY(r)}
              shape={resolvedShapes[node.kind]}
              activeId={activeId}
              onSelect={onSelect}
            />
          ))}
          <Bookend label="Finish" x={spineX} y={endY} />
        </div>
      </div>
    </div>
  );
}

function Bookend({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <div
      className="absolute flex items-center justify-center border-2 border-line bg-card text-xs font-medium text-muted"
      style={{
        left: x - BOX_W / 2,
        top: y - BOX_H / 2,
        width: BOX_W,
        height: BOX_H,
        borderRadius: 9999,
      }}
    >
      {label}
    </div>
  );
}

function FlowNode({
  node,
  x,
  y,
  shape,
  activeId,
  onSelect,
}: {
  node: MapNode;
  x: number;
  y: number;
  shape: NodeShape;
  activeId?: string;
  onSelect?: (node: MapNode) => void;
}) {
  const style = COMPLETION_STYLES[node.completion ?? "empty"];
  const clickable = Boolean(onSelect) && !node.placeholder;
  const isActive = activeId === node.id;
  return (
    <button
      type="button"
      title={node.label}
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(node)}
      className={`absolute flex items-center justify-center border-2 px-3 text-center text-xs font-medium leading-tight transition-colors ${style.bg} ${style.border} ${
        clickable ? "cursor-pointer hover:brightness-95" : "cursor-default opacity-70"
      } ${isActive ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""}`}
      style={{
        left: x - BOX_W / 2,
        top: y - BOX_H / 2,
        width: BOX_W,
        height: BOX_H,
        ...shapeClipStyle(shape),
      }}
    >
      <span className="line-clamp-2 break-words">{node.label}</span>
    </button>
  );
}
