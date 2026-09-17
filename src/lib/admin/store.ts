import { and, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import {
  accountNotes,
  adminAuditLog,
  impersonationSessions,
  invitations,
  projects,
  users,
  workspaces,
} from "@/lib/db/schema";
import { generateInviteToken } from "@/lib/auth/invite-token";
import { createInvitation, type MemberRole } from "@/lib/team/store";

export type AccountStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled";

export type PlatformAdminContext = {
  userId: string;
  email: string;
};

const IMPERSONATION_COOKIE = "id-assist-impersonate";
const IMPERSONATION_MINUTES = 30;
const DEFAULT_TRIAL_DAYS = 14;

export function impersonationCookieName(): string {
  return IMPERSONATION_COOKIE;
}

export function impersonationDurationMinutes(): number {
  return IMPERSONATION_MINUTES;
}

/**
 * Platform-admin gate. Always re-reads platformRole from the DB rather than
 * trusting the JWT, same rationale as requireWorkspaceContext() in
 * lib/team/store.ts — and deliberately calls auth() directly rather than
 * anything impersonation-aware, so this always reflects the real logged-in
 * identity even while that person is impersonating someone else.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in.");

  const [row] = await db
    .select({ email: users.email, platformRole: users.platformRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.platformRole !== "admin") {
    throw new Error("Not authorized.");
  }
  return { userId, email: row.email };
}

async function logAdminAction(input: {
  actorUserId: string;
  action: string;
  targetWorkspaceId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    targetWorkspaceId: input.targetWorkspaceId,
    targetUserId: input.targetUserId,
    metadata: input.metadata ?? null,
  });
}

export type AccountSummary = {
  id: string;
  name: string;
  status: AccountStatus;
  trialEndsAt: string | null;
  accountManagerLabel: string | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
};

export async function listAccounts(): Promise<AccountSummary[]> {
  const [rows, memberCounts, projectCounts] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        status: workspaces.status,
        trialEndsAt: workspaces.trialEndsAt,
        accountManagerLabel: workspaces.accountManagerLabel,
        createdAt: workspaces.createdAt,
      })
      .from(workspaces)
      .orderBy(desc(workspaces.createdAt)),
    db
      .select({ workspaceId: users.workspaceId, n: count() })
      .from(users)
      .groupBy(users.workspaceId),
    db
      .select({ workspaceId: projects.workspaceId, n: count() })
      .from(projects)
      .groupBy(projects.workspaceId),
  ]);

  const memberMap = new Map(memberCounts.map((r) => [r.workspaceId, r.n]));
  const projectMap = new Map(projectCounts.map((r) => [r.workspaceId, r.n]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status as AccountStatus,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
    accountManagerLabel: row.accountManagerLabel,
    createdAt: row.createdAt.toISOString(),
    memberCount: memberMap.get(row.id) ?? 0,
    projectCount: projectMap.get(row.id) ?? 0,
  }));
}

export type AccountMember = {
  id: string;
  email: string;
  role: MemberRole;
  createdAt: string;
};

export type AccountProjectSummary = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

export type AccountNote = {
  id: string;
  body: string;
  authorEmail: string | null;
  createdAt: string;
};

export type AccountDetail = {
  id: string;
  name: string;
  status: AccountStatus;
  trialEndsAt: string | null;
  accountManagerLabel: string | null;
  suspendedAt: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  members: AccountMember[];
  projects: AccountProjectSummary[];
  notes: AccountNote[];
};

export async function getAccountDetail(
  workspaceId: string,
): Promise<AccountDetail | null> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) return null;

  const [memberRows, projectRows, noteRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.workspaceId, workspaceId))
      .orderBy(users.createdAt),
    db
      .select({
        id: projects.id,
        title: projects.title,
        status: projects.status,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.updatedAt)),
    db
      .select({
        id: accountNotes.id,
        body: accountNotes.body,
        createdAt: accountNotes.createdAt,
        authorEmail: users.email,
      })
      .from(accountNotes)
      .leftJoin(users, eq(users.id, accountNotes.authorUserId))
      .where(eq(accountNotes.workspaceId, workspaceId))
      .orderBy(desc(accountNotes.createdAt)),
  ]);

  return {
    id: ws.id,
    name: ws.name,
    status: ws.status as AccountStatus,
    trialEndsAt: ws.trialEndsAt ? ws.trialEndsAt.toISOString() : null,
    accountManagerLabel: ws.accountManagerLabel,
    suspendedAt: ws.suspendedAt ? ws.suspendedAt.toISOString() : null,
    stripeCustomerId: ws.stripeCustomerId,
    createdAt: ws.createdAt.toISOString(),
    members: memberRows.map((m) => ({
      ...m,
      role: m.role as MemberRole,
      createdAt: m.createdAt.toISOString(),
    })),
    projects: projectRows.map((p) => ({
      ...p,
      updatedAt: p.updatedAt.toISOString(),
    })),
    notes: noteRows.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function createAccount(input: {
  actorUserId: string;
  name: string;
  ownerEmail: string;
  trialDays?: number;
}): Promise<{ workspaceId: string; inviteToken: string }> {
  const name = input.name.trim();
  const email = input.ownerEmail.trim().toLowerCase();
  if (!name) throw new Error("Account name is required.");
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid owner email address.");
  }

  const trialDays = input.trialDays ?? DEFAULT_TRIAL_DAYS;
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  const [workspace] = await db
    .insert(workspaces)
    .values({ name, status: "trialing", trialEndsAt })
    .returning({ id: workspaces.id });

  await createInvitation({
    workspaceId: workspace.id,
    invitedByUserId: input.actorUserId,
    email,
    role: "owner",
  });

  const [invite] = await db
    .select({ token: invitations.token })
    .from(invitations)
    .where(
      and(eq(invitations.workspaceId, workspace.id), eq(invitations.email, email)),
    )
    .limit(1);

  await logAdminAction({
    actorUserId: input.actorUserId,
    action: "create_account",
    targetWorkspaceId: workspace.id,
    metadata: { name, ownerEmail: email, trialDays },
  });

  return { workspaceId: workspace.id, inviteToken: invite?.token ?? "" };
}

export async function setAccountStatus(input: {
  workspaceId: string;
  actorUserId: string;
  status: AccountStatus;
}): Promise<void> {
  await db
    .update(workspaces)
    .set({
      status: input.status,
      suspendedAt: input.status === "suspended" ? new Date() : null,
    })
    .where(eq(workspaces.id, input.workspaceId));
  await logAdminAction({
    actorUserId: input.actorUserId,
    action: `set_status_${input.status}`,
    targetWorkspaceId: input.workspaceId,
  });
}

export async function setAccountManagerLabel(input: {
  workspaceId: string;
  actorUserId: string;
  label: string;
}): Promise<void> {
  const label = input.label.trim();
  await db
    .update(workspaces)
    .set({ accountManagerLabel: label || null })
    .where(eq(workspaces.id, input.workspaceId));
  await logAdminAction({
    actorUserId: input.actorUserId,
    action: "set_account_manager",
    targetWorkspaceId: input.workspaceId,
    metadata: { label },
  });
}

export async function addUserToAccount(input: {
  workspaceId: string;
  actorUserId: string;
  email: string;
  role: MemberRole;
}): Promise<void> {
  await createInvitation({
    workspaceId: input.workspaceId,
    invitedByUserId: input.actorUserId,
    email: input.email,
    role: input.role,
  });
  await logAdminAction({
    actorUserId: input.actorUserId,
    action: "add_user_invite",
    targetWorkspaceId: input.workspaceId,
    metadata: { email: input.email, role: input.role },
  });
}

export async function addAccountNote(input: {
  workspaceId: string;
  actorUserId: string;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("Note can't be empty.");
  await db.insert(accountNotes).values({
    workspaceId: input.workspaceId,
    authorUserId: input.actorUserId,
    body,
  });
  await logAdminAction({
    actorUserId: input.actorUserId,
    action: "add_note",
    targetWorkspaceId: input.workspaceId,
  });
}

export type ImpersonationStatus = {
  adminUserId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  expiresAt: string;
};

export async function startImpersonation(input: {
  adminUserId: string;
  targetUserId: string;
  reason?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  if (input.adminUserId === input.targetUserId) {
    throw new Error("You're already signed in as yourself.");
  }
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + IMPERSONATION_MINUTES * 60_000);
  await db.insert(impersonationSessions).values({
    token,
    adminUserId: input.adminUserId,
    targetUserId: input.targetUserId,
    reason: input.reason?.trim() || null,
    expiresAt,
  });
  await logAdminAction({
    actorUserId: input.adminUserId,
    action: "impersonate_start",
    targetUserId: input.targetUserId,
    metadata: input.reason ? { reason: input.reason } : undefined,
  });
  return { token, expiresAt };
}

export async function endImpersonation(
  token: string,
  actorUserId: string,
): Promise<void> {
  const [row] = await db
    .select({
      targetUserId: impersonationSessions.targetUserId,
      endedAt: impersonationSessions.endedAt,
    })
    .from(impersonationSessions)
    .where(eq(impersonationSessions.token, token))
    .limit(1);
  if (!row || row.endedAt) return;

  await db
    .update(impersonationSessions)
    .set({ endedAt: new Date() })
    .where(eq(impersonationSessions.token, token));
  await logAdminAction({
    actorUserId,
    action: "impersonate_end",
    targetUserId: row.targetUserId,
  });
}

export async function getActiveImpersonation(
  token: string,
): Promise<ImpersonationStatus | null> {
  const [row] = await db
    .select({
      adminUserId: impersonationSessions.adminUserId,
      targetUserId: impersonationSessions.targetUserId,
      expiresAt: impersonationSessions.expiresAt,
      endedAt: impersonationSessions.endedAt,
    })
    .from(impersonationSessions)
    .where(eq(impersonationSessions.token, token))
    .limit(1);
  if (!row || row.endedAt || row.expiresAt.getTime() < Date.now()) return null;

  const [admin] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, row.adminUserId))
    .limit(1);
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, row.targetUserId))
    .limit(1);
  if (!admin || !target) return null;

  return {
    adminUserId: row.adminUserId,
    adminEmail: admin.email,
    targetUserId: row.targetUserId,
    targetEmail: target.email,
    expiresAt: row.expiresAt.toISOString(),
  };
}

const actorUsers = alias(users, "actor_users");
const targetUsers = alias(users, "target_users");

export type AuditLogEntry = {
  id: string;
  action: string;
  actorEmail: string | null;
  targetWorkspaceName: string | null;
  targetUserEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export async function listAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      metadata: adminAuditLog.metadata,
      createdAt: adminAuditLog.createdAt,
      actorEmail: actorUsers.email,
      targetUserEmail: targetUsers.email,
      targetWorkspaceName: workspaces.name,
    })
    .from(adminAuditLog)
    .leftJoin(actorUsers, eq(actorUsers.id, adminAuditLog.actorUserId))
    .leftJoin(targetUsers, eq(targetUsers.id, adminAuditLog.targetUserId))
    .leftJoin(workspaces, eq(workspaces.id, adminAuditLog.targetWorkspaceId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorEmail: row.actorEmail,
    targetUserEmail: row.targetUserEmail,
    targetWorkspaceName: row.targetWorkspaceName,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Reads the impersonation cookie (if any) for the current request and
 * returns its status — used by the root layout to render the "you're
 * impersonating" banner. Returns null when nobody is being impersonated. */
export async function getCurrentImpersonationBanner(): Promise<ImpersonationStatus | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;
  return getActiveImpersonation(token);
}

export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "suspended" ||
    value === "canceled"
  );
}

/** Non-throwing platform-admin check, for deciding whether to show the
 * "Admin" nav link — requirePlatformAdmin() throws and is for gating
 * actual admin pages/actions, not for a soft UI check. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ platformRole: users.platformRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.platformRole === "admin";
}

