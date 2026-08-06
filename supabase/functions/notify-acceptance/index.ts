// ============================================================================
//  Supabase Edge Function: notify-acceptance  (multi-tenant)
//  Emails the STUDIO THAT OWNS the proposal when a client accepts it online.
//  Triggered by a trigger/webhook on UPDATE of public.public_proposals.
//
//  How the recipient is chosen (per studio, not a fixed address):
//    1. Read record.studio_id from the accepted row.
//    2. Look up that studio (name + notify_email) via the service-role key.
//    3. Email notify_email, from the platform sender, with the studio's name.
//  Falls back to the NOTIFY_EMAIL secret only if the studio has no email set.
//
//  Secrets: RESEND_API_KEY (required), FROM_EMAIL (a verified sender on the
//  platform domain; defaults to Resend's onboarding address for testing),
//  NOTIFY_EMAIL (optional fallback). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//  are injected automatically by Supabase.
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL")     ?? "onboarding@resend.dev";
const FALLBACK_EMAIL = Deno.env.get("NOTIFY_EMAIL")   ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")   ?? "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BIZ_KEY = "jlr4_biz";

// The studio's currency/tax settings live in its saved business settings (studio_state jlr4_biz),
// so the alert email shows the right symbol + tax label (£/VAT, $/GST, etc.) per studio.
async function getBiz(studioId: string): Promise<any> {
  if (!studioId || !SUPABASE_URL || !SERVICE_KEY) return {};
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/studio_state?studio_id=eq.${studioId}&key=eq.${BIZ_KEY}&select=value`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!r.ok) return {};
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0]?.value) || {};
  } catch { return {}; }
}

async function getStudio(studioId: string): Promise<{ name?: string; notify_email?: string } | null> {
  if (!studioId || !SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/studios?id=eq.${studioId}&select=name,notify_email`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    // Trigger / Database Webhook send { type, table, record, old_record, schema }
    const record = body.record ?? body.new ?? {};
    const old    = body.old_record ?? body.old ?? {};

    // Only fire on the transition INTO 'accepted' (avoids duplicate emails).
    if (record.status !== "accepted" || old.status === "accepted") {
      return new Response("ignored (not a new acceptance)", { status: 200 });
    }
    if (!RESEND_API_KEY) {
      return new Response("missing RESEND_API_KEY secret", { status: 500 });
    }

    // Which studio owns this proposal → who to notify.
    const studio = await getStudio(record.studio_id);
    const studioName = (studio?.name || "Your studio").trim();
    const to = (studio?.notify_email || FALLBACK_EMAIL || "").trim();
    if (!to) {
      // Nobody to notify (studio hasn't set an alert email and no fallback). Not an error.
      return new Response("no recipient for studio " + (record.studio_id ?? "?"), { status: 200 });
    }

    const biz = await getBiz(record.studio_id);
    const sym = biz.currencySymbol || "$";
    const taxLabel = biz.taxLabel || "GST";
    const locale = biz.locale || "en-AU";
    const money = (n: number) => sym + Math.round(n).toLocaleString(locale);

    const data = record.data ?? {};
    const opt  = (data.options ?? []).find((o: any) => o.id === record.accepted_option);
    const price = opt && opt.price != null ? `${money(opt.price)} inc ${taxLabel}` : "—";
    const subject = `✅ Proposal accepted — ${data.clientName || "Client"} (${data.jobType || "job"})`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0A0A0A;max-width:520px">
        <h2 style="margin:0 0 8px">Proposal accepted 🎉</h2>
        <p style="margin:0 0 16px;color:#555"><strong>${record.accepted_name || "A client"}</strong> just accepted a proposal online.</p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 14px 4px 0;color:#888">Client</td><td><strong>${data.clientName || "—"}</strong></td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#888">Piece</td><td>${data.jobType || "—"}</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#888">Option chosen</td><td>${opt ? opt.label : (record.accepted_option || "—")}</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#888">Price</td><td><strong>${price}</strong></td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#888">Accepted by</td><td>${record.accepted_name || "—"}</td></tr>
        </table>
        <p style="margin:18px 0 0;color:#888;font-size:12px">Open your ${studioName} CRM to review and arrange the deposit.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${studioName} <${FROM_EMAIL}>`, to: [to], subject, html }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response("email send failed: " + t, { status: 500 });
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response("error: " + (e?.message ?? String(e)), { status: 500 });
  }
});
