import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { projects as projectsTable, users } from "@/lib/db/schema";
import { assertWorkspaceWritable } from "@/lib/billing/store";
import { COURSE_PHASES, type IdProject } from "./types";

type WriteContext = { userId: string; workspaceId: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in.");
  return userId;
}

/** Every project belongs to a workspace; everyone in that workspace can see
 * and edit it (the "one shared workspace" model — no per-project ACLs). */
async function requireWorkspaceId(): Promise<string> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ workspaceId: users.workspaceId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error("Account not found.");
  return row.workspaceId;
}

async function requireWriteContext(): Promise<WriteContext> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ workspaceId: users.workspaceId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error("Account not found.");
  return { userId, workspaceId: row.workspaceId };
}

/**
 * Backfills fields added after some projects were already saved (jsonb rows
 * don't get a schema migration, so older rows can be missing newer keys).
 */
function normalizeProject(project: IdProject): IdProject {
  if (!project.requirements) {
    project.requirements = [];
  }
  if (!project.phaseProgress) {
    project.phaseProgress = COURSE_PHASES.map((phase) => ({ phase }));
  }
  return project;
}

function fromRow(row: { data: unknown }): IdProject {
  return normalizeProject(row.data as IdProject);
}

export async function saveProject(project: IdProject): Promise<void> {
  const { userId, workspaceId } = await requireWriteContext();
  // The single enforcement choke point for account state: every project
  // create/edit in the app funnels through saveProject, so this is where
  // a suspended/canceled account or an expired trial gets locked out —
  // read-only, not deleted, per the roadmap's decision on trial expiry.
  await assertWorkspaceWritable(workspaceId);
  project.updatedAt = new Date().toISOString();
  const title = project.outline.brief.title || "untitled-course";
  const status = project.outline.status;

  await db
    .insert(projectsTable)
    .values({
      id: project.id,
      workspaceId,
      createdByUserId: userId,
      title,
      status,
      data: project,
    })
    .onConflictDoUpdate({
      target: projectsTable.id,
      // workspaceId/createdByUserId are deliberately omitted here — they're
      // set once at creation and never reassigned by a later save.
      set: {
        title,
        status,
        data: project,
        updatedAt: new Date(),
      },
    });
}

export async function loadProject(id: string): Promise<IdProject | null> {
  const workspaceId = await requireWorkspaceId();
  const [row] = await db
    .select({ data: projectsTable.data })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return null;
  return fromRow(row);
}

export async function listProjects(): Promise<IdProject[]> {
  const workspaceId = await requireWorkspaceId();
  const rows = await db
    .select({ data: projectsTable.data })
    .from(projectsTable)
    .where(eq(projectsTable.workspaceId, workspaceId))
    .orderBy(desc(projectsTable.updatedAt));
  return rows.map(fromRow);
}

export async function deleteProject(projectId: string): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await db
    .delete(projectsTable)
    .where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.workspaceId, workspaceId)),
    );
}
