// ============================================================================
//  Supabase Edge Function: notify-acceptance
//  Emails the studio when a client accepts an online proposal.
//  Triggered by a Database Webhook on UPDATE of public.public_proposals.
//  Secrets required (set in the dashboard): RESEND_API_KEY, NOTIFY_EMAIL,
//  and optionally FROM_EMAIL (a verified Resend sender; defaults to Resend's
//  onboarding address for testing). See SETUP-EMAIL-NOTIFICATIONS.md.
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_EMAIL   = Deno.env.get("NOTIFY_EMAIL")   ?? "";
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL")     ?? "onboarding@resend.dev";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    // Database Webhooks send { type, table, record, old_record, schema }
    const record = body.record ?? body.new ?? {};
    const old    = body.old_record ?? body.old ?? {};

    // Only fire on the transition INTO 'accepted' (avoids duplicate emails).
    if (record.status !== "accepted" || old.status === "accepted") {
      return new Response("ignored (not a new acceptance)", { status: 200 });
    }
    if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
      return new Response("missing RESEND_API_KEY or NOTIFY_EMAIL secret", { status: 500 });
    }

    const data = record.data ?? {};
    const opt  = (data.options ?? []).find((o: any) => o.id === record.accepted_option);
    const price = opt && opt.price != null ? `${money(opt.price)} inc GST` : "—";
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
        <p style="margin:18px 0 0;color:#888;font-size:12px">Open the VAHÉ CRM to review and arrange the deposit.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `VAHÉ <${FROM_EMAIL}>`, to: [NOTIFY_EMAIL], subject, html }),
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
