# Environments — which database is which

This codebase (one GitHub repo, `erickoja/vahe-platform`) powers **two separate live apps**. Same code, different database, chosen entirely by the `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars set on each Vercel deployment — there are **no project references hardcoded in the code** (see `src/supabaseClient.js`).

| App | URL | Supabase project (ref) | What's in it |
|---|---|---|---|
| **Owner's own studio** | https://vahe-platform.vercel.app | `ipbillmpehwgnlayyziz` | The owner's real jewellery business — clients, jobs, quotes, invoices, photos. Private, single-user. |
| **Customer SaaS** | https://app.workshoppilot.app | `ietkgxvmxzeqjhxmdddx` | The multi-tenant product other jewellers sign up for. Separate DB so customers never touch the owner's data. Billing (Stripe) lives here. |

Both auto-deploy from `main`: **edit code → commit → `git push origin main` → Vercel rebuilds and deploys within a minute or two.** There is no separate deploy step.

## No local sandbox

There used to be a third **DEV / localhost** Supabase project (`khpykxoshyljqkauvdfn`), read from a gitignored `.env.local`, so `npm run dev` on `localhost:5174` ran against throwaway data. **That project was deleted on 10 Aug 2026** to stay within Supabase's free project limit, and `.env.local` was removed.

Consequences:

- `npm run dev` still launches, but with no Supabase credentials it falls back to **local-only browser storage** (`supabaseEnabled === false`) — no shared database.
- There is **no isolated environment to test against real-shaped data**. Changes are validated on the live sites after pushing. For anything risky, use a **git branch + Vercel preview deployment** rather than pushing straight to `main`, so the live sites stay untouched until the change is confirmed.
- To bring back a local sandbox later you'd create a fresh Supabase project and add a new gitignored `.env.local` pointing at it.

## How each live app is configured

Each Vercel project stores its own `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables (Production scope)**. The refs are **not** stored in this repo. To re-confirm which project a live app uses, read it straight from the deployed bundle:

```bash
# find the JS file, then extract the Supabase URL baked in at build time
js=$(curl -s https://vahe-platform.vercel.app/ | grep -oE '/assets/[^"]+\.js' | head -1)
curl -s "https://vahe-platform.vercel.app$js" | grep -oE 'https://[a-z0-9]+\.supabase\.co' | sort -u
```

## ⚠️ Before deleting any Supabase project

Only these two projects are in use — **never delete either:**

- `ipbillmpehwgnlayyziz` — owner's studio (vahe-platform.vercel.app). **Never delete.**
- `ietkgxvmxzeqjhxmdddx` — customer SaaS (app.workshoppilot.app). **Never delete.**

Always confirm a project's **Reference ID** (Project Settings → General) and check its Table Editor / Storage before removing anything. Deleting the wrong project means permanent loss of live data.
