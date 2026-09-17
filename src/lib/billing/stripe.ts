import Stripe from "stripe";

// A single Stripe client, created lazily so a deployment with no billing
// configured yet (Chris hasn't created a Stripe account) doesn't crash on
// import — only the code paths that actually need Stripe will throw, and
// only when they're actually called.
let client: Stripe | null = null;

export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Billing isn't configured yet — add STRIPE_SECRET_KEY (and STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET) in Vercel.",
    );
  }
  if (!client) {
    client = new Stripe(secretKey);
  }
  return client;
}
