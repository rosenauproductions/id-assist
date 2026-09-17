import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import { auth } from "@/auth";
import { LogoMark } from "@/components/logo-mark";
import {
  DEFAULT_FEATURE_CARDS_COPY,
  DEFAULT_HERO_CTA_LABEL,
  DEFAULT_HERO_EYEBROW,
  DEFAULT_HERO_HEADLINE,
  DEFAULT_HERO_SUBHEAD,
  getPlatformDefaults,
  getSiteSettings,
} from "@/lib/platform/settings";

// Icons stay fixed in code — /admin/settings only edits each card's copy —
// so this array pairs each of DEFAULT_FEATURE_CARDS_COPY's slots with its
// icon by position.
const FEATURE_CARD_ICONS: ComponentType<SVGProps<SVGSVGElement>>[] = [
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  UsersIcon,
];

// The public marketing page. A signed-in visitor is bounced straight to
// their dashboard — this route is the front door for people who don't have
// an account yet, not a second home page for people who do. Copy, accent
// color, and feature-card text are all overridable from /admin/settings
// (src/lib/platform/settings.ts); every field there is nullable, so this
// page falls back to its own built-in copy field by field when nothing's
// been saved yet.
export default async function MarketingHome() {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  const [site, { trialDays }] = await Promise.all([
    getSiteSettings(),
    getPlatformDefaults(),
  ]);

  const featureCards = DEFAULT_FEATURE_CARDS_COPY.map((fallback, index) => {
    const override = site.featureCards?.[index];
    return {
      icon: FEATURE_CARD_ICONS[index],
      title: override?.title || fallback.title,
      description: override?.description || fallback.description,
    };
  });

  return (
    <main
      style={
        site.accentColor
          ? ({ "--accent": site.accentColor } as CSSProperties)
          : undefined
      }
    >
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <div className="flex justify-center">
          <LogoMark className="h-12 w-12" />
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-accent">
          {site.heroEyebrow || DEFAULT_HERO_EYEBROW}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {site.heroHeadline || DEFAULT_HERO_HEADLINE}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
          {site.heroSubhead || DEFAULT_HERO_SUBHEAD}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            {site.heroCtaLabel || DEFAULT_HERO_CTA_LABEL}
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-line px-5 py-2.5 text-sm font-medium hover:border-accent/40"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          {trialDays}-day free trial. No credit card required to start.
        </p>
      </section>

      <section className="border-t border-line bg-card/40">
        <div className="mx-auto grid max-w-5xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => (
            <FeatureCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              description={card.description}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ready to see it on your own course?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Set up a free account in under a minute — no credit card required.
        </p>
        <div className="mt-6">
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Start free
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-5 text-left">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
