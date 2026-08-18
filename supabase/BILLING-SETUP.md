# Turning on subscription billing (Stripe)

Set this up on the **customer-facing / SaaS** stack only:
- Supabase project: `ietkgxvmxzeqjhxmdddx`
- Vercel deploy: `app.workshoppilot.app`

**Never enable billing on the live business app** (`ipbillmpehwgnlayyziz` / `vahe-platform.vercel.app`)
— you'd put your own workshop behind a paywall. Billing stays OFF there.

Do everything in **Stripe TEST mode first**, verify end-to-end, then repeat with live keys.

Model (already built in the app): monthly + annual plans, 14-day trial, read-only when lapsed.

---

## 1. Stripe (Test mode)
1. Create/log into Stripe. Toggle **Test mode** (top right).
2. **Products → + Add product** → "Workshop Pilot". Add two **recurring** prices:
   - Monthly (e.g. $X/month) → copy its **Price ID** (`price_…`)
   - Yearly (e.g. $Y/year) → copy its **Price ID** (`price_…`)
3. **Developers → API keys** → copy the **Secret key** (`sk_test_…`). Keep it safe — it only goes into Supabase secrets (never into the app or chat).

## 2. Supabase (customer project `ietkgxvmxzeqjhxmdddx`)
4. **SQL Editor** → run `supabase/billing-setup.sql`.
5. **Edge Functions** → deploy both (code in `supabase/functions/`):
   - `billing`  — the app calls it as **`billing`**, so the deployed **slug must be `billing`**. Prefer the CLI (`supabase functions deploy billing`) which preserves the name; if you use the dashboard editor and it renames the slug, tell Claude the real slug so the app's `invoke("billing")` can be updated.
   - `stripe-webhook` — set **Verify JWT = OFF** (Stripe calls it with no user token).
6. **Edge Functions → Secrets** → add:
   - `STRIPE_SECRET_KEY` = `sk_test_…`
   - `STRIPE_PRICE_MONTHLY` = monthly `price_…`
   - `STRIPE_PRICE_ANNUAL` = yearly `price_…`
   - (`STRIPE_WEBHOOK_SECRET` added in step 8)

## 3. Webhook
7. Copy the `stripe-webhook` function URL (`https://ietkgxvmxzeqjhxmdddx.functions.supabase.co/stripe-webhook`).
8. Stripe **Developers → Webhooks → + Add endpoint** → paste the URL → select events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`.
   Copy the endpoint **Signing secret** (`whsec_…`) → add Supabase secret `STRIPE_WEBHOOK_SECRET`.

## 4. Turn it on
9. Vercel (customer project) → env `VITE_BILLING_ENABLED=true` → redeploy with **build cache OFF**.

## 5. Test
10. Sign up a fresh test studio → expect the trial banner + a **Subscription** card in Settings.
11. **Subscribe monthly** → Stripe Checkout → pay with test card `4242 4242 4242 4242`, any future expiry / any CVC / any postcode.
12. Back in the app: status shows **Active**; Stripe → Webhooks shows **200s**; **Manage billing** opens the portal.
13. Lapse test: cancel the test subscription in Stripe → app flips to the **read-only** banner; add/edit shows the subscribe prompt.

## Go live
Repeat steps 1–3 & 6–8 with **live** keys, live price IDs, and a live webhook endpoint/secret. Keep the business app untouched.

## Secrets reference
| Secret | Where | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | Supabase fn secrets | `sk_test_…` then `sk_live_…` |
| `STRIPE_PRICE_MONTHLY` | Supabase fn secrets | monthly `price_…` |
| `STRIPE_PRICE_ANNUAL` | Supabase fn secrets | yearly `price_…` |
| `STRIPE_WEBHOOK_SECRET` | Supabase fn secrets | `whsec_…` |
| `VITE_BILLING_ENABLED` | Vercel (customer deploy) | `true` |
