# Email notifications when a client accepts a proposal

The app already shows an in-app alert + pop-up when a client accepts an online
proposal (no setup needed). This guide adds an **email** so you're notified even
when the CRM is closed.

It works like this: when a proposal is accepted, Supabase runs a small **Edge
Function** that sends you an email via **Resend** (a free email service).

You only need to do this once. ~15–20 minutes.

---

## 1. Get a Resend API key

1. Sign up free at https://resend.com.
2. **API Keys** → **Create API Key** → copy it (starts with `re_…`).
3. *(Recommended)* **Domains** → add and verify your domain (e.g.
   `vahejewellery.com.au`) so emails can come **from** your own address and land
   in inboxes. For a quick test you can skip this — but unverified accounts can
   only email the address you signed up with, and only from `onboarding@resend.dev`.

## 2. Create the Edge Function

In the Supabase dashboard (project `taeyvvvadujooanrktkq`):

1. Go to **Edge Functions** → **Create a function**.
2. Name it exactly **`notify-acceptance`**.
3. Paste in the contents of
   [`supabase/functions/notify-acceptance/index.ts`](supabase/functions/notify-acceptance/index.ts).
4. **Deploy**.

> No dashboard editor? Install the Supabase CLI and run
> `supabase functions deploy notify-acceptance --project-ref taeyvvvadujooanrktkq`.

## 3. Add the function's secrets

**Edge Functions** → **Manage secrets** (or **Project Settings → Edge Functions →
Secrets**) → add three:

| Name             | Value                                                            |
|------------------|-----------------------------------------------------------------|
| `RESEND_API_KEY` | the `re_…` key from step 1                                       |
| `NOTIFY_EMAIL`   | where you want alerts sent, e.g. `contact@vahejewellery.com.au` |
| `FROM_EMAIL`     | a sender on your verified domain, e.g. `studio@vahejewellery.com.au` (or leave unset to use `onboarding@resend.dev` for testing) |

## 4. Fire the function when a proposal is accepted

**Database** → **Webhooks** → **Create a new hook**:

- **Name:** `proposal-accepted`
- **Table:** `public_proposals`
- **Events:** tick **Update** only
- **Type:** **Supabase Edge Functions** → choose **`notify-acceptance`**
- Method **POST**. Save.

The function ignores everything except the moment a proposal flips to
*accepted*, so you get exactly one email per acceptance.

## 5. Test

1. On a job, publish a proposal and open its link.
2. Accept it (pick an option, type a name).
3. Within a few seconds you should get an email at `NOTIFY_EMAIL`.

If nothing arrives: **Edge Functions → notify-acceptance → Logs** shows what
happened (a missing secret or an unverified Resend sender are the usual causes).

---

### Notes
- The in-app banner + pop-up keep working regardless of this email setup.
- The email contains the client, piece, chosen option, price and who accepted —
  no payment is taken (deposits are still arranged your usual way).
