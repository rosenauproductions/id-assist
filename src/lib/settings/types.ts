import type { DeliveryTarget } from "@/lib/id/types";

// Client-safe constants/types for appearance + workspace settings. This file
// must never import anything server-only (db, auth, etc.) — settings-panel.tsx
// is a client component and imports from here directly, so pulling in @/auth
// (and its node:crypto usage in password hashing) would break the client
// webpack bundle. Server-only logic lives in ./store, which re-exports this
// file's members so existing server-side imports don't need to change.

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

export const DEFAULT_APPEARANCE: Appearance = {
  themeMode: "system",
  accentTheme: "teal",
};

export type WorkspaceSettings = {
  name: string;
  defaultDelivery: DeliveryTarget[];
  modelOverride: string | null;
};
