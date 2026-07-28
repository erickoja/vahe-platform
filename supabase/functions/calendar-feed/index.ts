// ============================================================================
//  Supabase Edge Function: calendar-feed
//  Serves a studio's appointments as an iCalendar (.ics) subscription feed, so
//  a jeweller can add ONE private URL to Google / Apple / Outlook and have all
//  appointments appear and auto-update.
//
//  Public (no auth) — calendar apps fetch it unauthenticated, so DEPLOY WITH
//  "Verify JWT" OFF. The secret is the ?token= (a random per-studio token
//  stored in the studio's saved business settings: biz.calendarToken).
//
//  URL:  /functions/v1/<slug>?token=<calendarToken>
//  Injected env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BIZ_KEY = "jlr4_biz", APPT_KEY = "jlr4_appointments", CL_KEY = "jlr4_clients";

const esc = (s: unknown) => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const p2 = (n: number) => String(n).padStart(2, "0");

async function sget(query: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  return r.ok ? await r.json() : null;
}

function vevent(a: any, nameOf: (a: any) => string): string {
  const title = `${a.type || "Appointment"}${nameOf(a) ? " — " + nameOf(a) : ""}`;
  let dtStart: string, dtEnd: string;
  if (a.time) {
    const d = String(a.date).replace(/-/g, "");
    const [hh, mm] = String(a.time).split(":");
    let eh = parseInt(hh, 10) + 1, ed = d;
    if (eh >= 24) { eh -= 24; const nd = new Date(`${a.date}T00:00:00Z`); nd.setUTCDate(nd.getUTCDate() + 1); ed = `${nd.getUTCFullYear()}${p2(nd.getUTCMonth() + 1)}${p2(nd.getUTCDate())}`; }
    dtStart = `DTSTART:${d}T${hh}${mm}00`;
    dtEnd = `DTEND:${ed}T${p2(eh)}${mm}00`;
  } else {
    const d0 = String(a.date).replace(/-/g, "");
    const nd = new Date(`${a.date}T00:00:00Z`); nd.setUTCDate(nd.getUTCDate() + 1);
    dtStart = `DTSTART;VALUE=DATE:${d0}`;
    dtEnd = `DTEND;VALUE=DATE:${nd.getUTCFullYear()}${p2(nd.getUTCMonth() + 1)}${p2(nd.getUTCDate())}`;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return ["BEGIN:VEVENT", `UID:${a.id || Math.random().toString(36).slice(2)}@prongstudio.app`, `DTSTAMP:${stamp}`, dtStart, dtEnd, `SUMMARY:${esc(title)}`, ...(a.notes ? [`DESCRIPTION:${esc(a.notes)}`] : []), "END:VEVENT"].join("\r\n");
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("missing token", { status: 400 });
  try {
    const bizRows = await sget(`studio_state?key=eq.${BIZ_KEY}&value->>calendarToken=eq.${encodeURIComponent(token)}&select=studio_id`);
    const studioId = Array.isArray(bizRows) && bizRows.length ? bizRows[0].studio_id : null;
    if (!studioId) return new Response("not found", { status: 404 });

    const [apRows, clRows] = await Promise.all([
      sget(`studio_state?studio_id=eq.${studioId}&key=eq.${APPT_KEY}&select=value`),
      sget(`studio_state?studio_id=eq.${studioId}&key=eq.${CL_KEY}&select=value`),
    ]);
    const appts = (Array.isArray(apRows) && apRows[0]?.value) || [];
    const clients = (Array.isArray(clRows) && clRows[0]?.value) || [];
    const cmap: Record<string, string> = {};
    for (const c of clients) cmap[c.id] = c.name || "";
    const nameOf = (a: any) => (a.clientName || cmap[a.clientId] || "").trim();

    const events = appts
      .filter((a: any) => a && a.date && a.status !== "Cancelled")
      .map((a: any) => vevent(a, nameOf));

    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Prong Studio//Appointments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Prong Studio — Appointments", ...events, "END:VCALENDAR"].join("\r\n");

    return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return new Response("error: " + ((e as Error)?.message ?? e), { status: 500 });
  }
});
