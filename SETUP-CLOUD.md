# VAHÉ — Cloud setup (multi-user, shared data)

This guide turns the app from local-only into a shared, logged-in app that two
(or more) computers can use with the same data, syncing live.

You only need to do this once.

---

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free, no credit card).
2. Click **New project**. Give it a name (e.g. `vahe-studio`), set a strong
   database password (save it somewhere), pick the region closest to you.
3. Wait ~2 minutes for it to provision.

## 2. Create the data table

In the Supabase dashboard, open **SQL Editor** → **New query**, paste the
following, and click **Run**:

```sql
-- Shared key/value store for the whole studio
create table if not exists public.studio_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Turn on row-level security
alter table public.studio_state enable row level security;

-- Any logged-in user in this project can read and write the studio's data
create policy "authenticated read"  on public.studio_state for select using (auth.role() = 'authenticated');
create policy "authenticated write" on public.studio_state for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on public.studio_state for update using (auth.role() = 'authenticated');

-- Allow live sync (realtime) on this table
alter publication supabase_realtime add table public.studio_state;
```

## 3. Create your two user logins

1. In the dashboard go to **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Enter an email + password for the first staff member. Tick
   **Auto Confirm User** so they can log in immediately.
3. Repeat for the second user.

> You can add or remove users here any time. There's no public sign-up — only
> users you create here can log in.

## 4. Get your API keys

Go to **Project Settings** (gear icon) → **API**. Copy:

- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon public** key (a long string under "Project API keys")

These two values are safe to use in the app (the anon key is designed to be
public; security comes from the row-level rules above).

## 5. Connect the app

Create a file named `.env.local` in the project root (next to `package.json`)
with:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Then restart the dev server (`npm run dev`). You'll now get a login screen.

> Without `.env.local`, the app keeps working in local-only mode (no login),
> so development still works offline.

## 6. Deploy to a real URL (so both computers can reach it)

Recommended: **Vercel** (free).

1. Go to https://vercel.com, sign up with your GitHub account.
2. **Add New… → Project**, import `erickoja/vahe-platform`.
3. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
4. Under **Environment Variables**, add the same two values from step 5
   (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
5. **Deploy**. You'll get a URL like `https://vahe-platform.vercel.app`.

Both computers open that URL, log in with their own account, and see the same
live-synced data.

---

## Notes

- All data lives in the single `studio_state` table, shared by everyone who
  logs in — this is intentional (one studio, shared clients/jobs/quotes).
- A local copy is also kept in each browser, so the app stays responsive and
  survives brief network drops.
- If two people edit the *same* record at the same instant, the last save wins.
