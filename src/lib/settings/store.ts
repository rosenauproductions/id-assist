import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { users, workspaces } from "@/lib/db/schema";
import { requireOwner, requireWorkspaceContext } from "@/lib/team/store";
import { DELIVERY_TARGETS, type DeliveryTarget } from "@/lib/id/types";

// --- Appearance (personal, saved to the account) ---------------------------

export type ThemeMode = "light" | "dark" | "system";

export const ACCENT_THEMES = [
  "teal",
  "blue",
  "violet",
  "amber",
  "rose",
] as const;

export type AccentTheme = (typeof ACCENT_THEMES)[number];

export const ACCENT_THEME_LABELS: Record<AccentTheme, string> = {
  teal: "Teal",
  blue: "Blue",
  violet: "Violet",
  amber: "Amber",
  rose: "Rose",
};

export type Appearance = {
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
};

const DEFAULT_APPEARANCE: Appearance = {
  themeMode: "system",
  accentTheme: "teal",
};

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

// --- Workspace settings (owner-editable, shared by everyone in it) --------

export type WorkspaceSettings = {
  name: string;
  defaultDelivery: DeliveryTarget[];
  modelOverride: string | null;
};

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
