# VAHE multi-tenancy — Phase 1 runbook

Goal: isolate each jeweller's data so VAHE can be sold as a subscription. This
phase delivers **data isolation + RLS + migrating your existing data**. Signup
and Stripe billing are separate later phases.

**Golden rule:** do everything on **staging** first. Prod is only touched at the
final coordinated cutover (step 6), and DB migration + code deploy go live
together within the same short window.

---

## Why this is needed (one line)

`studio_state` is keyed only on `key`, so every logged-in user shares one
dataset. A second jeweller would see/overwrite your data. We add `studio_id` +
RLS so each studio's rows are physically isolated.

---

## The moving parts

| Piece | Change |
|---|---|
| DB schema | new `studios`, `studio_members`; `studio_state` gains `studio_id`, PK becomes `(studio_id, key)` |
| Security | RLS on all three tables; `auth_studio_ids()` helper |
| App code | resolve the user's studio at login → scope every read/write/realtime call |
| Images | new uploads under `${studioId}/…`; existing objects moved once; storage RLS |
| Your data | backfilled into a "VAHE Jewellery" studio (migration does this) |

SQL for the first three lives in
[`supabase/migrations/20260707_multitenancy.sql`](supabase/migrations/20260707_multitenancy.sql).

---

## Step-by-step

### 1. Create a staging Supabase project
- Supabase dashboard → **New project** (free tier is fine) → name it `vahe-staging`.
- (Optional but ideal) copy your prod data into it so you test against realistic
  data: prod project → **Database → Backups**, or `pg_dump` the prod DB and
  restore into staging. If that's fiddly, testing with a couple of hand-made
  records is enough to prove isolation.
- Note staging's **Project URL** and **anon key** (Settings → API).

### 2. Run the migration on staging
- Staging → **SQL Editor** → paste the whole migration file → **Run**.
- Confirm it completes with no errors. It will:
  create the tables, add `studio_id`, create a `VAHE Jewellery` studio, link all
  existing staging users to it, backfill all rows, swap the PK, enable RLS.

### 3. Point local dev at staging (you do this — I won't touch env files)
- In `vahe-platform/.env.local`, temporarily set
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to the **staging** values.
- Keep your prod values saved somewhere so you can switch back for step 6.

### 4. I apply the app-code changes (branch `multi-tenancy`)
The exact diffs are in [§ Code changes](#code-changes) below. I'll make them on a
git branch so your `main`/prod stays clean. You run `npm run dev` against staging
and we test.

### 5. Verify isolation on staging (the acceptance test)
- Create a **second** Supabase user in staging (Authentication → Users → Add).
- Give them their own studio: in SQL Editor run
  `select create_studio_for_current_user('Test Studio 2');` **while logged in as
  that user** — or insert a `studios` + `studio_members` row for them manually.
- Log in as user 1 → add a client "ALPHA". Log in as user 2 → confirm you see
  **none** of user 1's data, add a client "BETA". Back to user 1 → you see ALPHA,
  not BETA. That's isolation proven.
- Bonus check (RLS, not just app): in the SQL editor's "run as authenticated
  user" mode (or via the API with user 2's token), `select * from studio_state`
  returns only user 2's rows.

### 6. Cutover to prod (coordinated — do in a quiet window)
Old prod code writes `{key,value}` with `onConflict:"key"`, which **fails** once
the PK requires a non-null `studio_id`. So migration and deploy must go together:
1. Point `.env.local` back to **prod** values (undo step 3).
2. Run the migration on the **prod** Supabase project (SQL Editor).
3. Immediately merge `multi-tenancy` → `main` and push (Vercel auto-deploys).
   - Reads keep working in the brief gap; only writes are affected until the
     deploy lands, so keep the gap to a couple of minutes.
4. Log in on the live app, confirm your data is all there and saves work.

### 7. Images fast-follow (same phase, right after step 6)
Existing photos live at `${jobId}/…` with no studio prefix, so turning on strict
storage RLS *before* moving them would lock you out of your own images.
- New uploads already write `${studioId}/${jobId}/…` (code change below).
- Run the one-off move script (I'll provide `scripts/migrate-image-paths.mjs`)
  to copy existing objects under your studio prefix.
- Then enable the storage-bucket RLS policies (SQL provided at cutover).
Until then images stay private + signed-URL only and the app only ever mints
URLs for the current studio, so there's no listing exposure.

---

## Code changes

All in `src/App.jsx`. Small, surgical — they thread a `studioId` through the
existing cloud helpers.

**a) New module-level studio id (next to `_cloudActive` / `_cloudLoaded`, ~line 1003):**
```js
let _studioId = null;
const setStudioIdModule = (v) => { _studioId = v; };
```

**b) Scope the reads (`_cloudGet` ~1015 and `_storeGet` ~1038):**
```js
supabase.from(STATE_TABLE).select("value")
  .eq("studio_id", _studioId).eq("key", k).maybeSingle();
```

**c) Scope the writes and refuse to write without a studio (`persist` ~1048):**
```js
if (_cloudActive && supabase) {
  if (!_cloudLoaded) { /* existing guard */ return; }
  if (!_studioId)    { console.warn("No studio — skip cloud save", k); return; }
  const ts = new Date().toISOString();
  _lastWriteAt[k] = ts;
  supabase.from(STATE_TABLE)
    .upsert({ studio_id:_studioId, key:k, value:v, updated_at:ts },
            { onConflict:"studio_id,key" })
    .then(({error}) => { if (error) console.warn("Cloud save failed", k, error.message); });
}
```

**d) Namespace the local fallback so two studios on one browser can't bleed
(`_localGet`/`_localSet`):** prefix the key with `${_studioId||'anon'}:`.

**e) Resolve the studio at login (auth effect ~7119) + a `studioId` state:**
```js
const [studioId, setStudioId] = useState(null);
// after we have a session/userId:
const { data: mem } = await supabase.from("studio_members")
  .select("studio_id").eq("user_id", userId).maybeSingle();
if (mem) { setStudioIdModule(mem.studio_id); setStudioId(mem.studio_id); }
else     { setStudioId("none"); }   // → show onboarding (phase 2); for now: no studio
```

**f) Gate data-load on the studio (load effect ~7143):**
```js
if (supabaseEnabled && !userId) return;
if (supabaseEnabled && !studioId) return;      // NEW
// ...and add studioId to the effect's dependency array
```

**g) Scope realtime (channel subscribe ~7222):**
```js
.on("postgres_changes",
    { event:"*", schema:"public", table:STATE_TABLE, filter:`studio_id=eq.${_studioId}` },
    ...)
```

**h) Per-studio image paths (`uploadJobImage` ~1109):**
```js
const path = `${_studioId}/${jobId}/${uid()}.jpg`;
```

---

## Risks already handled
- **RLS recursion** → `auth_studio_ids()` is `security definer`.
- **New-user chicken-and-egg** → `create_studio_for_current_user()` RPC (phase 2).
- **Seed-overwrite** → existing `_cloudLoaded` guard kept; writes now also require `_studioId`.
- **Prod write gap at cutover** → migration + deploy done back-to-back in a quiet window.
- **Image lockout** → move objects before enabling storage RLS.

---

## What I need from you to start step 4
1. Confirm staging exists and the migration ran clean (steps 1–2).
2. Confirm you've pointed `.env.local` at staging (step 3).
Then say go, and I'll make the `multi-tenancy` branch code changes for testing.
