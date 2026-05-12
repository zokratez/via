# PACO Peptide — Reverse-Trial Paywall Smoke Test Plan

**Target branch:** main · **Tip after build:** 4e4bd70
**Commits under test:** A (d7147ee) · C (9c8be9d) · D (159541e) · E (1f24142) · F (118a373) · G (4e4bd70)

This is the incognito test plan Sam runs after Vercel deploys the
above commits to production. It assumes prerequisites in section 0
are complete. Test cards only until section 8 ("go live test")
explicitly approved.

The goal is not "happy path" coverage — it's deliberately exercising
the race windows, the redirect loops, and the documented Audit Q14
applyToProfile flaw so we know what we're shipping.

---

## 0. Prerequisites — must be true before any test runs

Run through these in order. If any fail, **stop**, fix, then restart
from the top.

| Check | How | Pass criterion |
|---|---|---|
| Migration 0004 applied to Supabase prod | Supabase SQL editor: `select pg_get_constraintdef(c.oid) from pg_constraint c where c.conname = 'profiles_subscription_tier_chk';` | Returns a row with the CHECK definition listing all four legal tiers. **If empty: run the migration before proceeding.** |
| Vercel env `STRIPE_PRICE_ID_VIA_PRO` is live monthly | Vercel dashboard → env vars → Production scope | Value starts with `price_` and matches the **live** $9.99/mo price in Stripe Dashboard. **Sam confirmed: YES (corrected from sk_live_… bug).** |
| Vercel env `STRIPE_PRICE_ID_VIA_PRO_ANNUAL` is set | Same | Value = `price_1TW0RjC0ioyOCtQFITaFq8wX` (live annual $79/yr). |
| Vercel env `STRIPE_SECRET_KEY` is live key | Same | Starts with `sk_live_`. |
| Vercel env `STRIPE_WEBHOOK_SECRET` is live | Same | Starts with `whsec_`. |
| Webhook endpoint registered in Stripe | Stripe Dashboard → Developers → Webhooks → find `we_1TUgE1C0ioyOCtQFa0z7yX7O` | URL = `https://www.pacopeptide.com/api/stripe/webhook`. **Sam confirmed: YES, 6 events.** |
| Webhook subscribed to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` | Stripe Dashboard → webhook detail | All 4 in the list. The other 2 events Sam subscribed are harmless — webhook handler logs them as unhandled and returns 200. |
| Production deploy is green | Vercel → Deployments → latest | Status: Ready. Commit SHA matches `4e4bd70` (or later if H pushed). |
| Sam's profile row in production | Supabase SQL editor: see Query A below | Row exists with `subscription_tier = 'free'` and `stripe_customer_id IS NULL`. (Per Sam: "Existing 'free' tier users in DB: 1, Sam only.") |

### Query A — Sam's current state

```sql
select
  p.id,
  u.email,
  p.stripe_customer_id,
  p.stripe_price_id,
  p.subscription_tier,
  p.updated_at
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'tortillabarllc@gmail.com';
```

Keep this query open in a tab. You will re-run it at every checkpoint
in the tests below.

### Test cards (Stripe live mode test cards still work in live mode webhooks?)

**No.** Live-mode Stripe only accepts real cards. There is no
"test card in live mode" equivalent — that's the whole point of test
mode being separate. The 4242 card returns "Your card was declined"
in live mode.

This means **tests 1–7 below cannot fully complete in production
against the live Stripe key**. The Checkout session is created, the
hosted Checkout page renders, but card entry fails.

**Two viable paths:**

- **Path A (recommended for smoke):** swap Vercel env to a Stripe test
  key + test webhook + test prices for the duration of the smoke run.
  Run tests 1–7 with 4242 etc. After PASS, swap back to live keys for
  the real "go live test" in section 8.
- **Path B (faster, riskier):** skip tests 1–7 entirely on production.
  Run them locally against a test Stripe account. Only run section 8
  ("go live test") in production with a real card.

This document assumes **Path A**. If Sam takes Path B, sections 1–7
become a local-only checklist.

To swap keys for Path A:
1. Vercel env vars → toggle the 4 Stripe env vars to test-mode values
2. Redeploy
3. Run sections 1–7
4. Restore live env vars, redeploy
5. Run section 8

---

## 1. Test 1 — Annual happy path (incognito, test card 4242)

The reference flow. Everything else is a variation.

### 1.1 Setup state

Run Query A. Expected: Sam's row, tier=`free`, customer_id=null.

### 1.2 Steps

1. Open a fresh incognito window. Do NOT use a browser that has Sam's
   Supabase session.
2. Visit `https://www.pacopeptide.com/es`.
3. Click **EMPEZAR** (hero CTA).
4. URL should become `…/es/auth/sign-up?plan=annual`.
5. Check browser cookies: `pp_intent_plan = annual` should be set
   (1-hour expiry, SameSite=Lax, Secure).
