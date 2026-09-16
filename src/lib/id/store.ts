import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { projects as projectsTable } from "@/lib/db/schema";
import { COURSE_PHASES, type IdProject } from "./types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in.");
  return userId;
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
  const ownerId = await requireUserId();
  project.updatedAt = new Date().toISOString();
  const title = project.outline.brief.title || "untitled-course";
  const status = project.outline.status;

  await db
    .insert(projectsTable)
    .values({
      id: project.id,
      ownerId,
      title,
      status,
      data: project,
    })
    .onConflictDoUpdate({
      target: projectsTable.id,
      set: {
        title,
        status,
        data: project,
        updatedAt: new Date(),
      },
    });
}

export async function loadProject(id: string): Promise<IdProject | null> {
  const ownerId = await requireUserId();
  const [row] = await db
    .select({ data: projectsTable.data })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;
  return fromRow(row);
}

export async function listProjects(): Promise<IdProject[]> {
  const ownerId = await requireUserId();
  const rows = await db
    .select({ data: projectsTable.data })
    .from(projectsTable)
    .where(eq(projectsTable.ownerId, ownerId))
    .orderBy(desc(projectsTable.updatedAt));
  return rows.map(fromRow);
}

export async function deleteProject(projectId: string): Promise<void> {
  const ownerId = await requireUserId();
  await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.ownerId, ownerId)));
}
