// ============================================================================
//  Supabase Edge Function: stripe-webhook
//  Receives Stripe subscription events and writes the studio's billing status.
//  Deploy with verify_jwt = OFF (Stripe calls it directly, no user JWT).
//  Point a Stripe webhook endpoint at this function's URL and subscribe to:
//    checkout.session.completed, customer.subscription.updated,
//    customer.subscription.deleted, invoice.payment_failed, invoice.paid
//
//  Secrets to set on the project:
//    STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_…),
//    SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected)
// ============================================================================
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fetch HTTP client (Deno/Edge has no Node http) + SubtleCrypto for async signature verification.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// Map a Stripe subscription to our columns.
const planFromSub = (sub: Stripe.Subscription): string | null => {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return interval === "year" ? "annual" : interval === "month" ? "monthly" : null;
};
// trialing | active | past_due | canceled — collapse Stripe's statuses to ours.
const statusFromSub = (s: string): string =>
  s === "trialing" ? "trialing"
  : (s === "active") ? "active"
  : (s === "past_due" || s === "unpaid" || s === "incomplete") ? "past_due"
  : "canceled";

async function applySub(sub: Stripe.Subscription) {
  const studioId = sub.metadata?.studio_id;
  const patch: Record<string, unknown> = {
    sub_status: statusFromSub(sub.status),
    plan: planFromSub(sub),
    stripe_subscription_id: sub.id,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
  // Prefer matching by studio_id metadata; fall back to the Stripe customer id.
  if (studioId) await admin.from("studios").update(patch).eq("id", studioId);
  else if (sub.customer) await admin.from("studios").update(patch).eq("stripe_customer_id", String(sub.customer));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  try {
    const sig = req.headers.get("stripe-signature") ?? "";
    const raw = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(raw, sig, WH_SECRET, undefined, cryptoProvider);
    } catch (e) {
      return new Response("bad signature: " + String((e as Error)?.message ?? e), { status: 400 });
    }

    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (event.type === "customer.subscription.deleted") {
          const studioId = sub.metadata?.studio_id;
          const patch = { sub_status: "canceled" };
          if (studioId) await admin.from("studios").update(patch).eq("id", studioId);
          else await admin.from("studios").update(patch).eq("stripe_customer_id", String(sub.customer));
        } else {
          await applySub(sub);
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          if (!sub.metadata?.studio_id && session.client_reference_id) sub.metadata = { ...sub.metadata, studio_id: session.client_reference_id };
          await applySub(sub);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.customer) await admin.from("studios").update({ sub_status: "past_due" }).eq("stripe_customer_id", String(inv.customer));
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(inv.subscription));
          await applySub(sub);
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String((e as Error)?.message ?? e), { status: 500 });
  }
});
