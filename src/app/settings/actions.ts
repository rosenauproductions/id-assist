"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireOwner, requireWorkspaceContext } from "@/lib/team/store";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/store";
import {
  ACCENT_THEMES,
  updateAppearance,
  updateWorkspaceSettings,
  type AccentTheme,
  type ThemeMode,
} from "@/lib/settings/store";
import { DELIVERY_TARGETS } from "@/lib/id/types";

function parseThemeMode(value: FormDataEntryValue | null): ThemeMode {
  return value === "light" || value === "dark" ? value : "system";
}

function parseAccentTheme(value: FormDataEntryValue | null): AccentTheme {
  const raw = String(value ?? "");
  return (ACCENT_THEMES as readonly string[]).includes(raw)
    ? (raw as AccentTheme)
    : "teal";
}

export async function updateAppearanceAction(formData: FormData) {
  await updateAppearance({
    themeMode: parseThemeMode(formData.get("themeMode")),
    accentTheme: parseAccentTheme(formData.get("accentTheme")),
  });
  // "layout" so the root layout (which sets data-theme/data-accent on
  // <html>) re-renders with the new value, not just the /settings page.
  revalidatePath("/", "layout");
}

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const defaultDelivery = DELIVERY_TARGETS.filter(
    (target) => formData.get(`delivery-${target}`) === "on",
  );
  const modelOverride = String(formData.get("modelOverride") ?? "").trim();

  await updateWorkspaceSettings({
    name,
    defaultDelivery,
    modelOverride: modelOverride || null,
  });
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/app");
  revalidatePath("/team");
  revalidatePath("/wizard");
  revalidatePath("/projects/new");
}


async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");
  return `${proto}://${host}`;
}

export async function startCheckoutAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  requireOwner(context);
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const baseUrl = await resolveBaseUrl();
  const url = await createCheckoutSession({
    workspaceId: context.workspaceId,
    email: context.email,
    baseUrl,
    interval,
  });
  redirect(url);
}

export async function openBillingPortalAction(): Promise<void> {
  const context = await requireWorkspaceContext();
  requireOwner(context);
  const baseUrl = await resolveBaseUrl();
  const url = await createPortalSession({
    workspaceId: context.workspaceId,
    baseUrl,
  });
  redirect(url);
}
