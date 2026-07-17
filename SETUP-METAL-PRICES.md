# Live metal prices (metals.dev) — setup

The "Update spot prices" screen (Pricing DB → Update spot prices) has a **⟳ Fetch live prices**
button. It calls the `metal-prices` Supabase Edge Function, which fetches live AUD-per-gram spot
for fine gold, platinum and silver from [metals.dev](https://metals.dev). The API key lives in a
Supabase secret — it is never shipped to the browser.

The button only fills the three fields. You still review the numbers and press **Apply prices**,
which recalculates every Metals item in the Pricing DB by purity (spot × purity), same as before.

## One-time setup

You need the Supabase CLI logged in (`npx supabase login`) and your metals.dev API key.

Deploy the function and set the secret on **production** (`ipbillmpehwgnlayyziz`):

```bash
cd vahe-platform
npx supabase functions deploy metal-prices --project-ref ipbillmpehwgnlayyziz
npx supabase secrets set METALS_DEV_API_KEY=YOUR_KEY_HERE --project-ref ipbillmpehwgnlayyziz
```

To also test from localhost (which uses the **dev** project `khpykxoshyljqkauvdfn`):

```bash
npx supabase functions deploy metal-prices --project-ref khpykxoshyljqkauvdfn
npx supabase secrets set METALS_DEV_API_KEY=YOUR_KEY_HERE --project-ref khpykxoshyljqkauvdfn
```

(Or do both steps in the dashboard: Edge Functions → Deploy, and Settings → Edge Functions →
Secrets.)

## Quota notes

- metals.dev free plan allows ~100 requests/month. The app only calls the API when someone
  presses the button (JWT-verified — only logged-in studio members can call it), so normal use
  (a click every day or two) sits well inside the free tier.
- If this becomes a multi-tenant SaaS feature, add a small server-side cache (e.g. a
  `metal_prices_cache` table the function reads before hitting metals.dev) so one subscription
  serves every studio. The function is structured to make that a small change.

## Sanity guard

metals.dev is asked for `currency=AUD&unit=g`. If the API ever ignores the unit and returns
per-troy-ounce prices, the function detects it (AUD gold per gram is ~O(100), per ounce ~O(5000))
and converts to grams before responding.
