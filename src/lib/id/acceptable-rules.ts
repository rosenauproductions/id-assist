import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { acceptableRules, users } from "@/lib/db/schema";
import type { FilterHit } from "./types";

export type AcceptableRule = {
  id: string;
  filterCode: string;
  addedByEmail: string | null;
  addedAt: string;
};

/**
 * Every muted filter code for a workspace's "acceptable issues" list
 * (Settings), newest first.
 */
export async function listAcceptableRules(
  workspaceId: string,
): Promise<AcceptableRule[]> {
  const rows = await db
    .select({
      id: acceptableRules.id,
      filterCode: acceptableRules.filterCode,
      addedAt: acceptableRules.addedAt,
      addedByEmail: users.email,
    })
    .from(acceptableRules)
    .leftJoin(users, eq(users.id, acceptableRules.addedByUserId))
    .where(eq(acceptableRules.workspaceId, workspaceId))
    .orderBy(desc(acceptableRules.addedAt));

  return rows.map((row) => ({
    id: row.id,
    filterCode: row.filterCode,
    addedByEmail: row.addedByEmail ?? null,
    addedAt: row.addedAt.toISOString(),
  }));
}

/** Adds a filter code to the workspace's mute list. Idempotent — a code
 * already on the list is left as-is rather than erroring or duplicating. */
export async function addAcceptableRule(
  workspaceId: string,
  filterCode: string,
  addedByUserId: string,
): Promise<void> {
  await db
    .insert(acceptableRules)
    .values({ workspaceId, filterCode, addedByUserId })
    .onConflictDoNothing({
      target: [acceptableRules.workspaceId, acceptableRules.filterCode],
    });
}

export async function removeAcceptableRule(
  workspaceId: string,
  ruleId: string,
): Promise<void> {
  await db
    .delete(acceptableRules)
    .where(
      and(
        eq(acceptableRules.id, ruleId),
        eq(acceptableRules.workspaceId, workspaceId),
      ),
    );
}

async function getAcceptableCodes(workspaceId: string): Promise<Set<string>> {
  const rows = await db
    .select({ filterCode: acceptableRules.filterCode })
    .from(acceptableRules)
    .where(eq(acceptableRules.workspaceId, workspaceId));
  return new Set(rows.map((row) => row.filterCode));
}

/**
 * Marks every FilterHit whose code is on the workspace's acceptable list
 * as resolved, leaving everything else untouched. Called from
 * saveProject() (the same single choke point migrateProject() and
 * assertWorkspaceWritable() already use) so runFilters() itself never
 * needs to know about workspace-level mute rules — it always produces the
 * full, honest set, and this is the one place that set gets quieted down
 * before it's persisted.
 */
export async function applyAcceptableRules(
  filters: FilterHit[],
  workspaceId: string,
): Promise<FilterHit[]> {
  const codes = await getAcceptableCodes(workspaceId);
  if (codes.size === 0) return filters;
  return filters.map((filter) =>
    !filter.resolved && codes.has(filter.code)
      ? { ...filter, resolved: true, dismissReason: "Always allowed (workspace rule)" }
      : filter,
  );
}
