"use client";

import { useEffect, useRef, useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { alwaysAllowFilterAction, dismissFilterAction } from "@/app/actions";
import type { FilterHit } from "@/lib/id/types";

/**
 * The inline pedagogy-flag marker: a small red inverted triangle rendered
 * next to whatever outline text a FilterHit's targetId points at (an
 * objective, lesson, or assessment). Right-click (or click, for
 * discoverability without a mouse) offers "Dismiss" — this instance only,
 * reusing the same dismissFilterAction the Quality checks tab already uses —
 * or "Always allow this issue", which mutes the rule for the whole
 * workspace going forward (see lib/id/acceptable-rules.ts and Settings →
 * Acceptable issues). Renders nothing when there's nothing open to flag,
 * so it's safe to drop next to every entity unconditionally.
 */
export function FlagMarker({
  projectId,
  filters,
}: {
  projectId: string;
  filters: FilterHit[];
}) {
  const open = filters.filter((f) => !f.resolved && f.severity !== "pass");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  if (open.length === 0) return null;

  // The menu acts on the single most severe open hit when there's more
  // than one on the same target; the others surface via the Quality checks
  // tab, which still lists everything regardless of what's inline here.
  const primary =
    open.find((f) => f.severity === "block") ??
    open.find((f) => f.severity === "split") ??
    open[0];

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        title={`${open.length} open issue${open.length > 1 ? "s" : ""} — click for options`}
        onContextMenu={(event) => {
          event.preventDefault();
          setPos({ x: event.clientX, y: event.clientY });
          setMenuOpen(true);
        }}
        onClick={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setPos({ x: rect.left, y: rect.bottom + 4 });
          setMenuOpen((value) => !value);
        }}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-danger hover:bg-danger/10"
      >
        <ExclamationTriangleIcon className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        <span className="sr-only">{open.length} open issue{open.length > 1 ? "s" : ""}</span>
      </button>

      {menuOpen && pos ? (
        <div
          ref={menuRef}
          style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }}
          className="w-64 rounded-md border border-line bg-card p-1 text-sm shadow-lg"
        >
          <p className="px-2 py-1.5 text-xs text-muted">{primary.message}</p>
          {primary.severity !== "block" ? (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void dismissFilterAction(projectId, primary.id, "dismissed inline");
              }}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-background"
            >
              Dismiss
            </button>
          ) : (
            <p className="px-2 py-1 text-xs text-muted">
              Blocking issues can&apos;t be dismissed.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void alwaysAllowFilterAction(projectId, primary.code);
            }}
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-background"
          >
            Always allow this issue
          </button>
        </div>
      ) : null}
    </span>
  );
}
