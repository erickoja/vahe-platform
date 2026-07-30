// ============================================================================
//  Supabase Edge Function: billing
//  Subscription billing for Prong Studio (studios pay to use the SaaS).
//  Actions (POST { action }):
//    - "checkout": start a Stripe Checkout subscription (monthly|annual) → { url }
//    - "portal":   open the Stripe billing portal to manage/cancel → { url }
//  Auth: verify_jwt ON — only a signed-in studio member can call it. We resolve
//  the caller's studio from studio_members (service role) so the client can't
//  bill someone else's studio.
//
//  Secrets to set on the project:
//    STRIPE_SECRET_KEY          sk_live_… (or sk_test_…)
//    STRIPE_PRICE_MONTHLY       price_…  (recurring monthly price id)
//    STRIPE_PRICE_ANNUAL        price_…  (recurring yearly price id)
//    SUPABASE_URL               (auto-injected)
//    SUPABASE_SERVICE_ROLE_KEY  (auto-injected)
//  Trial length is set on the Stripe Price/Product (or via trial_period_days below).
// ============================================================================
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });
const PRICE: Record<string, string> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY") ?? "",
  annual:  Deno.env.get("STRIPE_PRICE_ANNUAL")  ?? "",
};
const TRIAL_DAYS = 14;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")   return json({ error: "POST only" }, 405);
  try {
    if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ error: "billing not configured" }, 500);
    // Identify the caller from their JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "not signed in" }, 401);
    const userId = userData.user.id;
    const email = userData.user.email ?? undefined;

    // Resolve the caller's studio (first membership).
    const { data: mem } = await admin.from("studio_members").select("studio_id").eq("user_id", userId).limit(1).maybeSingle();
    const studioId = mem?.studio_id;
    if (!studioId) return json({ error: "no studio" }, 400);
    const { data: studio } = await admin.from("studios").select("id,name,stripe_customer_id").eq("id", studioId).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const origin = req.headers.get("Origin") || body.returnUrl || "";

    // Ensure a Stripe customer exists for this studio.
    let customerId = studio?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: studio?.name || undefined,
        metadata: { studio_id: studioId },
      });
      customerId = customer.id;
      await admin.from("studios").update({ stripe_customer_id: customerId }).eq("id", studioId);
    }

    if (action === "portal") {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: origin || undefined,
      });
      return json({ url: session.url });
    }

    if (action === "checkout") {
      const plan = body.plan === "annual" ? "annual" : "monthly";
      const price = PRICE[plan];
      if (!price) return json({ error: `missing price id for ${plan}` }, 500);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price, quantity: 1 }],
        client_reference_id: studioId,
        subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { studio_id: studioId } },
        allow_promotion_codes: true,
        success_url: `${origin}/?billing=success`,
        cancel_url: `${origin}/?billing=cancelled`,
      });
      return json({ url: session.url });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
