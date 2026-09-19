"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProjectAction } from "@/app/actions";
import { StatusPill } from "@/components/status";
import type { IdProject } from "@/lib/id/types";

export function ProjectList({ projects }: { projects: IdProject[] }) {
  if (projects.length === 0) {
    return (
      <ul className="mt-4 grid gap-3">
        <li className="rounded-xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-sm text-muted">
          None yet. Compile a brief to open the outline gate.
        </li>
      </ul>
    );
  }

  return (
    <ul className="mt-4 grid gap-3">
      {projects.map((project) => (
        <ProjectListItem key={project.id} project={project} />
      ))}
    </ul>
  );
}

function ProjectListItem({ project }: { project: IdProject }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    const title = project.outline.brief.title;
    if (!window.confirm(`Delete “${title}”? This removes the project and its delivery files.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteProjectAction(project.id);
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  return (
    <li className="rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{project.outline.brief.title}</span>
            <StatusPill status={project.outline.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {project.estimate.p50Hours} h P50 · $
            {project.estimate.p50CostUsd.toLocaleString()} ·{" "}
            {project.estimate.calendarDays} d · {project.estimate.basis}
          </p>
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="rounded-md border border-danger/30 px-2.5 py-1.5 text-xs font-medium text-danger disabled:opacity-40"
        >
          Delete
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </li>
  );
}
