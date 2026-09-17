import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { platformSettings, siteSettings } from "@/lib/db/schema";

const SETTINGS_ROW_ID = "default";

// Original hardcoded defaults, preserved here as the fallback so the app
// keeps working exactly as it did before this table existed, until a
// platform admin actually saves something from /admin/settings.
export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_MONTHLY_GENERATION_LIMIT = 150;

export type PlatformDefaults = {
  trialDays: number;
  monthlyGenerationLimit: number;
};

/** Reads the platform-wide defaults (trial length, generation cap), falling
 * back to the original hardcoded numbers for any field that hasn't been
 * saved yet — including when the row itself doesn't exist. */
export async function getPlatformDefaults(): Promise<PlatformDefaults> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, SETTINGS_ROW_ID))
    .limit(1);

  return {
    trialDays: row?.trialDays ?? DEFAULT_TRIAL_DAYS,
    monthlyGenerationLimit:
      row?.monthlyGenerationLimit ?? DEFAULT_MONTHLY_GENERATION_LIMIT,
  };
}

export async function updatePlatformDefaults(
  input: PlatformDefaults,
): Promise<void> {
  await db
    .insert(platformSettings)
    .values({
      id: SETTINGS_ROW_ID,
      trialDays: input.trialDays,
      monthlyGenerationLimit: input.monthlyGenerationLimit,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: {
        trialDays: input.trialDays,
        monthlyGenerationLimit: input.monthlyGenerationLimit,
        updatedAt: new Date(),
      },
    });
}

export type FeatureCardCopy = { title: string; description: string };

// The marketing page's original hardcoded copy, now the single source of
// truth for "what shows when nothing's been saved in /admin/settings" —
// both src/app/page.tsx (the fallback text) and the settings form itself
// (prefilled with the copy currently in effect) import these rather than
// keeping two independent copies of the same strings.
export const DEFAULT_HERO_EYEBROW = "ADDIE + Bloom's, built into the tool";
export const DEFAULT_HERO_HEADLINE =
  "Build a whole course, guardrailed by real instructional design";
export const DEFAULT_HERO_SUBHEAD =
  "ID Assist interviews your SME, drafts a Bloom's-gated outline, flags the pedagogy gaps other tools miss, and hands you ready-to-build artifacts — Rise, Canvas, Google Docs, and more.";
export const DEFAULT_HERO_CTA_LABEL = "Start free";

export const DEFAULT_FEATURE_CARDS_COPY: FeatureCardCopy[] = [
  {
    title: "Interview the expert",
    description:
      "Work an adaptive question set live on a call, or send a link the SME answers on their own — no ID Assist account needed.",
  },
  {
    title: "Pedagogy gates, not guesses",
    description:
      "Every outline runs through real Bloom's-alignment and quantity checks before it's approved — not vibes, rules.",
  },
  {
    title: "Cost and time, estimated",
    description:
      "Track hours by phase, see the estimate update live, and export delivery-ready artifacts once the outline clears review.",
  },
  {
    title: "Built for a team",
    description:
      "Invite collaborators into a shared workspace, or run it solo as a freelancer — same tool, same guardrails either way.",
  },
];

export type SiteSettingsData = {
  heroEyebrow: string | null;
  heroHeadline: string | null;
  heroSubhead: string | null;
  heroCtaLabel: string | null;
  accentColor: string | null;
  featureCards: FeatureCardCopy[] | null;
};

/** Reads the marketing page's editable copy/theme. Every field is nullable
 * — null means "use the page's own built-in default" — so page.tsx keeps
 * rendering its original copy until a platform admin overrides a specific
 * field, rather than needing every field filled in at once. */
export async function getSiteSettings(): Promise<SiteSettingsData> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SETTINGS_ROW_ID))
    .limit(1);

  const featureCards = Array.isArray(row?.featureCards)
    ? (row.featureCards as FeatureCardCopy[])
    : null;

  return {
    heroEyebrow: row?.heroEyebrow ?? null,
    heroHeadline: row?.heroHeadline ?? null,
    heroSubhead: row?.heroSubhead ?? null,
    heroCtaLabel: row?.heroCtaLabel ?? null,
    accentColor: row?.accentColor ?? null,
    featureCards,
  };
}

export async function updateSiteSettings(
  input: SiteSettingsData,
): Promise<void> {
  await db
    .insert(siteSettings)
    .values({
      id: SETTINGS_ROW_ID,
      heroEyebrow: input.heroEyebrow,
      heroHeadline: input.heroHeadline,
      heroSubhead: input.heroSubhead,
      heroCtaLabel: input.heroCtaLabel,
      accentColor: input.accentColor,
      featureCards: input.featureCards,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        heroEyebrow: input.heroEyebrow,
        heroHeadline: input.heroHeadline,
        heroSubhead: input.heroSubhead,
        heroCtaLabel: input.heroCtaLabel,
        accentColor: input.accentColor,
        featureCards: input.featureCards,
        updatedAt: new Date(),
      },
    });
}
