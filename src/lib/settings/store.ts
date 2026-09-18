import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { users, workspaces } from "@/lib/db/schema";
import { requireOwner, requireWorkspaceContext } from "@/lib/team/store";
import { DELIVERY_TARGETS, type DeliveryTarget } from "@/lib/id/types";
import {
  DEFAULT_MAP_SHAPES,
  MAP_NODE_KINDS,
  NODE_SHAPES,
  type MapShapeSettings,
} from "@/lib/id/course-map";
import {
  ACCENT_THEMES,
  DEFAULT_APPEARANCE,
  type AccentTheme,
  type Appearance,
  type ThemeMode,
  type WorkspaceSettings,
} from "./types";

// Re-exported so existing server-side imports of these from "./store" keep
// working unchanged. settings-panel.tsx (a client component) must import
// them from "./types" directly instead — see that file's comment for why.
export * from "./types";

// --- Appearance (personal, saved to the account) ---------------------------

function isThemeMode(value: string): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isAccentTheme(value: string): value is AccentTheme {
  return (ACCENT_THEMES as readonly string[]).includes(value);
}

/**
 * Reads the signed-in user's appearance settings. Used from the root layout
 * on every request, so it fails soft (falls back to defaults) rather than
 * throwing when signed out or the row can't be read — a broken layout would
 * take down every page.
 */
export async function getAppearance(): Promise<Appearance> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return DEFAULT_APPEARANCE;

    const [row] = await db
      .select({ themeMode: users.themeMode, accentTheme: users.accentTheme })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return DEFAULT_APPEARANCE;

    return {
      themeMode: isThemeMode(row.themeMode) ? row.themeMode : "system",
      accentTheme: isAccentTheme(row.accentTheme) ? row.accentTheme : "teal",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export async function updateAppearance(input: {
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
}): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in.");

  await db
    .update(users)
    .set({ themeMode: input.themeMode, accentTheme: input.accentTheme })
    .where(eq(users.id, userId));
}

// --- Map shapes (personal, saved to the account) ---------------------------

function isNodeShape(value: unknown): value is MapShapeSettings[keyof MapShapeSettings] {
  return typeof value === "string" && (NODE_SHAPES as readonly string[]).includes(value);
}

function parseMapShapes(value: unknown): MapShapeSettings {
  const result: MapShapeSettings = { ...DEFAULT_MAP_SHAPES };
  if (!value || typeof value !== "object") return result;
  const record = value as Record<string, unknown>;
  for (const kind of MAP_NODE_KINDS) {
    const candidate = record[kind];
    if (isNodeShape(candidate)) {
      result[kind] = candidate;
    }
  }
  return result;
}

/**
 * Reads the signed-in user's Map-tab shape assignments (module/lesson/
 * unit/assessment -> circle/square/etc, see course-map.ts's NodeShape).
 * Personal, like getAppearance() above, and just as fail-soft — a broken
 * read falls back to DEFAULT_MAP_SHAPES rather than break the Map tab.
 */
export async function getMapShapes(): Promise<MapShapeSettings> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ...DEFAULT_MAP_SHAPES };

    const [row] = await db
      .select({ mapShapes: users.mapShapes })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return { ...DEFAULT_MAP_SHAPES };

    return parseMapShapes(row.mapShapes);
  } catch {
    return { ...DEFAULT_MAP_SHAPES };
  }
}

/** Takes loosely-typed input (straight off a FormData read) and sanitizes
 * it against NODE_SHAPES/MAP_NODE_KINDS itself, same as parseMapShapes
 * above — callers don't need to validate before calling this. */
export async function updateMapShapes(input: unknown): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in.");

  await db
    .update(users)
    .set({ mapShapes: parseMapShapes(input) })
    .where(eq(users.id, userId));
}

// --- Workspace settings (owner-editable, shared by everyone in it) --------

function isDeliveryTarget(value: unknown): value is DeliveryTarget {
  return (
    typeof value === "string" &&
    (DELIVERY_TARGETS as readonly string[]).includes(value)
  );
}

function parseDefaultDelivery(value: unknown): DeliveryTarget[] {
  if (!Array.isArray(value)) return [...DELIVERY_TARGETS];
  const parsed = value.filter(isDeliveryTarget);
  return parsed.length ? parsed : [...DELIVERY_TARGETS];
}

/**
 * Reads the current user's workspace settings. Returns null when signed
 * out or the account can't be resolved — callers decide how to handle that
 * rather than this throwing from places like the wizard page that render
 * for a very-briefly-unauthenticated request during a redirect.
 */
export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [row] = await db
    .select({
      name: workspaces.name,
      defaultDelivery: workspaces.defaultDelivery,
      modelOverride: workspaces.modelOverride,
    })
    .from(users)
    .innerJoin(workspaces, eq(workspaces.id, users.workspaceId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;

  return {
    name: row.name,
    defaultDelivery: parseDefaultDelivery(row.defaultDelivery),
    modelOverride: row.modelOverride,
  };
}

/**
 * Same as getWorkspaceSettings() but only the pieces model.ts needs, and
 * safe to call from anywhere (never throws) since a failure here should
 * fall back to the deploy-wide default model rather than break a coach or
 * import call.
 */
export async function getWorkspaceModelOverride(): Promise<string | null> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;

    const [row] = await db
      .select({ modelOverride: workspaces.modelOverride })
      .from(users)
      .innerJoin(workspaces, eq(workspaces.id, users.workspaceId))
      .where(eq(users.id, userId))
      .limit(1);
    return row?.modelOverride?.trim() || null;
  } catch {
    return null;
  }
}

export async function updateWorkspaceSettings(input: {
  name: string;
  defaultDelivery: DeliveryTarget[];
  modelOverride: string | null;
}): Promise<void> {
  const context = await requireWorkspaceContext();
  requireOwner(context);

  const name = input.name.trim();
  if (!name) throw new Error("Workspace name can't be empty.");

  await db
    .update(workspaces)
    .set({
      name,
      defaultDelivery: input.defaultDelivery.length
        ? input.defaultDelivery
        : null,
      modelOverride: input.modelOverride?.trim() || null,
    })
    .where(eq(workspaces.id, context.workspaceId));
}
