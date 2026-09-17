"use client";

import { useState, useTransition } from "react";
import {
  openBillingPortalAction,
  startCheckoutAction,
  updateAppearanceAction,
  updateWorkspaceSettingsAction,
} from "./actions";
import type { BillingPlanOption, BillingSummary } from "@/lib/billing/store";
import {
  ACCENT_THEMES,
  ACCENT_THEME_LABELS,
  type AccentTheme,
  type Appearance,
  type ThemeMode,
  type WorkspaceSettings,
} from "@/lib/settings/types";
import { DELIVERY_TARGETS, type DeliveryTarget } from "@/lib/id/types";

const THEME_MODES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Always light, regardless of your OS." },
  { id: "dark", label: "Dark", hint: "Always dark, regardless of your OS." },
  { id: "system", label: "System", hint: "Match your OS/browser setting." },
];

const ACCENT_SWATCH: Record<AccentTheme, string> = {
  teal: "#1f6b5a",
  blue: "#1d4ed8",
  violet: "#6d28d9",
  amber: "#b45309",
  rose: "#be123c",
};

const DELIVERY_LABELS: Record<DeliveryTarget, string> = {
  rise: "Rise build sheet",
  canvas: "Canvas pages",
  gdoc: "Google Doc",
  gslides: "Google Slides",
  video: "Video script",
  tutor: "Live tutor",
};

export function SettingsPanel({
  appearance,
  isOwner,
  workspace,
  billing,
  planOptions,
}: {
  appearance: Appearance;
  isOwner: boolean;
  workspace: WorkspaceSettings;
  billing: BillingSummary;
  planOptions: BillingPlanOption[];
}) {
  return (
    <div className="mt-8 grid gap-6">
      <BillingSection isOwner={isOwner} billing={billing} planOptions={planOptions} />
      <AppearanceSection appearance={appearance} />
      <WorkspaceSection isOwner={isOwner} workspace={workspace} />
    </div>
  );
}

const STATUS_LABEL: Record<BillingSummary["status"], string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment issue",
  suspended: "Suspended",
  canceled: "Canceled",
};

const STATUS_TONE: Record<BillingSummary["status"], string> = {
  trialing: "bg-accent/10 text-accent",
  active: "bg-accent/10 text-accent",
  past_due: "bg-warn/10 text-warn",
  suspended: "bg-danger/10 text-danger",
  canceled: "bg-danger/10 text-danger",
};

