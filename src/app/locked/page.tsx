import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { requireWorkspaceContext } from "@/lib/team/store";
import {
  getAvailablePlanOptions,
  getBillingSummary,
  hasStripe,
  type BillingSummary,
} from "@/lib/billing/store";
import { LogoMark } from "@/components/logo-mark";
import { startCheckoutAction } from "@/app/settings/actions";

const VALUE_PROPS = [
  "Unlimited course outlines, gated by real Bloom's-alignment and quantity checks",
  "AI-drafted lessons, assessments, and ready-to-build delivery files (Rise, Canvas, Docs, and more)",
  "A shared workspace for your whole team, not just one seat",
];

function headline(status: BillingSummary["status"], isTrialExpired: boolean): string {
  if (status === "suspended") return "This account has been suspended";
  if (status === "canceled") return "This account's subscription was canceled";
  if (isTrialExpired) return "Your free trial has ended";
  return "Upgrade to keep going";
}

function subhead(status: BillingSummary["status"], isTrialExpired: boolean): string {
  if (status === "suspended") {
    return "Contact support to talk about getting it reactivated.";
  }
  if (status === "canceled" || isTrialExpired) {
    return "Pick a plan to pick up right where you left off — nothing you've built has been touched.";
  }
  return "Everything you've built is safe and waiting.";
}

// Where a locked-out account lands right after login, in place of the
// course dashboard — a dashboard full of content they can't act on isn't
// useful, and this is the moment they're most likely to actually upgrade.
export default async function LockedPage() {
  const context = await requireWorkspaceContext();
  const billing = await getBillingSummary(context.workspaceId);

  if (billing.isWritable) {
    redirect("/app");
  }

  const planOptions = billing.status === "suspended" ? [] : await getAvailablePlanOptions();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <div className="flex justify-center">
        <LogoMark className="h-10 w-10" />
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        {context.workspaceName}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {headline(billing.status, billing.isTrialExpired)}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {subhead(billing.status, billing.isTrialExpired)}
      </p>

      <ul className="mt-8 grid gap-2 text-left text-sm">
        {VALUE_PROPS.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {billing.status === "suspended" ? (
        <div className="mt-8">
          <Link
            href="/tickets/new"
            className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Contact support
          </Link>
        </div>
      ) : context.role !== "owner" ? (
        <p className="mt-8 rounded-lg border border-line bg-card p-4 text-sm text-muted">
          Ask an account owner to upgrade in Settings → Billing to keep
          creating and editing courses.
        </p>
      ) : hasStripe() && planOptions.length > 0 ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {planOptions.map((option) => (
            <form key={option.interval} action={startCheckoutAction}>
              <input type="hidden" name="interval" value={option.interval} />
              <button
                type="submit"
                className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
              >
                Upgrade — {option.amountLabel}
              </button>
            </form>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          Billing isn&apos;t set up on this account yet — reach out to get it
          reactivated.
        </p>
      )}

      <p className="mt-10 text-xs text-muted">
        <Link href="/settings" className="text-accent hover:underline">
          Go to billing settings
        </Link>
      </p>
    </main>
  );
}
