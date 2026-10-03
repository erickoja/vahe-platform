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
  // Constant-time compare, and reject stale timestamps (replay protection, 5 min tolerance like Stripe's libs).
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  if (hex.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
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

// Stripe API 2025-03-31+ moved current_period_end from the subscription onto its items.
const periodEnd = (sub: any) => {
  const t = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
};
// Newer API versions also moved invoice.subscription under invoice.parent.subscription_details.
const invoiceSubId = (inv: any): string | null =>
  inv?.subscription ? String(inv.subscription) : (inv?.parent?.subscription_details?.subscription ? String(inv.parent.subscription_details.subscription) : null);

// Is this subscription the one currently on the studio? Stale/old subscriptions (e.g. a past_due one the studio
// replaced) must not flip a studio that has since moved to a newer subscription.
async function isCurrentSub(subId: string | undefined, studioId?: string, customer?: string) {
  if (!subId) return true;
  const q = studioId ? admin.from("studios").select("stripe_subscription_id").eq("id", studioId)
                     : admin.from("studios").select("stripe_subscription_id").eq("stripe_customer_id", String(customer ?? ""));
  const { data } = await q.maybeSingle();
  const cur = data?.stripe_subscription_id;
  return !cur || cur === subId;
}

async function applySub(sub: any) {
  const studioId = sub?.metadata?.studio_id;
  const patch: Record<string, unknown> = {
    sub_status: statusMap(sub.status),
    plan: planFrom(sub),
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd(sub),
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
        if (!(await isCurrentSub(obj.id, obj.metadata?.studio_id, obj.customer))) break;   // an old sub ending must not cancel a newer one
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
        if (obj.customer && (await isCurrentSub(invoiceSubId(obj) ?? undefined, undefined, obj.customer))) await admin.from("studios").update({ sub_status: "past_due" }).eq("stripe_customer_id", String(obj.customer));
        break;
      case "invoice.paid": {
        const sid = invoiceSubId(obj);
        if (sid) await applySub(await getSubscription(sid));
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String((e as Error)?.message ?? e), { status: 500 });
  }
});
