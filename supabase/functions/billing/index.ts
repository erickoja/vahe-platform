// ============================================================================
//  Supabase Edge Function: billing
//  Subscription billing for Workshop Pilot. Calls the Stripe REST API directly
//  with fetch (no Stripe SDK — avoids Deno/Edge HTTP-client issues).
//  Actions (POST { action }): "checkout" (monthly|annual) | "portal".
//  Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL,
//           SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-injected).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Strip any stray whitespace/newlines/non-ASCII a pasted secret may carry (would break the header).
const STRIPE_KEY = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").replace(/[^\x21-\x7E]/g, "");
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

// POST form-encoded params to the Stripe REST API. Empty values are omitted.
async function stripeApi(path: string, params: Record<string, string | undefined>) {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") form.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")   return json({ error: "POST only" }, 405);
  try {
    if (!STRIPE_KEY) return json({ error: "billing not configured (missing STRIPE_SECRET_KEY)" }, 500);

    // Identify the caller from their JWT.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "not signed in" }, 401);
    const email = userData.user.email ?? undefined;

    // Resolve the caller's studio.
    const { data: mem } = await admin.from("studio_members").select("studio_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
    const studioId = mem?.studio_id;
    if (!studioId) return json({ error: "no studio for this user" }, 400);
    const { data: studio } = await admin.from("studios").select("id,name,stripe_customer_id").eq("id", studioId).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const origin = req.headers.get("Origin") || body.returnUrl || "";

    // Ensure a Stripe customer exists for this studio.
    let customerId = studio?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripeApi("customers", {
        email,
        name: studio?.name || undefined,
        "metadata[studio_id]": studioId,
      });
      customerId = customer.id;
      await admin.from("studios").update({ stripe_customer_id: customerId }).eq("id", studioId);
    }

    if (action === "portal") {
      const session = await stripeApi("billing_portal/sessions", { customer: customerId, return_url: origin || undefined });
      return json({ url: session.url });
    }

    if (action === "checkout") {
      const plan = body.plan === "annual" ? "annual" : "monthly";
      const price = PRICE[plan];
      if (!price) return json({ error: `missing price id for ${plan} (STRIPE_PRICE_${plan.toUpperCase()})` }, 500);
      const session = await stripeApi("checkout/sessions", {
        mode: "subscription",
        customer: customerId,
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        client_reference_id: studioId,
        "subscription_data[metadata][studio_id]": studioId,
        allow_promotion_codes: "true",
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
