# Xero integration — Phase 1 implementation plan

Push finalised Workshop Pilot invoices into each studio's own Xero organisation,
so they never re-key an invoice. Per studio, opt-in, no upfront cost (Xero
Starter tier is free up to 5 connected orgs, then A$35/mo up to 50).

This document is the build plan and the operator setup guide, in the same style
as `BILLING-SETUP.md` and `SETUP-EMAIL-NOTIFICATIONS.md`.

---

## 1. Scope

**In (Phase 1)**
- A studio connects its own Xero org from Settings (OAuth2, one click).
- "Send to Xero" on a finalised invoice creates a **Draft** sales invoice in that
  studio's Xero, with the client as a Contact, line items, GST and the invoice
  number carried across.
- Re-send updates the same Xero draft instead of duplicating it.
- Connection status shown in Settings; Disconnect button.
- Per-studio mapping: default **sales account code** and **GST tax type**.

**Out (later phases)**
- Pulling payments back from Xero, pushing as Approved/Authorised, credit notes,
  void/delete sync, and App Store certification (needed only past 25 connected
  orgs). None of these block launching Phase 1.

---

## 2. Architecture

Mirrors the billing function exactly:

- **All Xero secrets and tokens live server-side** in edge functions and a
  locked database table. The browser never sees a token.
- Two new edge functions, both `Deno.serve` + direct `fetch` to Xero's REST API,
  caller identified by JWT then mapped to their studio via `studio_members`
  (same pattern as `billing/index.ts`).
- Tokens stored in a new `xero_connections` table that has **RLS on and no client
  policies**, so only the service role (edge functions) can read/write it. The
  frontend learns connection status only through an edge-function call, never by
  reading the table.

```
Browser (Settings)                Edge functions (service role)         Xero
  Connect Xero  ───invoke───▶  xero-oauth  ?action=connect  ──▶  consent screen
  (opens popup)               (builds auth URL + state)
        ◀─────────────  redirect to xero-oauth ?action=callback ◀── code
                            (swaps code→tokens, stores row)
  Send to Xero  ───invoke───▶  xero-invoice                 ──▶  POST /Contacts
   on an invoice             (refresh token if stale,             POST /Invoices
                              map invoice→Xero, save id)
```

---

## 3. Xero developer app setup (one-time, by you)

1. Create an app at https://developer.xero.com/app/manage (type: **Auth Code**,
   i.e. a web app with a client secret).
2. Redirect URI (must match exactly):
   `https://<project-ref>.supabase.co/functions/v1/xero-oauth`
   (the callback is handled by the edge function; it closes the popup and posts
   back to the app).
3. Scopes: `openid profile email accounting.transactions accounting.contacts offline_access`.
   `offline_access` is required to receive a **refresh token**.
4. Copy the **Client ID** and **Client Secret** into Supabase function secrets
   (below). Use the customer SaaS project (`ietkgxvmxzeqjhxmdddx`), not the
   owner's studio project.

### Function secrets (Supabase → Edge Functions → Secrets)
```
XERO_CLIENT_ID
XERO_CLIENT_SECRET
XERO_REDIRECT_URI      = https://<project-ref>.supabase.co/functions/v1/xero-oauth
APP_URL                = https://app.workshoppilot.app
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected, as in billing.
```

---

## 4. Database

New table plus two small columns. Delivered as `supabase/xero-setup.sql`, run once
in the SQL editor (same flow as the other `.sql` files here).

```sql
create table if not exists xero_connections (
  studio_id     uuid primary key references studios(id) on delete cascade,
  tenant_id     text not null,          -- the connected Xero org id
  tenant_name   text,                   -- shown in Settings
  access_token  text not null,
  refresh_token text not null,          -- rotates on every refresh; always re-store it
  expires_at    timestamptz not null,   -- access token expiry (~30 min)
  account_code  text,                   -- default sales account (e.g. "200")
  tax_type      text,                   -- default GST type (e.g. "OUTPUT")
  connected_by  uuid references auth.users(id),
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS ON, NO client policies: only the service role (edge functions) touches this.
alter table xero_connections enable row level security;
```

The Xero ids we write **back** onto existing records live in the per-studio
`studio_state` JSON, so no schema change there:
- each invoice gains `xeroInvoiceId` + `xeroStatus` after a successful push
  (used to update instead of duplicate);
- each client gains `xeroContactId` after first push (reused so Xero doesn't
  create duplicate contacts).

---

## 5. Edge function: `xero-oauth`

`POST { action }` with the caller's JWT (invoked from the app), plus a `GET`
callback that Xero redirects to.

- **`action: "connect"`** → resolve caller's `studio_id`, build the Xero authorize
  URL with `client_id`, `redirect_uri`, the scope list, `response_type=code`, and
  a signed `state` that encodes the studio id (HMAC with the service key, to stop
  a forged callback binding a token to the wrong studio). Return the URL; the app
  opens it in a popup.
- **`GET ?code&state` (callback)** → verify `state`, exchange the code at
  `https://identity.xero.com/connect/token` for access + refresh tokens, call
  `GET https://api.xero.com/connections` to get the `tenantId`/tenant name, and
  `upsert` the `xero_connections` row. Respond with a tiny HTML page that
  `window.close()`s the popup and signals the opener to refresh status.
