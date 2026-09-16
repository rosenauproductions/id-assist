import Link from "next/link";
import {
  listPendingInvitations,
  listWorkspaceMembers,
  requireWorkspaceContext,
} from "@/lib/team/store";
import { TeamPanel } from "./team-panel";

export default async function TeamPage() {
  const context = await requireWorkspaceContext();
  const [members, pendingInvitations] = await Promise.all([
    listWorkspaceMembers(context.workspaceId),
    listPendingInvitations(context.workspaceId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        {context.workspaceName}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Team</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Everyone here shares every project in this workspace — there&apos;s no
        per-project assignment. Only owners can invite, remove, or promote
        teammates.
      </p>
      <TeamPanel
        currentUserId={context.userId}
        isOwner={context.role === "owner"}
        members={members}
        pendingInvitations={pendingInvitations}
      />
    </main>
  );
}
