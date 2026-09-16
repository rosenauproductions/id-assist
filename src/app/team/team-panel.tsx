"use client";

import { useState, useTransition } from "react";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  setMemberRoleAction,
} from "./actions";
import type { PendingInvitation, WorkspaceMember } from "@/lib/team/store";

export function TeamPanel({
  currentUserId,
  isOwner,
  members,
  pendingInvitations,
}: {
  currentUserId: string;
  isOwner: boolean;
  members: WorkspaceMember[];
  pendingInvitations: PendingInvitation[];
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-8 grid gap-6">
      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="mt-3 grid gap-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === currentUserId}
              canManage={isOwner}
              onError={setError}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Pending invites</h2>
          <span className="text-xs text-muted">{pendingInvitations.length} open</span>
        </div>
        {pendingInvitations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nobody&apos;s waiting on an invite.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {pendingInvitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                canManage={isOwner}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Invite a teammate</h2>
          <p className="mt-1 text-sm text-muted">
            There&apos;s no email sending yet — invite creates a link you copy and
            send yourself.
          </p>
          <InviteForm onError={setError} />
        </section>
      ) : null}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  member: "Member",
};

function MemberRow({
  member,
  isSelf,
  canManage,
  onError,
}: {
  member: WorkspaceMember;
  isSelf: boolean;
  canManage: boolean;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  function changeRole(role: string) {
    onError(null);
    const formData = new FormData();
    formData.set("memberUserId", member.id);
    formData.set("role", role);
    startTransition(async () => {
      try {
        await setMemberRoleAction(formData);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not change role");
      }
    });
  }

  function remove() {
    if (!window.confirm(`Remove ${member.email} from the workspace?`)) return;
    onError(null);
    startTransition(async () => {
      try {
        await removeMemberAction(member.id);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not remove member");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-background px-3 py-2 text-sm">
      <div className="flex items-center gap-2.5">
        <Avatar email={member.email} />
        <div>
          <p className="font-medium">
            {member.email}
            {isSelf ? <span className="text-muted"> (you)</span> : null}
          </p>
          <p className="text-xs text-muted">
            Joined {new Date(member.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      {canManage ? (
        <div className="flex items-center gap-2">
          <select
            value={member.role}
            disabled={pending}
            onChange={(event) => changeRole(event.target.value)}
            className="field text-xs"
          >
            <option value="owner">Owner</option>
            <option value="member">Member</option>
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="text-xs text-muted hover:text-danger disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      ) : (
        <span className="text-xs text-muted">{ROLE_LABEL[member.role]}</span>
      )}
    </li>
  );
}

function InvitationRow({
  invitation,
  canManage,
  onError,
}: {
  invitation: PendingInvitation;
  canManage: boolean;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const link = `${window.location.origin}/signup?invite=${invitation.token}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => onError("Couldn't copy — select and copy the link manually."));
  }

  function revoke() {
    onError(null);
    startTransition(async () => {
      try {
        await revokeInvitationAction(invitation.id);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not revoke invite");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-background px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{invitation.email}</p>
        <p className="text-xs text-muted">
          {ROLE_LABEL[invitation.role]} · invited by {invitation.invitedByEmail} ·{" "}
          {new Date(invitation.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="text-xs font-medium text-accent"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
        {canManage ? (
          <button
            type="button"
            disabled={pending}
            onClick={revoke}
            className="text-xs text-muted hover:text-danger disabled:opacity-40"
          >
            Revoke
          </button>
        ) : null}
      </div>
    </li>
  );
}

function InviteForm({ onError }: { onError: (message: string | null) => void }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <form
      className="mt-3 grid grid-cols-[1fr_auto_auto] items-end gap-2"
      action={(formData) => {
        onError(null);
        setDone(false);
        startTransition(async () => {
          try {
            await inviteMemberAction(formData);
            setDone(true);
          } catch (err) {
            onError(err instanceof Error ? err.message : "Could not send invite");
          }
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Email
        </span>
        <input
          required
          name="email"
          type="email"
          disabled={pending}
          className="field"
          placeholder="teammate@example.com"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Role
        </span>
        <select name="role" defaultValue="member" disabled={pending} className="field">
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Inviting…" : done ? "Invited" : "Invite"}
      </button>
      <style>{`
        .field {
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.5rem 0.65rem;
          font-size: 0.875rem;
        }
        .btn-primary {
          border-radius: 0.5rem;
          background: var(--foreground);
          color: var(--background);
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
      `}</style>
    </form>
  );
}

function Avatar({ email }: { email: string }) {
  const initial = email.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
      {initial}
    </span>
  );
}
