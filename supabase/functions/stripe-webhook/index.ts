// ============================================================================
//  Supabase Edge Function: stripe-webhook  (deploy with verify_jwt = OFF)
//  Verifies Stripe's signature with Web Crypto (HMAC-SHA256) and writes the
//  studio's billing status. No Stripe SDK — plain fetch, so no Deno/Edge issues.
//  Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL,
//           SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_KEY = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").replace(/[^\x21-\x7E]/g, "");
const WH_SECRET  = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").replace(/[^\x21-\x7E]/g, "");
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);
const enc = new TextEncoder();

// Verify Stripe's "t=..,v1=.." signature header: HMAC-SHA256 of `${t}.${payload}`.
async function verify(payload: string, header: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) { const i = kv.indexOf("="); if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1); }
  if (!parts.t || !parts.v1 || !WH_SECRET) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(WH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${parts.t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === parts.v1;
}

async function getSubscription(id: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  return await res.json();
}

const statusMap = (s: string) =>
  s === "trialing" ? "trialing" : s === "active" ? "active"
  : (s === "past_due" || s === "unpaid" || s === "incomplete") ? "past_due" : "canceled";
const planFrom = (sub: any) => {
  const i = sub?.items?.data?.[0]?.price?.recurring?.interval;
  return i === "year" ? "annual" : i === "month" ? "monthly" : null;
};

async function applySub(sub: any) {
  const studioId = sub?.metadata?.studio_id;
  const patch: Record<string, unknown> = {
    sub_status: statusMap(sub.status),
    plan: planFrom(sub),
    stripe_subscription_id: sub.id,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
  if (studioId) await admin.from("studios").update(patch).eq("id", studioId);
  else if (sub.customer) await admin.from("studios").update(patch).eq("stripe_customer_id", String(sub.customer));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!(await verify(raw, sig))) return new Response("bad signature", { status: 400 });

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  try {
    const obj = event.data?.object ?? {};
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await applySub(obj);
        break;
      case "customer.subscription.deleted":
        if (obj.metadata?.studio_id) await admin.from("studios").update({ sub_status: "canceled" }).eq("id", obj.metadata.studio_id);
        else if (obj.customer) await admin.from("studios").update({ sub_status: "canceled" }).eq("stripe_customer_id", String(obj.customer));
        break;
      case "checkout.session.completed":
        if (obj.subscription) {
          const sub = await getSubscription(String(obj.subscription));
          if (!sub?.metadata?.studio_id && obj.client_reference_id) sub.metadata = { ...(sub.metadata || {}), studio_id: obj.client_reference_id };
          await applySub(sub);
        }
        break;
      case "invoice.payment_failed":
        if (obj.customer) await admin.from("studios").update({ sub_status: "past_due" }).eq("stripe_customer_id", String(obj.customer));
        break;
      case "invoice.paid":
        if (obj.subscription) await applySub(await getSubscription(String(obj.subscription)));
        break;
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String((e as Error)?.message ?? e), { status: 500 });
  }
});
