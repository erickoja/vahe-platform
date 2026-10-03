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


// "Verify JWT" alone is NOT enough: the public anon key is itself a valid JWT, so anyone holding the
// app's anon key would pass it. Require a real signed-in USER (the token must resolve to a user).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
async function signedInUser(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearers+/i, "");
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) return false;
    const u = await r.json();
    return !!u?.id;
  } catch { return false; }
}

const EMAIL_RE = /^[^s@<>"]+@[^s@<>"]+.[^s@<>"]+$/;
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
  if (!(await signedInUser(req))) return json({ error: "not signed in" }, 401);
  try {
    const { to, cc, replyTo, fromName, subject, html, attachments } = await req.json();
    if (!RESEND_API_KEY)        return json({ error: "missing RESEND_API_KEY secret" }, 500);
    if (!to || !subject || !html) return json({ error: "to, subject and html are required" }, 400);
    if (!EMAIL_RE.test(String(to)) || (cc && !EMAIL_RE.test(String(cc))) || (replyTo && !EMAIL_RE.test(String(replyTo)))) return json({ error: "invalid email address" }, 400);
    if (String(html).length > 2_000_000 || String(subject).length > 300) return json({ error: "message too large" }, 413);

    const display = String(fromName || "Your jeweller").replace(/[<>\r\n]/g, "").trim() || "Your jeweller";
    const payload: Record<string, unknown> = { from: `${display} <${FROM_EMAIL}>`, to: [to], subject, html };
    if (cc)      payload.cc = [cc];
    if (replyTo) payload.reply_to = replyTo;
    // Optional attachments: [{ filename, content (base64, no data: prefix), content_id? }].
    // A content_id lets the HTML embed the image inline via <img src="cid:that-id">.
    if (Array.isArray(attachments) && attachments.length) {
      payload.attachments = attachments
        .filter((a: Record<string, unknown>) => a && a.filename && a.content)
        .map((a: Record<string, unknown>) => {
          const att: Record<string, unknown> = { filename: a.filename, content: a.content };
          if (a.content_id) att.content_id = a.content_id;
          return att;
        });
    }

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
