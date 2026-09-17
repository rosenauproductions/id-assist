import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db/client";
import { usageCounters, workspaces } from "@/lib/db/schema";
import { requireWorkspaceContext } from "@/lib/team/store";
import type { AccountStatus } from "@/lib/admin/store";
import { getPlatformDefaults } from "@/lib/platform/settings";
import { getStripe, hasStripe } from "./stripe";

export { hasStripe };

// USAGE_MONTHLY_GENERATION_LIMIT stays as an ops-level override (set it in
// Vercel to force a cap regardless of what's saved in /admin/settings); the
// platform_settings value from getPlatformDefaults() is the normal way to
// change it now, and its own fallback (150) applies only if neither is set.
async function monthlyGenerationLimit(): Promise<number> {
  const raw = Number(process.env.USAGE_MONTHLY_GENERATION_LIMIT);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return (await getPlatformDefaults()).monthlyGenerationLimit;
}

function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Reads (or lazily creates/rolls over) this workspace's usage-counter row.
 * Rollover is checked here, in application code, rather than a cron job —
 * the counter simply resets the first time anyone in a new calendar month
 * triggers a generation. */
async function getOrResetUsageRow(
  workspaceId: string,
): Promise<{ periodStart: Date; generationCount: number }> {
  const periodStart = currentPeriodStart();
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.workspaceId, workspaceId))
    .limit(1);

  if (!row) {
    const [inserted] = await db
      .insert(usageCounters)
      .values({ workspaceId, periodStart, generationCount: 0 })
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted;
    // Lost an insert race — someone else created the row first; fall
    // through and re-read it below.
  } else if (row.periodStart.getTime() < periodStart.getTime()) {
    const [updated] = await db
      .update(usageCounters)
      .set({ periodStart, generationCount: 0 })
      .where(eq(usageCounters.workspaceId, workspaceId))
      .returning();
    return updated;
  } else {
    return row;
  }

  const [refetched] = await db
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.workspaceId, workspaceId))
    .limit(1);
  return refetched ?? { periodStart, generationCount: 0 };
}

/** Whether a workspace in this status/trial state may still create or
 * change anything — false means read-only lockout, per the roadmap's
 * decision to lock out gently rather than delete anything. "past_due"
 * stays writable: Stripe is still retrying the card, and locking out on
 * the first missed payment would be needlessly harsh. */
export function isWorkspaceStatusWritable(
  status: AccountStatus,
  trialEndsAt: Date | null,
): boolean {
  if (status === "suspended" || status === "canceled") return false;
  if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() < Date.now()) {
    return false;
  }
  return true;
}

/** The single enforcement choke point for account state — called from
 * lib/id/store.ts's saveProject() so every project create/edit anywhere in
 * the app goes through it, and directly from the two AI-call routes
 * (tutor, brief-coach) that don't go through saveProject. */
