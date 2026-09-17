import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { interviewSessions } from "@/lib/db/schema";
import { requireWorkspaceContext } from "@/lib/team/store";
import { nid } from "@/lib/id/ids";
import { generateInviteToken } from "@/lib/auth/invite-token";
import type { WizardStepId } from "@/lib/id/brief-validate";

export type InterviewStatus = "in_progress" | "submitted" | "completed";

/** Raw per-question answers, keyed first by brief field, then by that
 * field's FIELD_COACH question id (e.g. answers.jobTask.criterion). Shared
 * shape for both the live interview and the SME's own share-link answers —
 * only the delivery surface differs, not the data. */
export type InterviewAnswers = Partial<Record<WizardStepId, Record<string, string>>>;

export type InterviewSessionSummary = {
  id: string;
  smeName: string | null;
  courseWorkingTitle: string | null;
  status: InterviewStatus;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InterviewSession = InterviewSessionSummary & {
  token: string;
  answers: InterviewAnswers;
};

function isInterviewStatus(value: string): value is InterviewStatus {
  return value === "in_progress" || value === "submitted" || value === "completed";
}

function toSummary(row: {
  id: string;
  smeName: string | null;
  courseWorkingTitle: string | null;
  status: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InterviewSessionSummary {
  return {
    id: row.id,
    smeName: row.smeName,
    courseWorkingTitle: row.courseWorkingTitle,
    status: isInterviewStatus(row.status) ? row.status : "in_progress",
    projectId: row.projectId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSession(row: {
  id: string;
  token: string;
  smeName: string | null;
  courseWorkingTitle: string | null;
  answers: unknown;
  status: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): InterviewSession {
  return {
    ...toSummary(row),
    token: row.token,
    answers: (row.answers as InterviewAnswers | null) ?? {},
  };
}

/** Authed — every session listed/loaded/mutated this way is scoped to the
 * caller's own workspace, same pattern as loadProject()/listProjects(). */
export async function listInterviewSessions(): Promise<InterviewSessionSummary[]> {
  const context = await requireWorkspaceContext();
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.workspaceId, context.workspaceId))
    .orderBy(desc(interviewSessions.updatedAt));
  return rows.map(toSummary);
}

export async function createInterviewSession(input: {
  smeName?: string;
  courseWorkingTitle?: string;
}): Promise<string> {
  const context = await requireWorkspaceContext();
  const session = await auth();
  const id = nid("intv");
  await db.insert(interviewSessions).values({
    id,
    workspaceId: context.workspaceId,
    createdByUserId: session?.user?.id ?? null,
    token: generateInviteToken(),
    smeName: input.smeName?.trim() || null,
    courseWorkingTitle: input.courseWorkingTitle?.trim() || null,
    answers: {},
    status: "in_progress",
  });
  return id;
}

export async function getInterviewSession(id: string): Promise<InterviewSession | null> {
  const context = await requireWorkspaceContext();
  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.workspaceId, context.workspaceId),
      ),
    )
    .limit(1);
  return row ? toSession(row) : null;
}

/** Public — no auth, no workspace check. The token itself is the
 * capability, same trust model as invitations.token. Never expose more
 * than an SME filling out their own interview needs. */
export async function getInterviewSessionByToken(
  token: string,
): Promise<InterviewSession | null> {
  const [row] = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.token, token))
    .limit(1);
  return row ? toSession(row) : null;
}

export async function saveInterviewAnswers(
  id: string,
  answers: InterviewAnswers,
): Promise<void> {
  const context = await requireWorkspaceContext();
  await db
    .update(interviewSessions)
    .set({ answers, updatedAt: new Date() })
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.workspaceId, context.workspaceId),
      ),
    );
}

export async function saveInterviewAnswersByToken(
  token: string,
  answers: InterviewAnswers,
): Promise<void> {
  await db
    .update(interviewSessions)
    .set({ answers, updatedAt: new Date() })
    .where(eq(interviewSessions.token, token));
}

export async function markInterviewSubmittedByToken(token: string): Promise<void> {
  await db
    .update(interviewSessions)
    .set({ status: "submitted", updatedAt: new Date() })
    .where(eq(interviewSessions.token, token));
}

export async function completeInterviewSession(
  id: string,
  projectId: string,
): Promise<void> {
  const context = await requireWorkspaceContext();
  await db
    .update(interviewSessions)
    .set({ status: "completed", projectId, updatedAt: new Date() })
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.workspaceId, context.workspaceId),
      ),
    );
}

export async function deleteInterviewSession(id: string): Promise<void> {
  const context = await requireWorkspaceContext();
  await db
    .delete(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.workspaceId, context.workspaceId),
      ),
    );
}
