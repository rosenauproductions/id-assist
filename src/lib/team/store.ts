import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import {
  impersonationSessions,
  invitations,
  users,
  workspaces,
} from "@/lib/db/schema";
import { generateInviteToken } from "@/lib/auth/invite-token";

// Kept as a plain string constant (not imported from lib/admin/store) to
// avoid a circular import — lib/admin/store.ts already imports from this
// file. Must match impersonationCookieName() there.
const IMPERSONATION_COOKIE = "id-assist-impersonate";

export type MemberRole = "owner" | "member";

export type WorkspaceMember = {
  id: string;
  email: string;
  role: MemberRole;
  createdAt: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  createdAt: string;
  invitedByEmail: string;
};

export type WorkspaceContext = {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: MemberRole;
  /** Set when a platform admin is currently viewing as this user — see
   * lib/admin/store.ts. Every page reading this context can use it to show
   * the "you're impersonating" banner state, though the root layout banner
   * is the primary place it's surfaced. */
  impersonatedBy?: { adminUserId: string; adminEmail: string };
};

/**
 * Always re-reads the current user's workspace/role from the DB rather than
 * trusting the JWT — role can change (promote/demote) after the session was
 * issued, and this is the check every owner-only action gates on.
 */
export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await auth();
  const realUserId = session?.user?.id;
  if (!realUserId) throw new Error("Not signed in.");

  // A platform admin "acting as" this user overlays a different effective
  // user id on top of their own real login — the login session itself never
  // changes, so requirePlatformAdmin() (lib/admin/store.ts) keeps working
  // correctly for the real admin throughout.
  let effectiveUserId = realUserId;
  let impersonatedBy: WorkspaceContext["impersonatedBy"];

  const cookieStore = await cookies();
  const impersonationToken = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (impersonationToken) {
    const [impersonation] = await db
      .select({
        adminUserId: impersonationSessions.adminUserId,
        targetUserId: impersonationSessions.targetUserId,
        expiresAt: impersonationSessions.expiresAt,
        endedAt: impersonationSessions.endedAt,
      })
      .from(impersonationSessions)
      .where(eq(impersonationSessions.token, impersonationToken))
      .limit(1);

    const isValid =
      impersonation &&
      !impersonation.endedAt &&
      impersonation.expiresAt.getTime() > Date.now() &&
      impersonation.adminUserId === realUserId;

    if (isValid && impersonation) {
      effectiveUserId = impersonation.targetUserId;
      const [adminRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, realUserId))
        .limit(1);
      impersonatedBy = {
        adminUserId: realUserId,
        adminEmail: adminRow?.email ?? "",
      };
    }
  }

  const [row] = await db
    .select({
      email: users.email,
      role: users.role,
      workspaceId: users.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(users)
    .innerJoin(workspaces, eq(workspaces.id, users.workspaceId))
    .where(eq(users.id, effectiveUserId))
    .limit(1);
  if (!row) throw new Error("Account not found.");

  return {
    userId: effectiveUserId,
    email: row.email,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    role: row.role as MemberRole,
    impersonatedBy,
  };
}

export function requireOwner(context: WorkspaceContext) {
  if (context.role !== "owner") {
    throw new Error("Only a workspace owner can do that.");
  }
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.workspaceId, workspaceId))
    .orderBy(users.createdAt);
  return rows.map((row) => ({
    ...row,
    role: row.role as MemberRole,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPendingInvitations(
  workspaceId: string,
): Promise<PendingInvitation[]> {
  const inviter = { id: users.id, email: users.email };
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      token: invitations.token,
      createdAt: invitations.createdAt,
      invitedByEmail: inviter.email,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(
      and(
        eq(invitations.workspaceId, workspaceId),
        isNull(invitations.acceptedAt),
      ),
    )
    .orderBy(desc(invitations.createdAt));
  return rows.map((row) => ({
    ...row,
    role: row.role as MemberRole,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createInvitation(input: {
  workspaceId: string;
  invitedByUserId: string;
  email: string;
  role: MemberRole;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();

  const [existingMember] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.workspaceId, input.workspaceId), eq(users.email, email)))
    .limit(1);
  if (existingMember) {
    throw new Error("That email is already on the team.");
  }

  // Resend semantics: replace any prior pending invite for this email.
  await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.workspaceId, input.workspaceId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
      ),
    );

  await db.insert(invitations).values({
    workspaceId: input.workspaceId,
    invitedByUserId: input.invitedByUserId,
    email,
    role: input.role,
    token: generateInviteToken(),
  });
}

export async function revokeInvitation(
  invitationId: string,
  workspaceId: string,
): Promise<void> {
  await db
    .delete(invitations)
    .where(
      and(eq(invitations.id, invitationId), eq(invitations.workspaceId, workspaceId)),
    );
}

async function countOwners(workspaceId: string): Promise<number> {
  const owners = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.workspaceId, workspaceId), eq(users.role, "owner")));
  return owners.length;
}

export async function removeMember(
  memberUserId: string,
  workspaceId: string,
): Promise<void> {
  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.id, memberUserId), eq(users.workspaceId, workspaceId)))
    .limit(1);
  if (!target) throw new Error("Member not found.");

  if (target.role === "owner" && (await countOwners(workspaceId)) <= 1) {
    throw new Error("Promote someone else to owner before removing the last owner.");
  }

  await db
    .delete(users)
    .where(and(eq(users.id, memberUserId), eq(users.workspaceId, workspaceId)));
}

export async function setMemberRole(
  memberUserId: string,
  workspaceId: string,
  role: MemberRole,
): Promise<void> {
  if (role === "member") {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, memberUserId), eq(users.workspaceId, workspaceId)))
      .limit(1);
    if (
      target?.role === "owner" &&
      (await countOwners(workspaceId)) <= 1
    ) {
      throw new Error("Promote someone else to owner first.");
    }
  }

  await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, memberUserId), eq(users.workspaceId, workspaceId)));
}
