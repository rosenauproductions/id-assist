import { desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginEvents, users, workspaces } from "@/lib/db/schema";
import { lookupIpLocation } from "./geolocation";

/**
 * Records one successful login for the /admin login map. Called from
 * src/auth.ts's Credentials authorize() callback via next/server's
 * after(), so the geolocation lookup's latency (up to a few seconds on a
 * slow or rate-limited response) never delays the actual sign-in, and a
 * failure here can never turn a successful login into a failed one.
 */
export async function recordLoginEvent(input: {
  userId: string;
  workspaceId: string | null;
  ip: string | null;
}): Promise<void> {
  try {
    const geo = await lookupIpLocation(input.ip);
    await db.insert(loginEvents).values({
      userId: input.userId,
      workspaceId: input.workspaceId,
      ip: input.ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      lat: geo.lat,
      lng: geo.lng,
    });
  } catch {
    // Best-effort — never let a logging failure surface anywhere.
  }
}

export type LoginMapRange = "day" | "week" | "month";

export type LoginEventPoint = {
  id: string;
  email: string | null;
  workspaceName: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
};

function rangeStart(range: LoginMapRange): Date {
  const days = range === "day" ? 1 : range === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Every login in the given window with a resolved lat/lng, newest first —
 * a snapshot as of the call, not a live subscription (see the roadmap's
 * "live means a snapshot on load" decision). Capped at 500 points; at
 * real-world login volume for this app that's far more than the window
 * sizes below will ever actually return.
 */
export async function listLoginEvents(
  range: LoginMapRange,
): Promise<LoginEventPoint[]> {
  const since = rangeStart(range);
  const rows = await db
    .select({
      id: loginEvents.id,
      email: users.email,
      workspaceName: workspaces.name,
      country: loginEvents.country,
      region: loginEvents.region,
      city: loginEvents.city,
      lat: loginEvents.lat,
      lng: loginEvents.lng,
      createdAt: loginEvents.createdAt,
    })
    .from(loginEvents)
    .leftJoin(users, eq(users.id, loginEvents.userId))
    .leftJoin(workspaces, eq(workspaces.id, loginEvents.workspaceId))
    .where(gte(loginEvents.createdAt, since))
    .orderBy(desc(loginEvents.createdAt))
    .limit(500);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}