function BillingSection({
  isOwner,
  billing,
  planOptions,
}: {
  isOwner: boolean;
  billing: BillingSummary;
  planOptions: BillingPlanOption[];
}) {
  const usagePercent = Math.min(
    100,
    Math.round(
      (billing.generationsUsedThisMonth / Math.max(1, billing.monthlyGenerationLimit)) *
        100,
    ),
  );

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Billing</h2>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_TONE[billing.status]}`}
        >
          {STATUS_LABEL[billing.status]}
        </span>
      </div>

      {billing.status === "trialing" ? (
        <p className="mt-2 text-sm text-muted">
          {billing.isTrialExpired
            ? "Your free trial has ended. Upgrade to keep creating and editing courses."
            : billing.trialDaysLeft !== null
              ? `${billing.trialDaysLeft} day${billing.trialDaysLeft === 1 ? "" : "s"} left in your free trial.`
              : "You're on a free trial."}
        </p>
      ) : billing.status === "past_due" ? (
        <p className="mt-2 text-sm text-warn">
          There&apos;s a problem with this account&apos;s card. Update payment
          to avoid interruption.
        </p>
      ) : billing.status === "suspended" ? (
        <p className="mt-2 text-sm text-danger">
          This account has been suspended. Contact support to reactivate it.
        </p>
      ) : billing.status === "canceled" ? (
        <p className="mt-2 text-sm text-danger">
          This subscription was canceled. Upgrade to keep creating and
          editing courses.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">Thanks for subscribing.</p>
      )}

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>AI generations this month</span>
          <span>
            {billing.generationsUsedThisMonth} / {billing.monthlyGenerationLimit}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {!isOwner ? (
        <p className="mt-4 text-xs text-muted">
          Only a workspace owner can manage billing.
        </p>
      ) : !billing.billingConfigured ? (
        <p className="mt-4 text-xs text-muted">
          Billing isn&apos;t set up on this deployment yet.
        </p>
      ) : billing.hasStripeCustomer ? (
        <form action={openBillingPortalAction} className="mt-4">
          <button type="submit" className="btn-primary">
            Manage billing
          </button>
        </form>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {planOptions.map((plan) => (
              <form key={plan.interval} action={startCheckoutAction}>
                <input type="hidden" name="interval" value={plan.interval} />
                <button type="submit" className="btn-primary">
                  Upgrade — {plan.amountLabel}
                  {plan.interval === "year" ? " (save 2 months)" : ""}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Have a promo code? There&apos;s a spot for it on the checkout page.
          </p>
        </div>
      )}

      <style>{`
        .btn-primary {
          border-radius: 0.5rem;
          background: var(--foreground);
          color: var(--background);
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
      `}</style>
    </section>
  );
}

function AppearanceSection({ appearance }: { appearance: Appearance }) {
  const [themeMode, setThemeMode] = useState(appearance.themeMode);
  const [accentTheme, setAccentTheme] = useState(appearance.accentTheme);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply(next: { themeMode: ThemeMode; accentTheme: AccentTheme }) {
    setError(null);
    const formData = new FormData();
    formData.set("themeMode", next.themeMode);
    formData.set("accentTheme", next.accentTheme);
    startTransition(async () => {
      try {
        await updateAppearanceAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save appearance");
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted">
        Personal — saved to your account and follows you to any device you
        sign into. Changes apply immediately.
      </p>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Theme
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEME_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={pending}
              title={mode.hint}
              onClick={() => {
                setThemeMode(mode.id);
                apply({ themeMode: mode.id, accentTheme });
              }}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                themeMode === mode.id
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-line bg-background text-muted hover:text-foreground"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Accent color
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENT_THEMES.map((accent) => (
            <button
              key={accent}
              type="button"
              disabled={pending}
              onClick={() => {
                setAccentTheme(accent);
                apply({ themeMode, accentTheme: accent });
              }}
              title={ACCENT_THEME_LABELS[accent]}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                accentTheme === accent
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-line bg-background text-muted hover:text-foreground"
              }`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full"
                style={{ background: ACCENT_SWATCH[accent] }}
              />
              {ACCENT_THEME_LABELS[accent]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkspaceSection({
  isOwner,
  workspace,
}: {
  isOwner: boolean;
  workspace: WorkspaceSettings;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateWorkspaceSettingsAction(formData);
        setSaved(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save workspace settings",
        );
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Workspace</h2>
        {!isOwner ? (
          <span className="text-xs text-muted">Owners only — view only</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        Shared with everyone in the workspace.
      </p>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {saved && !error ? (
        <p className="mt-3 text-sm text-accent">Saved.</p>
      ) : null}

      <form action={submit} className="mt-4 grid gap-5">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Workspace name</span>
          <input
            name="name"
            defaultValue={workspace.name}
            disabled={!isOwner}
            className="field w-full disabled:opacity-60"
          />
        </label>

        <div>
          <p className="text-sm font-medium">Default delivery mix</p>
          <p className="mt-1 text-xs text-muted">
            Pre-checked channels on new briefs (wizard and the full form).
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DELIVERY_TARGETS.map((target) => (
              <label
                key={target}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name={`delivery-${target}`}
                  defaultChecked={workspace.defaultDelivery.includes(target)}
                  disabled={!isOwner}
                />
                {DELIVERY_LABELS[target]}
              </label>
            ))}
          </div>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Gemini model override</span>
          <input
            name="modelOverride"
            defaultValue={workspace.modelOverride ?? ""}
            placeholder="gemini-2.5-flash (default — leave blank to use it)"
            disabled={!isOwner}
            className="field w-full disabled:opacity-60"
          />
          <span className="text-xs text-muted">
            Only affects the Google/Gemini provider. Leave blank to use the
            deploy&apos;s default model.
          </span>
        </label>

        {isOwner ? (
          <div>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save workspace settings"}
            </button>
          </div>
        ) : null}
      </form>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.5rem 0.7rem;
        }
        .btn-primary {
          border-radius: 0.5rem;
          background: var(--foreground);
          color: var(--background);
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
      `}</style>
    </section>
  );
}
