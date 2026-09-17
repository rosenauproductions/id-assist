import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import { auth } from "@/auth";
import { LogoMark } from "@/components/logo-mark";

// The public marketing page. A signed-in visitor is bounced straight to
// their dashboard — this route is the front door for people who don't have
// an account yet, not a second home page for people who do.
export default async function MarketingHome() {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  return (
    <main>
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <div className="flex justify-center">
          <LogoMark className="h-12 w-12" />
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-accent">
          ADDIE + Bloom&apos;s, built into the tool
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Build a whole course, guardrailed by real instructional design
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
          ID Assist interviews your SME, drafts a Bloom&apos;s-gated outline,
          flags the pedagogy gaps other tools miss, and hands you
          ready-to-build artifacts — Rise, Canvas, Google Docs, and more.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Start free
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-line px-5 py-2.5 text-sm font-medium hover:border-accent/40"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          14-day free trial. No credit card required to start.
        </p>
      </section>

      <section className="border-t border-line bg-card/40">
        <div className="mx-auto grid max-w-5xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={ChatBubbleLeftRightIcon}
            title="Interview the expert"
            description="Work an adaptive question set live on a call, or send a link the SME answers on their own — no ID Assist account needed."
          />
          <FeatureCard
            icon={ShieldCheckIcon}
            title="Pedagogy gates, not guesses"
            description="Every outline runs through real Bloom's-alignment and quantity checks before it's approved — not vibes, rules."
          />
          <FeatureCard
            icon={ChartBarIcon}
            title="Cost and time, estimated"
            description="Track hours by phase, see the estimate update live, and export delivery-ready artifacts once the outline clears review."
          />
          <FeatureCard
            icon={UsersIcon}
            title="Built for a team"
            description="Invite collaborators into a shared workspace, or run it solo as a freelancer — same tool, same guardrails either way."
          />
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
