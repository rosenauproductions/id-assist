import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountDetail, requirePlatformAdmin } from "@/lib/admin/store";
import { listPendingInvitations } from "@/lib/team/store";
import { listPendingPasswordResets } from "@/lib/auth/password-reset";
import { StatusPill } from "@/components/status";
import {
  addAccountNoteAction,
  addUserToAccountAction,
  createPasswordResetLinkAction,
  renameAccountAction,
  setAccountManagerAction,
  setAccountStatusAction,
  startImpersonationAction,
} from "../../actions";
import { InviteLinkRow } from "./invite-link-row";
import { ResetLinkRow } from "./reset-link-row";

const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: "active", label: "Activate" },
  { status: "suspended", label: "Suspend" },
  { status: "canceled", label: "Cancel account" },
];

export default async function AdminAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let admin;
  try {
    admin = await requirePlatformAdmin();
  } catch {
    notFound();
  }
  const account = await getAccountDetail(id);
  if (!account) notFound();

  const pendingInvitations = await listPendingInvitations(id);
  const pendingPasswordResets = await listPendingPasswordResets(id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Accounts
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            Account
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {account.name}
          </h1>
        </div>
        <StatusPill status={account.status} />
      </div>

      <p className="mt-2 text-sm text-muted">
        Created {new Date(account.createdAt).toLocaleDateString()}
        {account.trialEndsAt
          ? ` · trial ends ${new Date(account.trialEndsAt).toLocaleDateString()}`
          : ""}
        {account.suspendedAt
          ? ` · suspended ${new Date(account.suspendedAt).toLocaleDateString()}`
          : ""}
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold">Account name</h2>
          <form action={renameAccountAction} className="mt-3 flex gap-2">
            <input type="hidden" name="workspaceId" value={account.id} />
            <input
              name="name"
              defaultValue={account.name}
              placeholder="Company or organization name"
              className="field"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40"
            >
              Save
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold">Status</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_ACTIONS.map((action) => (
              <form key={action.status} action={setAccountStatusAction}>
                <input type="hidden" name="workspaceId" value={account.id} />
                <input type="hidden" name="status" value={action.status} />
                <button
                  type="submit"
                  disabled={account.status === action.status}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40 disabled:opacity-40"
                >
                  {action.label}
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-sm font-semibold">Account manager</h2>
          <form
            action={setAccountManagerAction}
            className="mt-3 flex gap-2"
          >
            <input type="hidden" name="workspaceId" value={account.id} />
            <input
              name="label"
              defaultValue={account.accountManagerLabel ?? ""}
              placeholder="Unassigned"
              className="field"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40"
            >
              Save
            </button>
          </form>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="mt-3 grid gap-2">
          {account.members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-background px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{member.email}</p>
                <p className="text-xs text-muted">
                  {member.role} · joined{" "}
                  {new Date(member.createdAt).toLocaleDateString()}
                </p>
              </div>
              {member.id === admin.userId ? (
                <span className="text-xs text-muted">You</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={startImpersonationAction} className="flex items-center gap-2">
                    <input type="hidden" name="targetUserId" value={member.id} />
                    <input
                      name="reason"
                      placeholder="Reason (optional)"
                      className="field w-40 text-xs"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md border border-warn/40 px-3 py-1.5 text-xs font-medium text-warn hover:bg-warn/10"
                    >
                      Act as
                    </button>
                  </form>
                  <form action={createPasswordResetLinkAction}>
                    <input type="hidden" name="workspaceId" value={account.id} />
                    <input type="hidden" name="targetUserId" value={member.id} />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40"
                    >
                      Send password link
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>

        <form
          action={addUserToAccountAction}
          className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1.5fr_auto_auto]"
        >
          <input type="hidden" name="workspaceId" value={account.id} />
          <input
            name="email"
            type="email"
            required
            placeholder="Add a user by email"
            className="field"
          />
          <select name="role" defaultValue="member" className="field">
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Invite
          </button>
        </form>

        {pendingInvitations.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {pendingInvitations.map((invitation) => (
              <InviteLinkRow key={invitation.id} token={invitation.token} email={invitation.email} />
            ))}
          </ul>
        ) : null}

        {pendingPasswordResets.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {pendingPasswordResets.map((reset) => (
              <ResetLinkRow key={reset.id} token={reset.token} email={reset.email} />
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Projects</h2>
        <p className="mt-1 text-xs text-muted">
          Read-only here — use &quot;Act as&quot; above to actually open one.
        </p>
        {account.projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No projects yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {account.projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-background px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {project.title || "Untitled course"}
                </span>
                <StatusPill status={project.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Notes</h2>
        <p className="mt-1 text-xs text-muted">Internal only — never shown to the account.</p>
        <ul className="mt-3 grid gap-2">
          {account.notes.map((note) => (
            <li key={note.id} className="rounded-md border border-line bg-background px-3 py-2 text-sm">
              <p>{note.body}</p>
              <p className="mt-1 text-xs text-muted">
                {note.authorEmail ?? "Unknown"} ·{" "}
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
        <form action={addAccountNoteAction} className="mt-3 grid gap-2">
          <input type="hidden" name="workspaceId" value={account.id} />
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Add a note…"
            className="field"
          />
          <button
            type="submit"
            className="w-fit rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40"
          >
            Add note
          </button>
        </form>
      </section>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.55rem 0.75rem;
        }
        .field:focus {
          outline: 2px solid color-mix(in oklab, var(--accent) 35%, transparent);
          outline-offset: 1px;
        }
      `}</style>
    </main>
  );
}
