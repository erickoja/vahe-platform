// ============================================================================
//  Supabase Edge Function: send-email
//  Sends a client-facing email (proposal / invoice / repair link) via Resend,
//  on demand from the app (supabase.functions.invoke). White-label: the "from"
//  shows the studio's name, replies go to the studio's own address.
//  Called from the browser → needs CORS + verify_jwt so only signed-in studio
//  users can send.
//  Secrets (already set on the project): RESEND_API_KEY, FROM_EMAIL.
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL")     ?? "onboarding@resend.dev";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")   return json({ error: "POST only" }, 405);
  try {
    const { to, cc, replyTo, fromName, subject, html } = await req.json();
    if (!RESEND_API_KEY)        return json({ error: "missing RESEND_API_KEY secret" }, 500);
    if (!to || !subject || !html) return json({ error: "to, subject and html are required" }, 400);

    const display = String(fromName || "Your jeweller").replace(/[<>\r\n]/g, "").trim() || "Your jeweller";
    const payload: Record<string, unknown> = { from: `${display} <${FROM_EMAIL}>`, to: [to], subject, html };
    if (cc)      payload.cc = [cc];
    if (replyTo) payload.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return json({ error: "email send failed: " + (await res.text()) }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
