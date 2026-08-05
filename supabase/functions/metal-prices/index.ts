// ============================================================================
//  Supabase Edge Function: metal-prices
//  Fetches live precious-metal spot prices (AUD per gram) from metals.dev
//  for the "Update spot prices" screen. The API key stays server-side.
//
//  Secrets required (set via CLI or dashboard):  METALS_DEV_API_KEY
//  Deploy:  supabase functions deploy metal-prices --project-ref <ref>
//
//  Called from the app with supabase.functions.invoke("metal-prices") —
//  requires a logged-in user (JWT verified by default), so only studio
//  members can spend the metals.dev request quota.
// ============================================================================

const API_KEY = Deno.env.get("METALS_DEV_API_KEY") ?? "";
const TROY_OZ_GRAMS = 31.1034768;

// Browser calls need CORS (invoke() sends Authorization/apikey headers).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!API_KEY) return json({ error: "METALS_DEV_API_KEY secret is not set" }, 500);

    // The app passes the studio's currency (e.g. { currency: "GBP" }); default to AUD. Sanitised to
    // a 3-letter ISO code so it can't corrupt the request.
    let cur = "AUD";
    try { const b = await req.json(); if (b && typeof b.currency === "string") cur = b.currency; } catch { /* no body */ }
    cur = (cur || "AUD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "AUD";

    const r = await fetch(
      `https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(API_KEY)}&currency=${cur}&unit=g`,
    );
    if (!r.ok) return json({ error: `metals.dev responded ${r.status}: ${await r.text()}` }, 502);
    const data = await r.json();
    if (data.status && data.status !== "success") {
      return json({ error: `metals.dev error: ${data.error_message || data.status}` }, 502);
    }

    const m = data.metals ?? {};
    let gold = Number(m.gold), platinum = Number(m.platinum), silver = Number(m.silver);
    if (!(gold > 0) || !(silver > 0)) return json({ error: "metals.dev response missing gold/silver prices" }, 502);

    // Safety net: if the unit param was ignored and prices came back per troy oz
    // (AUD gold per-gram is ~O(100), per-toz is ~O(5000)), convert to grams.
    if (gold > 1500) {
      gold /= TROY_OZ_GRAMS;
      platinum /= TROY_OZ_GRAMS;
      silver /= TROY_OZ_GRAMS;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return json({
      gold: round(gold),
      platinum: platinum > 0 ? round(platinum) : null,
      silver: round(silver),
      currency: cur,
      unit: "g",
      source: "metals.dev",
      marketTimestamp: data.timestamps?.metal ?? null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
