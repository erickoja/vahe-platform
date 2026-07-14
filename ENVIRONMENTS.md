# Environments — which database is which

This app runs against **two separate Supabase projects**, chosen automatically by *where the app is running*. This split was introduced with the multi-tenancy work (7 Jul 2026) so that development can't touch real customer data.

| Where it runs | Supabase project (ref) | What's in it |
|---|---|---|
| **Live site** — https://vahe-platform.vercel.app | **PRODUCTION** — `ipbillmpehwgnlayyziz` | Real clients, jobs, quotes, invoices, photos |
| **Localhost** — `npm run dev` (`localhost:5174`) | **DEV / sandbox** — `khpykxoshyljqkauvdfn` ("vahe-dev") | Test data only — safe to break |

### How each one is configured

- **Localhost** reads `.env.local` (gitignored), which points at the **dev** project.
- **The live site** reads its `VITE_SUPABASE_URL` from **Vercel → Project `vahe-platform` → Settings → Environment Variables** (Production scope). The production ref is **not** stored in this repo.

To re-confirm which project the live site uses, read it straight from the deployed bundle:

```bash
curl -s https://vahe-platform.vercel.app/ | grep -oE '/assets/[^"]+\.js'      # find the JS file
curl -s https://vahe-platform.vercel.app/assets/<that-file>.js | grep -oE 'https://[a-z0-9]+\.supabase\.co'
```

### ⚠️ Before deleting any Supabase project

There are (or were) **three** projects in the Supabase account. Only these two are in use:

- `ipbillmpehwgnlayyziz` — **PRODUCTION — never delete.**
- `khpykxoshyljqkauvdfn` — **dev** — deleting it only breaks local development, not the live site.

Any third project is a possible leftover, but **open its Table Editor and Storage and confirm they're empty before removing it.** Deleting the wrong project means permanent loss of live data.

### How changes reach the live site

Edit code → commit → `git push origin main`. **Vercel automatically rebuilds and deploys** the live site within a minute or two. There is no separate "deploy" step to run.
