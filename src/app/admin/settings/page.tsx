import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin/store";
import { AdminTabs } from "@/components/admin-tabs";
import {
  DEFAULT_FEATURE_CARDS_COPY,
  DEFAULT_HERO_CTA_LABEL,
  DEFAULT_HERO_EYEBROW,
  DEFAULT_HERO_HEADLINE,
  DEFAULT_HERO_SUBHEAD,
  DEFAULT_MONTHLY_GENERATION_LIMIT,
  DEFAULT_TRIAL_DAYS,
  getPlatformDefaults,
  getSiteSettings,
} from "@/lib/platform/settings";
import { updatePlatformDefaultsAction, updateSiteSettingsAction } from "../actions";
import { LandingThemePicker } from "@/components/landing-theme-picker";

export default async function AdminSettingsPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const [site, platform] = await Promise.all([
    getSiteSettings(),
    getPlatformDefaults(),
  ]);
  const cards = DEFAULT_FEATURE_CARDS_COPY.map(
    (fallback, index) => site.featureCards?.[index] ?? fallback,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Accounts
      </Link>
      <AdminTabs active="settings" />
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Platform admin
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Master settings
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        The public marketing page&apos;s copy and theme, plus the platform
        defaults every new account starts from. Changes here apply
        immediately — no deploy needed.
      </p>

      <section className="mt-8 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Landing page</h2>
        <p className="mt-1 text-sm text-muted">
          Blank a field and save to fall back to the built-in copy shown as
          its placeholder.
        </p>
        <form action={updateSiteSettingsAction} className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Eyebrow</span>
            <input
              name="heroEyebrow"
              defaultValue={site.heroEyebrow ?? ""}
              placeholder={DEFAULT_HERO_EYEBROW}
              className="field"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Headline</span>
            <input
              name="heroHeadline"
              defaultValue={site.heroHeadline ?? ""}
              placeholder={DEFAULT_HERO_HEADLINE}
              className="field"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Subhead</span>
            <textarea
              name="heroSubhead"
              defaultValue={site.heroSubhead ?? ""}
              placeholder={DEFAULT_HERO_SUBHEAD}
              rows={3}
              className="field"
            />
          </label>
          <label className="grid gap-1 text-sm sm:max-w-xs">
            <span className="font-medium">CTA button label</span>
            <input
              name="heroCtaLabel"
              defaultValue={site.heroCtaLabel ?? ""}
              placeholder={DEFAULT_HERO_CTA_LABEL}
              className="field"
            />
          </label>

          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="mt-1 text-xs text-muted">
              Pick a preset (background, accent, and font bundled together),
              or fine-tune the hex values and font afterward. Only affects
              this public page — signed-in users keep their own accent
              theme from Settings.
            </p>
            <div className="mt-2">
              <LandingThemePicker
                defaultAccentColor={site.accentColor ?? ""}
                defaultBackgroundColor={site.backgroundColor ?? ""}
                defaultFontFamily={site.fontFamily ?? "sans"}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Feature cards</p>
            <p className="mt-1 text-xs text-muted">
              Icons are fixed; only the title and description are editable,
              in order.
            </p>
            <div className="mt-2 grid gap-3">
              {cards.map((card, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_2fr]"
                >
                  <input
                    name={`cardTitle${index}`}
                    defaultValue={card.title}
                    placeholder={DEFAULT_FEATURE_CARDS_COPY[index].title}
                    className="field"
                  />
                  <input
                    name={`cardDescription${index}`}
                    defaultValue={card.description}
                    placeholder={DEFAULT_FEATURE_CARDS_COPY[index].description}
                    className="field"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
            >
              Save landing page
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Platform defaults</h2>
        <p className="mt-1 text-sm text-muted">
          Applies to every new account going forward — admin-created and
          self-serve signups alike. Existing accounts keep whatever trial end
          date and cap they already have.
        </p>
        <form
          action={updatePlatformDefaultsAction}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Trial length (days)</span>
            <input
              type="number"
              name="trialDays"
              min={1}
              defaultValue={platform.trialDays}
              className="field"
            />
            <span className="text-xs text-muted">
              Built-in default: {DEFAULT_TRIAL_DAYS} days.
            </span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Monthly generation cap</span>
            <input
              type="number"
              name="monthlyGenerationLimit"
              min={1}
              defaultValue={platform.monthlyGenerationLimit}
              className="field"
            />
            <span className="text-xs text-muted">
              Built-in default: {DEFAULT_MONTHLY_GENERATION_LIMIT}. Overridden
              by the USAGE_MONTHLY_GENERATION_LIMIT env var if that&apos;s set.
            </span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
            >
              Save platform defaults
            </button>
          </div>
        </form>
      </section>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.5rem 0.7rem;
          font-size: 0.875rem;
        }
      `}</style>
    </main>
  );
}