export async function assertWorkspaceWritable(workspaceId: string): Promise<void> {
  const [ws] = await db
    .select({ status: workspaces.status, trialEndsAt: workspaces.trialEndsAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) throw new Error("Workspace not found.");

  const status = ws.status as AccountStatus;
  if (status === "suspended") {
    throw new Error(
      "This account has been suspended. Contact support to reactivate it.",
    );
  }
  if (status === "canceled") {
    throw new Error(
      "This account's subscription was canceled. Upgrade in Settings → Billing to keep creating.",
    );
  }
  if (status === "trialing" && ws.trialEndsAt && ws.trialEndsAt.getTime() < Date.now()) {
    throw new Error(
      "Your free trial has ended. Upgrade in Settings → Billing to keep creating.",
    );
  }
}

/** Checks the account is writable AND has generation budget left this
 * month, then consumes one unit. Throws with a user-facing message either
 * way — callers (tutor route, brief-coach route) decide how to surface it. */
export async function assertAndConsumeGeneration(workspaceId: string): Promise<void> {
  await assertWorkspaceWritable(workspaceId);
  const limit = await monthlyGenerationLimit();
  const usage = await getOrResetUsageRow(workspaceId);
  if (usage.generationCount >= limit) {
    throw new Error(
      `This account has used its ${limit} AI generations for this billing period. It resets on the 1st of next month.`,
    );
  }
  await db
    .update(usageCounters)
    .set({ generationCount: usage.generationCount + 1, updatedAt: new Date() })
    .where(eq(usageCounters.workspaceId, workspaceId));
}

export type BillingSummary = {
  status: AccountStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  isTrialExpired: boolean;
  isWritable: boolean;
  hasStripeCustomer: boolean;
  monthlyGenerationLimit: number;
  generationsUsedThisMonth: number;
  billingConfigured: boolean;
};

export async function getBillingSummary(workspaceId: string): Promise<BillingSummary> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) throw new Error("Workspace not found.");

  const status = ws.status as AccountStatus;
  const trialEndsAt = ws.trialEndsAt;
  const now = Date.now();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
    : null;
  const isTrialExpired = Boolean(
    status === "trialing" && trialEndsAt && trialEndsAt.getTime() < now,
  );
  const usage = await getOrResetUsageRow(workspaceId);

  return {
    status,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    trialDaysLeft,
    isTrialExpired,
    isWritable: isWorkspaceStatusWritable(status, trialEndsAt),
    hasStripeCustomer: Boolean(ws.stripeCustomerId),
    monthlyGenerationLimit: await monthlyGenerationLimit(),
    generationsUsedThisMonth: usage.generationCount,
    billingConfigured: hasStripe(),
  };
}

export type BillingBanner = {
  status: AccountStatus;
  trialDaysLeft: number | null;
  isTrialExpired: boolean;
  isOwner: boolean;
};

/** Same pattern as getCurrentImpersonationBanner() in lib/admin/store.ts:
 * safe to call from the root layout for every page, returns null instead
 * of throwing for a signed-out visitor, and null again when there's simply
 * nothing worth telling the user right now. */
export async function getCurrentBillingBanner(): Promise<BillingBanner | null> {
  let context;
  try {
    context = await requireWorkspaceContext();
  } catch {
    return null;
  }

  const summary = await getBillingSummary(context.workspaceId);
  const nearTrialEnd =
    summary.status === "trialing" &&
    !summary.isTrialExpired &&
    summary.trialDaysLeft !== null &&
    summary.trialDaysLeft <= 3;
  const noteworthy =
    summary.status === "suspended" ||
    summary.status === "canceled" ||
    summary.status === "past_due" ||
    summary.isTrialExpired ||
    nearTrialEnd;
  if (!noteworthy) return null;

  return {
    status: summary.status,
    trialDaysLeft: summary.trialDaysLeft,
    isTrialExpired: summary.isTrialExpired,
    isOwner: context.role === "owner",
  };
}

export type BillingInterval = "month" | "year";

function priceIdForInterval(interval: BillingInterval): string | undefined {
  return interval === "year"
    ? process.env.STRIPE_PRICE_ID_ANNUAL
    : process.env.STRIPE_PRICE_ID_MONTHLY;
}

export type BillingPlanOption = {
  interval: BillingInterval;
  priceId: string;
  amountLabel: string;
};

function formatPriceLabel(price: Stripe.Price, suffix: string): string {
  const amount = (price.unit_amount ?? 0) / 100;
  const formatted = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return `$${formatted}/${suffix}`;
}

/** Reads whichever price ids are actually configured and asks Stripe for
 * their current amount, so the displayed price always matches whatever is
 * set in the Stripe dashboard — changing a price there never needs a code
 * change here. Returns [] (not a throw) when billing isn't configured yet,
 * so the settings page can render its "not set up" state instead. */
