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

// Minutes that `tz` is ahead of UTC at the given UTC instant (DST-aware, via Intl).
function tzOffsetMin(utcMillis: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMillis))) map[part.type] = part.value;
  const h = map.hour === "24" ? 0 : +map.hour; // some engines emit "24" for midnight
  const asIfUTC = Date.UTC(+map.year, +map.month - 1, +map.day, h, +map.minute, +map.second);
  return Math.round((asIfUTC - utcMillis) / 60000);
}

// Turn a studio wall-clock date+time (in tz) into a real UTC Date.
function zonedToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  const [h, m] = String(timeStr).split(":").map(Number);
  const guess = Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0);
  let utc = guess - tzOffsetMin(guess, tz) * 60000;
  // Re-resolve once so a DST-boundary guess lands on the correct offset.
  const refined = guess - tzOffsetMin(utc, tz) * 60000;
  if (refined !== utc) utc = refined;
  return new Date(utc);
}

const utcStamp = (d: Date) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

function vevent(a: any, nameOf: (a: any) => string, tz: string): string {
  const title = `${a.type || "Appointment"}${nameOf(a) ? " — " + nameOf(a) : ""}`;
  let dtStart: string, dtEnd: string;
  if (a.time) {
    const start = zonedToUtc(a.date, a.time, tz);
    const durMin = Number(a.durationMin) > 0 ? Number(a.durationMin) : 60;
    const end = new Date(start.getTime() + durMin * 60000);
    dtStart = `DTSTART:${utcStamp(start)}`;
    dtEnd = `DTEND:${utcStamp(end)}`;
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
    const bizRows = await sget(`studio_state?key=eq.${BIZ_KEY}&value->>calendarToken=eq.${encodeURIComponent(token)}&select=studio_id,value`);
    const bizRow = Array.isArray(bizRows) && bizRows.length ? bizRows[0] : null;
    const studioId = bizRow ? bizRow.studio_id : null;
    if (!studioId) return new Response("not found", { status: 404 });
    let tz = (bizRow?.value?.calendarTz || "Australia/Sydney") as string;
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { tz = "Australia/Sydney"; }

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
      .map((a: any) => vevent(a, nameOf, tz));

    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Prong Studio//Appointments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Prong Studio — Appointments", `X-WR-TIMEZONE:${tz}`, ...events, "END:VCALENDAR"].join("\r\n");

    return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return new Response("error: " + ((e as Error)?.message ?? e), { status: 500 });
  }
});
