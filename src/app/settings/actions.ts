"use server";

import { revalidatePath } from "next/cache";
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
  revalidatePath("/team");
  revalidatePath("/wizard");
  revalidatePath("/projects/new");
}
