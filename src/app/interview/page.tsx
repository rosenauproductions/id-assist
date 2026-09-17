import Link from "next/link";
import { listInterviewSessions } from "@/lib/interview/store";
import { StatusPill } from "@/components/status";
import { createInterviewAction, deleteInterviewSessionAction } from "./actions";

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

export default async function InterviewListPage() {
  const sessions = await listInterviewSessions();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Intake
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        SME interviews
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Interview a subject-matter expert live on a call, or send them a link
        to answer on their own. Either way it synthesizes into a normal
        course brief you review before creating a project.
      </p>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Start a new interview</h2>
        <form action={createInterviewAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">SME name (optional)</span>
            <input name="smeName" className="field" placeholder="Jordan Ruiz" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Working title (optional)</span>
            <input
              name="courseWorkingTitle"
              className="field"
              placeholder="Sev-2 incident review"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Start interview
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No interviews yet — start one above.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-background px-3 py-2 text-sm"
              >
                <Link
                  href={
                    session.status === "completed" && session.projectId
                      ? `/projects/${session.projectId}`
                      : `/interview/${session.id}`
                  }
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">
                    {session.courseWorkingTitle || "Untitled interview"}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {session.smeName ? `with ${session.smeName} · ` : ""}
                    {relativeTime(session.updatedAt)}
                  </span>
                </Link>
                <StatusPill status={session.status} />
                <form action={deleteInterviewSessionAction.bind(null, session.id)}>
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-danger"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.5rem 0.7rem;
        }
      `}</style>
    </main>
  );
}
