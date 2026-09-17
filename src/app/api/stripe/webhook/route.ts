import { applyStripeEvent } from "@/lib/billing/store";
import { getStripe } from "@/lib/billing/stripe";

// Public route — Stripe calls this with no session cookie at all. It's
// carved out of the auth middleware (middleware.ts) the same way
// /interview/link is, but trust here comes from the signature check below,
// not an unguessable token.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return Response.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe webhook] signature verification failed:", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await applyStripeEvent(event);
  } catch (error) {
    console.error("[stripe webhook] failed to apply event:", event.type, error);
    return Response.json({ error: "Failed to process event" }, { status: 500 });
  }

  return Response.json({ received: true });
}