6. Sign up via Google OAuth using a fresh Gmail Sam controls (or use
   the email form with a fresh address).
7. After auth, Sam will land on `/es/dashboard` briefly. The dashboard
   page guard runs server-side **before render**:
   - reads `subscription_tier` = `free`
   - reads `pp_intent_plan` cookie = `annual`
   - calls `redirect('/api/stripe/upgrade?plan=annual&locale=es')`
8. `/api/stripe/upgrade` GET handler:
   - reads user from Supabase (must be authed — should be, just OAuth'd)
   - creates Stripe customer (Sam's profile gets `stripe_customer_id`
     written by `createCheckoutSession`)
   - creates Checkout session with annual price + `trial_period_days: 7`
   - 302s to Stripe-hosted Checkout URL
9. Stripe Checkout page renders. Sam enters card `4242 4242 4242 4242`,
   any future expiry, any 3-digit CVC, any postal.
10. Stripe redirects to `/es/coach?upgraded=true`.
11. Coach page guard runs:
    - reads tier — depends on whether webhook has landed yet (race)
    - if tier still `free`: `?upgraded=true` triggers the one-shot
      bypass, page renders
    - if tier already `trialing`: normal pass, page renders
12. Coach renders. CoachChat empty state visible. Sam can type a
    message and Bukowski responds (the in-coach 3-query rate-limit
    is bypassed because `isActiveSubscriber('trialing') === true`).

### 1.3 Checkpoints (run Query A after each)

| After step | Expected DB state |
|---|---|
| Step 6 (OAuth completes) | tier=`free`, customer_id=null (page guard hasn't run yet, profiles trigger creates the row) |
| Step 8 (upgrade endpoint runs) | tier=`free`, customer_id=`cus_...` (set by createCheckoutSession) |
| Step 11 (coach renders) — within ~5s of step 10 | tier=`trialing`, customer_id=`cus_...`, price_id=annual price |
| 5+ seconds later | Should still be `trialing` (webhook is idempotent) |

### 1.4 Pass criteria

- All 4 checkpoints match the table above
- Coach is fully accessible — no rate-limit toast, no quota indicator
- /dashboard and /log/dose are accessible (page guards pass for `trialing`)

### 1.5 Common failure modes

- Stuck on `/es/coach?upgraded=true` with infinite redirect to upgrade
  → webhook never landed. Check Stripe Dashboard → Events for delivery
  failures. Check Vercel function logs for `/api/stripe/webhook`.
- Page guard redirects to `/es/?error=checkout_failed`
  → `createCheckoutSession` returned `{ok: false}`. Check Vercel logs
  for `[stripe/checkout-session]` errors. Most likely cause: missing
  env var or Stripe API error.
- Stripe Checkout page says "missing price" or "no plan selected"
  → `STRIPE_PRICE_ID_VIA_PRO_ANNUAL` env var unset on Vercel.

---

## 2. Test 2 — Monthly happy path

Same as Test 1 with `?plan=monthly` instead of `annual`.

### 2.1 Steps

1. Fresh incognito window.
2. Visit `…/es`.
3. Scroll down to pricing section. Click **mensual ↗** (the ghost
   link in the monthly alt block, not the brass annual button).
4. URL becomes `…/es/auth/sign-up?plan=monthly`.
5. Cookie `pp_intent_plan = monthly`.
6. Sign up.
7. Page guard → upgrade endpoint → Stripe Checkout with **monthly**
   price. Verify the Stripe Checkout page shows `$9.99 / month`.
8. Enter 4242, complete.
9. Land on `/es/coach?upgraded=true`. Coach accessible.

### 2.2 Pass criteria

- `STRIPE_PRICE_ID_VIA_PRO` (monthly) was used, not the annual one.
  Stripe Checkout page showed `$9.99` not `$79`.
- After webhook lands, `profiles.stripe_price_id` = monthly price ID.

---

## 3. Test 3 — `?upgraded=true` race-window bypass

Verifies the one-shot bypass actually fires when the webhook is slow.

### 3.1 Setup

1. In Stripe Dashboard → Developers → Webhooks → edit the test-mode
   webhook → **temporarily disable** it (toggle off, do not delete).
2. Fresh incognito, fresh Gmail account.
3. Run the annual flow (Test 1, steps 1–10) but Stripe's webhook will
   NOT fire because it's disabled.

### 3.2 Steps

1. Stripe Checkout completes. Browser redirects to
   `/es/coach?upgraded=true`.
2. **Coach should render** — the `?upgraded=true` bypass in
   `subscription-guard.ts` allows free users through this one time.
3. Check DB: `profiles.subscription_tier` should still be `free`
   because the webhook didn't fire.
4. Click "panel" in the coach top bar to navigate to `/dashboard`.
5. **Dashboard page guard fires WITHOUT bypass** (only coach has it).
   Sam should be redirected back through `/api/stripe/upgrade` and
   end up on Stripe Checkout AGAIN — because tier is still `free`.

### 3.3 Recovery + final check

6. Cancel the second Stripe Checkout (or close the tab).
7. Re-enable the webhook in Stripe Dashboard.
8. In Stripe → Events, find the `checkout.session.completed` event
   from step 1 and click **Replay**.
9. Wait ~5 seconds. Run Query A. Tier should now be `trialing`.
10. Visit `/es/coach` (no `?upgraded=true` this time). Page renders
    normally — guard passes because `isActiveSubscriber('trialing')`.

### 3.4 Pass criteria

- Step 2: coach renders with bypass while tier=`free`
- Step 5: dashboard correctly re-redirects (bypass is coach-only)
- Step 9: replayed webhook updates tier to `trialing`
- Step 10: normal access works after tier flips

---

## 4. Test 4 — applyToProfile race condition (Audit Q14)

The webhook's `applyToProfile` looks up profile by `stripe_customer_id`.
For `customer.subscription.updated` and `invoice.payment_failed`, it
passes `null` as the fallback user ID — meaning if the customer link
wasn't set by a prior `checkout.session.completed`, the update is a
silent no-op.

This test confirms the failure mode is what we think it is.

### 4.1 Setup

Run Test 1 to completion. Sam's row has `stripe_customer_id` set and
tier=`trialing`. Note the customer ID.

### 4.2 Trigger the race

1. In Supabase SQL editor, **manually break the link** for testing:
   ```sql
   update public.profiles
   set stripe_customer_id = null
   where id = '<sam_user_id>';
   ```
2. In Stripe Dashboard → Subscriptions → find the test subscription.
   In Stripe Dashboard → Customers → Sam's customer → click "Update
   subscription" → toggle something trivial (e.g. quantity to 1 if
   it isn't, or update metadata) → save.
3. Stripe fires `customer.subscription.updated`. Our webhook handler
   runs `applyToProfile(customerId, null, {...})`.
4. The lookup `where stripe_customer_id = '<cus_id>'` returns no rows
   (because we just nulled it). Fallback `userId` is null, so the
   handler silently returns without writing.
5. Run Query A. Tier should still be `trialing` (the value from
   step 4.1's setup — but `stripe_customer_id` is still null because
   nothing updated it).

### 4.3 Recover

6. Manually restore the link:
   ```sql
   update public.profiles
   set stripe_customer_id = '<cus_id>'
   where id = '<sam_user_id>';
   ```
7. In Stripe → Events, replay the `subscription.updated` event from
   step 2. Now the lookup succeeds, the update lands.
8. Run Query A. Tier should reflect the latest subscription status.

### 4.4 Pass criteria

- Step 5 confirms the no-op behavior we expect (no error, no write,
  no crash, no Sentry alert — just nothing)
- Step 8 confirms the replay path works once the link is restored

### 4.5 What this DOESN'T fix

The race in real life is: webhook delivery order from Stripe is not
guaranteed. If `subscription.updated` arrives before
`checkout.session.completed` (rare but possible), the update is a
no-op, and the `completed` event sets the customer link + tier later.
That's fine — the final state is correct. The dangerous case is if
`subscription.updated` arrives, no-ops, AND `completed` never fires
(e.g., Stripe drops the event). Then the user has a customer link
written by `completed`'s creation step but the tier never flipped.

A real fix would: pull `metadata.supabase_user_id` from the
subscription object on `subscription.updated` (we already set it in
commit C) and pass that as the fallback. Out of scope tonight. Flag
as Audit Q14 follow-up if the failure case ever materializes.

---

## 5. Test 5 — Cancel during trial

### 5.1 Setup

Trialing user from Test 1 or Test 2.

### 5.2 Steps

1. Visit `/es/dashboard` while trialing.
2. Click "Administrar suscripción" (Stripe Customer Portal link).
3. Customer Portal opens in same tab.
4. Click **Cancel plan**. Confirm cancellation.
5. Stripe immediately cancels the subscription (no end-of-period
   grace for trials by default).
6. Stripe fires `customer.subscription.deleted`.
7. Webhook handler writes `subscription_tier='free'`,
   `stripe_price_id=null`.
8. Return to PACO. Click "Volver" or visit `/es/coach`.
9. **Coach page guard should redirect to Checkout again** — user is
   now `free`, no `?upgraded=true` bypass on a fresh navigation, no
   intent cookie (it expired 1h ago).
10. The redirect goes to `/api/stripe/upgrade?plan=annual&locale=es`
    (default plan when cookie is gone).

### 5.3 Checkpoint

Run Query A. `subscription_tier='free'`, `stripe_price_id=null`,
`stripe_customer_id` retained (so future Checkouts reuse the customer
record).

### 5.4 Pass criteria

- Cancellation completes in Customer Portal without errors
- Webhook writes tier=`free` within ~5s
- Re-accessing `/coach` redirects to Checkout, NOT to sign-in
  (Sam is still authed)

---

## 6. Test 6 — Active subscriber unaffected by paywall

Confirms commits A + F don't break access for paid users.

### 6.1 Setup

Need a user with `subscription_tier='pro'`. Easiest:

```sql
update public.profiles
set subscription_tier = 'pro'
where id = '<sam_user_id>';
```

(Skip if you have a real `pro` user. For one-off test, set then revert.)

### 6.2 Steps

1. Visit `/es/coach` (logged in as the pro user).
2. Visit `/es/dashboard`.
3. Visit `/es/log/dose`, `/es/log/weight`, `/es/log/symptom`.
4. All five should render normally with no redirects.

### 6.3 Pass criteria

- Zero redirects to `/api/stripe/upgrade` from any of the 5 routes
- Coach renders without quota indicator (pro is unrestricted)
- Dashboard shows "Administrar suscripción" link

### 6.4 Cleanup

If you faked the pro tier with SQL, revert:
```sql
update public.profiles
set subscription_tier = 'free'
where id = '<sam_user_id>';
```

---

## 7. Test 7 — Logged-out access to protected routes

### 7.1 Steps

Open incognito, no auth.

1. Visit `/es/coach` directly. Should redirect to `/es/auth/sign-in`.
2. Visit `/es/dashboard` directly. Same.
3. Visit `/es/log/dose` directly. Same (new behavior — used to render
   the client form briefly; now the layout server-component intercepts
   before children render).
4. Visit `/es/log/weight` and `/es/log/symptom` — same.

### 7.2 Pass criteria

- All 5 redirect to `/es/auth/sign-in` (not to `/es/api/stripe/upgrade`
  — there's no user yet, no point trying to charge)
- The redirect chain is at most one hop (no flicker, no double redirect)

---

## 8. "Go live test" — REAL CARD, REQUIRES SAM'S EXPLICIT APPROVAL

**Do not run this section until Sam has explicitly said "go live
test" in a message.**

### 8.1 What this tests

The full annual flow against the live Stripe account with a real card.
At the end, Sam will have an actual $79/year subscription with a 7-day
trial. Plan: complete the flow, verify DB state, then immediately
cancel via Customer Portal so no real charge occurs at trial end.

### 8.2 Prerequisites for going live

- Sections 1–7 above all PASS in test mode
- Vercel env vars swapped back to live keys (if Path A was taken)
- Sam has time to complete the test in one session (~15 min)
- Sam is ready to actually pay $79 in the unlikely event the trial
  cancellation fails (it shouldn't, but…)

### 8.3 Steps

1. Fresh incognito. Visit `https://www.pacopeptide.com/es`.
2. EMPEZAR → sign up with Sam's actual Google account.
3. Land on Stripe Checkout. Enter real card.
4. Complete Checkout.
5. Coach renders. Sam asks Bukowski one real question. Verify response.
6. Run Query A. tier=`trialing`, real `cus_…` ID, real annual `price_…`.
7. **Immediately** go to `/dashboard` → "Administrar suscripción" →
   Customer Portal → Cancel plan.
8. Confirm cancellation.
9. Verify the email Stripe sends: "Your subscription has been canceled."
10. Run Query A. tier=`free`, stripe_price_id=null.
11. Verify in Stripe Dashboard → Customers → Sam → Subscriptions:
    status = `canceled`. **Critically: no invoice generated** because
    cancellation during trial doesn't trigger billing.

### 8.4 Pass criteria

- Complete end-to-end with real card without any error
- Database state matches expectations at every checkpoint
- $0 actual charge to Sam's real card (verify via card statement
  next day)
- Stripe shows the subscription as `canceled` with no charges

### 8.5 If something charges

If for any reason a real charge appears:
1. Open Stripe Dashboard → Payments → find the charge
2. Click "Refund" → refund 100%
3. Note the charge ID, amount, and timestamp in the post-mortem

---

## 9. Rollback procedure

If any test in sections 1–7 fails in a way that suggests the paywall
is broken in production:

### 9.1 Fast rollback (revert commits)

```bash
git revert --no-commit 4e4bd70 118a373 1f24142 159541e 9c8be9d d7147ee
git commit -m "revert: roll back paywall commits A,C,D,E,F,G"
git push origin main
```

Wait for Vercel auto-deploy. Verify production returns to pre-paywall
behavior (EMPEZAR → /auth/sign-up → /dashboard with free access).

### 9.2 DB rollback (if migration 0004 caused issues)

```sql
alter table public.profiles
  drop constraint if exists profiles_subscription_tier_chk;
```

This removes the CHECK constraint. Existing rows with `trialing` or
`past_due_grace` tier values remain valid (no data migration needed —
they're just unconstrained strings again).

### 9.3 Partial rollback (keep webhook handling, revert paywall enforcement)

If the webhook + DB layer is fine but the page guards are misbehaving:

```bash
git revert --no-commit 118a373  # F: page guards
git revert --no-commit 4e4bd70  # G: homepage CTA wiring
git commit -m "revert: roll back paywall enforcement (commits F + G)"
git push origin main
```

Webhook (D) and `/api/stripe/upgrade` (C) remain. EMPEZAR goes back
to plain `/auth/sign-up`. Existing paid users keep their `trialing` /
`pro` tiers. Free users have free access (no paywall).

---

## 10. What this plan deliberately doesn't cover

- Trial → paid conversion at day 7 (Stripe simulates this with
  "Advance time" in test mode; a real test requires waiting or using
  the Subscription API to fast-forward `trial_end`). Out of scope for
  smoke; covered by Stripe's own dunning behavior.
- `invoice.payment_failed` followed by `past_due_grace` recovery.
  Requires test card `4000 0000 0000 0341` (auth succeeds, charge
  fails) and a real charge attempt (so trial conversion must complete
  first). Multi-day scenario; add to a future operational runbook.
- Email notifications (Resend) for trial reminders or cancellation
  confirmations — not in scope for this build.
- Mobile responsive layout of the new pricing section — verify via
  visual QA on Vercel preview, not in this plan.
- LocaleSwitcher behavior in the dark auth context — covered by
  visual QA, not paywall logic.

---

## 11. Sign-off

When all of sections 1–7 pass and section 8 has been explicitly
approved + completed, write a one-liner:

```
SMOKE PASS: <date> · all 7 sections + live test · tip <sha>
```

…and append it to this file at the bottom. That becomes the
proof-of-deploy record for the paywall going live.