export async function getAvailablePlanOptions(): Promise<BillingPlanOption[]> {
  if (!hasStripe()) return [];
  const stripe = getStripe();
  const options: BillingPlanOption[] = [];
  const monthlyId = process.env.STRIPE_PRICE_ID_MONTHLY;
  const annualId = process.env.STRIPE_PRICE_ID_ANNUAL;
  if (monthlyId) {
    const price = await stripe.prices.retrieve(monthlyId);
    options.push({ interval: "month", priceId: monthlyId, amountLabel: formatPriceLabel(price, "mo") });
  }
  if (annualId) {
    const price = await stripe.prices.retrieve(annualId);
    options.push({ interval: "year", priceId: annualId, amountLabel: formatPriceLabel(price, "yr") });
  }
  return options;
}

export async function createCheckoutSession(input: {
  workspaceId: string;
  email: string;
  baseUrl: string;
  interval: BillingInterval;
}): Promise<string> {
  const stripe = getStripe();
  const priceId = priceIdForInterval(input.interval);
  if (!priceId) {
    throw new Error(
      `No Stripe price configured yet for ${input.interval === "year" ? "annual" : "monthly"} billing — set STRIPE_PRICE_ID_${input.interval === "year" ? "ANNUAL" : "MONTHLY"} in Vercel.`,
    );
  }

  const [ws] = await db
    .select({ stripeCustomerId: workspaces.stripeCustomerId })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: ws?.stripeCustomerId ?? undefined,
    customer_email: ws?.stripeCustomerId ? undefined : input.email,
    line_items: [{ price: priceId, quantity: 1 }],
    // Lets a signup coupon (e.g. a referral code) be redeemed right in
    // Checkout, on either interval. Note: a coupon scoped to a fixed
    // number of months (Stripe's "repeating" duration) still applies in
    // full to whichever invoice it lands on — on the annual plan that
    // means the whole first year, not just a few months of it, since
    // annual bills as one invoice. Stripe has no per-price restriction on
    // coupons (only per-product, and both intervals share one product), so
    // that's a real interaction to know about if a "N months free" code is
    // meant to be monthly-only.
    allow_promotion_codes: true,
    success_url: `${input.baseUrl}/settings?billing=success`,
    cancel_url: `${input.baseUrl}/settings?billing=canceled`,
    client_reference_id: input.workspaceId,
    subscription_data: { metadata: { workspaceId: input.workspaceId } },
    metadata: { workspaceId: input.workspaceId },
  });

  if (!session.url) throw new Error("Stripe didn't return a checkout URL.");
  return session.url;
}

export async function createPortalSession(input: {
  workspaceId: string;
  baseUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const [ws] = await db
    .select({ stripeCustomerId: workspaces.stripeCustomerId })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!ws?.stripeCustomerId) {
    throw new Error("No billing account on file yet — upgrade first.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: ws.stripeCustomerId,
    return_url: `${input.baseUrl}/settings`,
  });
  return session.url;
}

function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
): AccountStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // "incomplete" and any future Stripe status we don't special-case —
      // safest default is "past_due" (visible, not a hard lockout) rather
      // than silently treating an unknown status as fully active.
      return "past_due";
  }
}

/** Applies one verified Stripe webhook event to our own account state.
 * Deliberately narrow — only the events that change status/customer/
 * subscription ids are handled; everything else is a no-op. */
export async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId =
        session.client_reference_id || session.metadata?.workspaceId;
      if (!workspaceId) break;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null);
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      await db
        .update(workspaces)
        .set({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: "active",
          suspendedAt: null,
        })
        .where(eq(workspaces.id, workspaceId));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspaceId;
      if (!workspaceId) break;
      await db
        .update(workspaces)
        .set({
          status: mapStripeSubscriptionStatus(subscription.status),
          stripeSubscriptionId: subscription.id,
        })
        .where(eq(workspaces.id, workspaceId));
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspaceId;
      if (!workspaceId) break;
      await db
        .update(workspaces)
        .set({ status: "canceled" })
        .where(eq(workspaces.id, workspaceId));
      break;
    }
    default:
      break;
  }
}