- **`action: "status"`** → return `{ connected, tenantName, accountCode, taxType }`
  for the caller's studio (never the tokens).
- **`action: "disconnect"`** → delete the row (optionally call Xero's revoke
  endpoint).
- **`action: "setMapping", accountCode, taxType`** → save the two mapping fields.

**Token refresh helper (shared):** before any Xero call, if `expires_at` is within
~60s, POST to the token endpoint with `grant_type=refresh_token`, then store the
**new** access AND refresh tokens (Xero rotates the refresh token every time).

---

## 6. Edge function: `xero-invoice`

`POST { invoice, client }` with the caller's JWT. (The app sends the already-built
invoice + client objects; the function does not need DB read access to them.)

1. Resolve studio, load `xero_connections`, refresh token if stale. If no
   connection, return a clear "Xero not connected" error.
2. **Contact:** if `client.xeroContactId` present, use it; else
   `POST /api.xero.com/api.xro/2.0/Contacts` with Name, EmailAddress, phone,
   address. Return the new `ContactID` to the app to store on the client.
3. **Invoice:** `POST /Invoices` (or update if `invoice.xeroInvoiceId` exists and
   is still DRAFT) with:
   - `Type: "ACCREC"` (accounts receivable / sales)
   - `Contact: { ContactID }`
   - `Date`, `DueDate`
   - `InvoiceNumber: invoice.number` (their editable number carries across; if
     Xero rejects a duplicate number, fall back to letting Xero auto-number and
     put ours in `Reference`)
   - `Reference`: job type / quote ref
   - `LineAmountTypes: "Inclusive"` (Workshop Pilot totals are GST-inclusive, so
     Xero back-computes the GST, no rounding drift)
   - `LineItems[]`: one per `invoice.lineItems` entry → `Description`,
     `Quantity: 1`, `UnitAmount` (inc-GST line value), `AccountCode` (mapping),
     `TaxType` (mapping). A gold trade-in is added as a **negative line**
     ("Gold trade-in credit", `UnitAmount: -tradeInCredit`) so the Xero total
     matches the Workshop Pilot balance. (Trade-in tax treatment is flagged for
     the studio's accountant; the tax type is configurable.)
   - `Status: "DRAFT"` for Phase 1.
4. Return `{ xeroInvoiceId, xeroStatus, contactId }`; the app writes these onto
   the invoice/client so the next send updates rather than duplicates.

Rate limit is 60 calls/min per org, so this fires only on an explicit "Send to
Xero", never in a loop.

---

## 7. Frontend (in `src/App.jsx`, Settings + invoice detail)

- **Settings → new "Xero" card:** calls `xero-oauth status` on load. Shows either
  "Connect to Xero" (opens the popup) or "Connected to *Tenant name*" with a
  Disconnect button and two selects for **default account code** and **GST tax
  type** (saved via `setMapping`). Model on the existing billing/settings cards.
- **Invoice detail → "Send to Xero" button** (next to the existing actions):
  disabled with a hint if Xero isn't connected; on click invokes `xero-invoice`,
  then stores `xeroInvoiceId`/`xeroStatus` on the invoice (via the normal
  `persist`), and flashes feedback in the same "✓ Sent to Xero / ✓ Updated in
  Xero" style we just used for Update-from-quote. Once sent, the button reads
  "Update in Xero" and links out to the draft in Xero.

No new frontend dependency: everything goes through `supabase.functions.invoke`,
exactly like `billing` and `metal-prices`.

---

## 8. Security and correctness notes

- Tokens are **never** exposed to the browser or stored in `studio_state`
  (which is client-readable under RLS). They live only in `xero_connections`,
  which no client policy can read.
- The OAuth `state` is signed so a callback can't bind a Xero org to a studio
  that didn't initiate the connect.
- Always persist the rotated refresh token after a refresh, or the connection
  silently dies after ~60 days.
- Idempotency via `xeroInvoiceId` prevents duplicate invoices; if the Xero draft
  has since been Approved/paid, we don't overwrite it and tell the user instead.

---

## 9. Testing

- Xero gives every developer a free **Demo Company** org to connect against.
- Test: connect → send a Workshop Pilot invoice → confirm the draft in Xero
  matches (contact, lines, GST-inclusive total, invoice number) → edit the quote,
  re-sync the invoice, re-send → confirm it updated the same draft, not a new one
  → disconnect → confirm "Send to Xero" is disabled again.

---

## 10. Build sequence and estimate

1. Xero app + secrets + `xero-setup.sql` (0.5 day)
2. `xero-oauth` function: connect / callback / status / disconnect / mapping,
   plus the shared refresh helper (1 day)
3. `xero-invoice` function: contact + invoice mapping, idempotent update (1 day)
4. Frontend: Settings Xero card + invoice "Send to Xero" button (1 day)
5. End-to-end testing against the Demo Company, GST reconciliation (0.5 day)

Roughly **4 days** of focused work for a working, launchable Phase 1 that runs on
the free Xero tier. Certification (to pass 25 connected orgs) is a separate,
later step and needs real customer adoption first, so it does not gate launch.
