import Link from "next/link";
import { ProjectList } from "@/app/projects/project-list";
import { listProjects } from "@/lib/id/store";
import { listPendingInvitations, listWorkspaceMembers, requireWorkspaceContext } from "@/lib/team/store";
import type { IdProject } from "@/lib/id/types";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function openFilterCount(project: IdProject): number {
  return project.outline.filters.filter(
    (filter) => !filter.resolved && filter.severity !== "pass",
  ).length;
}

function hoursLoggedSince(projects: IdProject[], since: Date): number {
  const cutoff = since.getTime();
  return projects.reduce((total, project) => {
    const recent = (project.timeLogs ?? []).filter(
      (log) => new Date(log.loggedAt).getTime() >= cutoff,
    );
    return total + recent.reduce((sum, log) => sum + log.hours, 0);
  }, 0);
}

export default async function Home() {
  const context = await requireWorkspaceContext();
  const [projects, members, pendingInvitations] = await Promise.all([
    listProjects(),
    listWorkspaceMembers(context.workspaceId),
    listPendingInvitations(context.workspaceId),
  ]);

  const activeProjects = projects.filter(
    (project) => project.outline.status !== "approved",
  ).length;
  const openFindings = projects.reduce(
    (sum, project) => sum + openFilterCount(project),
    0,
  );
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hoursThisWeek = hoursLoggedSince(projects, weekAgo);
  const recent = [...projects]
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            {context.workspaceName}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Welcome back, {context.email.split("@")[0]}
          </h1>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Projects in flight" value={String(activeProjects)} />
        <Stat label="Total projects" value={String(projects.length)} />
        <Stat label="Open filter findings" value={String(openFindings)} />
        <Stat label="Hours logged this week" value={hoursThisWeek.toFixed(1)} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <LaunchTile
              href="/wizard"
              eyebrow="Guided"
              title="Start wizard"
              description="Step through the brief one question at a time, with coaching as you go."
            />
            <LaunchTile
              href="/projects/new"
              eyebrow="Fast"
              title="New course brief"
              description="Fill the full brief form in one pass if you already know the shape of it."
            />
          </div>

          <section className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <span className="text-xs text-muted">last updated</span>
            </div>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing yet — compile a brief to get started.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {recent.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-line bg-background px-3 py-2 text-sm hover:border-accent/40"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {project.outline.brief.title || "Untitled course"}
                      </span>
                      <StatusPill status={project.outline.status} />
                      <span className="shrink-0 text-xs text-muted">
                        {relativeTime(project.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-line bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Team</h2>
            <Link
              href="/team"
              className="text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              Manage
            </Link>
          </div>
          <div className="mt-3 flex -space-x-2">
            {members.slice(0, 6).map((member) => (
              <span
                key={member.id}
                title={member.email}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-accent/15 text-sm font-semibold text-accent"
              >
                {member.email.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            {members.length} {members.length === 1 ? "member" : "members"}
            {pendingInvitations.length > 0
              ? ` · ${pendingInvitations.length} invite${pendingInvitations.length === 1 ? "" : "s"} pending`
              : ""}
          </p>
          <Link
            href="/team"
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40"
          >
            Invite a teammate
          </Link>
        </section>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
            Projects
          </h2>
          <span className="text-xs text-muted">{projects.length} saved</span>
        </div>
        <ProjectList projects={projects} />
      </section>
    </main>
  );
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

function LaunchTile({
  href,
  eyebrow,
  title,
  description,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-line bg-card p-5 transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
        {eyebrow}
      </p>
      <p className="mt-1 text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <span className="mt-3 inline-block text-sm font-medium text-accent">
        Launch →
      </span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "bg-accent/10 text-accent"
      : status === "needs_review"
        ? "bg-warn/10 text-warn"
        : "bg-muted/10 text-muted";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
