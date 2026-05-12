# PACO Peptide — Reverse Trial Paywall: Scope Proposal

**Branch:** main · **Tip:** ba4f1fc · **Audit reference:** PAYWALL_AUDIT.md

This is a proposal. No code has been written. No commits made. No
files changed beyond this document. Awaiting Sam's approval per
phase before any build.

---

## (8) CC recommendation up front: pricing surface

**Recommend: modify existing homepage pricing section in place. No new
`/pricing` page. EMPEZAR drops user into sign-up, then auto-redirects
to Stripe Checkout via page guard.**

Reasons:
- Existing homepage at [src/app/[locale]/page.tsx:248-296](src/app/[locale]/page.tsx) already has a pricing section in the editorial layout. Trade the single $9.99 card for two cards (annual primary with `AHORRA` badge, monthly secondary). One file edit, no new route, no new SEO surface to maintain.
- A `/pricing` page would duplicate copy that already lives on the homepage — drift risk over time.
- Stripe-hosted Checkout is its own surface; we don't need a third.
- Hero CTA at [page.tsx:140](src/app/[locale]/page.tsx) currently reads `"empezar · $9.99/mes ↗"` — the `$9.99/mes` chip will mislead now that annual is primary. **Recommend stripping the price out of the hero CTA**, leaving just `"empezar ↗"`. Pricing section below carries the actual price disclosure. Confirm before commit.

If Sam disagrees and wants `/pricing`, swap that for commit G — same scope, different file path.

---

## (1) Files to touch

Listed in commit order with one-line reason each.

### Commit A — Normalize the "is subscriber" check (separate, lands first)

| File | Change | Reason |
|---|---|---|
| `supabase/migrations/0004_subscription_tier_extended.sql` (NEW) | Add CHECK constraint on `profiles.subscription_tier` allowing `'free' \| 'pro' \| 'trialing' \| 'past_due_grace'` | Make the new tier values legal at the DB level |
| `src/lib/subscription.ts` (NEW, ~15 LOC) | Single helper `isActiveSubscriber(tier: string \| null \| undefined): boolean` returning true for `pro`, `trialing`, `past_due_grace` | One source of truth — kills the audit Q9 inconsistency |
| `src/app/[locale]/coach/page.tsx` | Replace `const isPro = tier === "pro"` at `:45` with `const isActive = isActiveSubscriber(tier)`; pass `isPro={isActive}` to CoachChat | Use the helper |
| `src/app/[locale]/dashboard/page.tsx` | Replace `Boolean(profile?.stripe_price_id)` at `:62` with `isActiveSubscriber(profile?.subscription_tier)` after also selecting `subscription_tier` in the query | Use the helper, switch source-of-truth from `stripe_price_id` to `subscription_tier` |
| `src/app/api/coach/route.ts` | Replace `profile?.stripe_price_id != null` at `:99` with `isActiveSubscriber(profile?.subscription_tier)` and select that column instead | Use the helper |

**Critical:** This commit touches **rate-limit gating only**. The `isPro` boolean still wires to "skip the 3-query/day cap" on coach. **No access redirects added in this commit.** That ships in commit F. Per spec: "USE: subscription_tier IN ('pro','trialing','past_due_grace')" — the helper enforces exactly that.

### Commit B — Document new Stripe env vars (no code)

| File | Change | Reason |
|---|---|---|
| `.env.example` (CREATE if missing, otherwise modify) | Add `STRIPE_PRICE_ID_VIA_PRO_ANNUAL=price_...` alongside existing `STRIPE_PRICE_ID_VIA_PRO` | Document the new env var Sam needs to set in Vercel |

Stripe-side action (Sam, not me): create the **annual $79 price** in the live Stripe Dashboard against the existing PACO Peptide product. Provide the `price_...` ID for Vercel + `.env.local`. **I will not call the Stripe API to create prices** per constraint.

This commit may be empty if `.env.example` already exists and you'd rather just do the env setup outside git. Flag in scope: should I commit a `.env.example` or leave env-var documentation to a comment in commit C?

### Commit C — Extend Checkout endpoint + add Upgrade redirect endpoint

| File | Change | Reason |
|---|---|---|
| `src/app/api/stripe/checkout/route.ts` | Extend POST body to accept `plan: "monthly" \| "annual"` (default `"annual"`); pick price ID accordingly; add `subscription_data.trial_period_days: 7`, `allow_promotion_codes: true`, `payment_method_collection: "always"`; change `success_url` from `/dashboard?upgraded=true` to `/coach?upgraded=true`; cancel_url stays at `/coach` (or change to `/`?) | The existing in-coach upgrade button uses this endpoint — extending preserves it |
| `src/app/api/stripe/upgrade/route.ts` (NEW, ~50 LOC) | New GET endpoint. Accepts `?plan=...`. Same Checkout-creation logic, but **redirects via 302** to the Stripe URL instead of returning JSON | Page guards (commit F) need a redirect target — JSON-returning POST doesn't work for server-side redirect chains |

The existing POST `/checkout` stays callable from `CoachChat.tsx:307` unchanged in interface (just gains `plan` default to `"annual"`). The new GET `/upgrade` is what page guards use.

### Commit D — Extend webhook to handle trialing + past_due_grace

| File | Change | Reason |
|---|---|---|
| `src/app/api/stripe/webhook/route.ts` | Modify `checkout.session.completed` handler ([:89-115](src/app/api/stripe/webhook/route.ts)) to map `subscription.status` → tier (`trialing` → `'trialing'`, `active` → `'pro'`); modify `customer.subscription.updated` handler ([:116-127](src/app/api/stripe/webhook/route.ts)) to write `'trialing'` / `'pro'` / `'past_due_grace'` / `'free'` based on status; add new handler for `invoice.payment_failed` → write `'past_due_grace'`; `customer.subscription.deleted` unchanged | Spec: "trialing=pro" (access-wise) but tracked separately for analytics; past_due_grace is the 3-day grace window |

**Status → tier map:**

| Stripe `subscription.status` | DB `subscription_tier` |
|---|---|
| `trialing` | `'trialing'` |
| `active` | `'pro'` |
| `past_due` | `'past_due_grace'` |
| `unpaid`, `canceled`, `incomplete`, `incomplete_expired` | `'free'` |
| `paused` | `'free'` (treat as inactive) |

`invoice.payment_failed` handler also writes `'past_due_grace'` for belt-and-suspenders (sometimes payment_failed fires before subscription.updated reflects past_due).

**Out of scope tonight unless Sam wants:** `customer.subscription.trial_will_end` (could send "trial ends in 3 days" email — needs email infra).

### Commit E — Intent cookie via middleware (does NOT touch sign-up page)

| File | Change | Reason |
|---|---|---|
| `src/proxy.ts` | Extend the `proxy` function: if request path matches `^/(es\|en)/auth/sign-(in\|up)$` and `?plan=monthly\|annual` is present, set a `pp_intent_plan` cookie (1-hour expiry, lax SameSite, secure in prod, httpOnly false so a future client could read it if needed) on the response | Capture which plan the user clicked on the homepage so the post-signup redirect knows which Checkout to fire. Does **not** touch the sign-up page itself, per constraint. |

The existing `next-intl` + `updateSession` chain in proxy.ts is preserved verbatim; only one new step added at the end.

### Commit F — Page guards on /coach, /dashboard, /log/* (the actual paywall)

| File | Change | Reason |
|---|---|---|
| `src/app/[locale]/coach/page.tsx` | After the `if (!user)` redirect, add: read `subscription_tier`, `if (!isActiveSubscriber(tier)) redirect to /api/stripe/upgrade?plan=<cookie 'pp_intent_plan' value or 'annual'>` | The actual paywall enforcement |
| `src/app/[locale]/dashboard/page.tsx` | Same guard pattern after the auth check at `:49-51` | Dashboard is the post-success landing too — guard prevents free users browsing |
| `src/app/[locale]/log/dose/page.tsx` | Same guard | Logging is a paid feature |
| `src/app/[locale]/log/weight/page.tsx` | Same guard | Same |
| `src/app/[locale]/log/symptom/page.tsx` | Same guard | Same |

**Note** — The success_url from Checkout is `/coach?upgraded=true`. After payment, the webhook fires async; if Stripe redirects the user back before the webhook lands, the user's tier might still be `free` and the page guard would loop them back to Checkout. Mitigation: page guard checks for `?upgraded=true` query param and treats it as a one-shot bypass that allows the page to render once. (Or: the guard could check the `success_url` flag against a short cookie set by the upgrade endpoint.) Confirm preferred mitigation in scope review.

### Commit G — Homepage CTA + pricing section wiring

| File | Change | Reason |
|---|---|---|
| `src/app/[locale]/page.tsx` | Hero CTA at `:140` and `:151`: change href from `/auth/sign-up` to `/auth/sign-up?plan=annual`; recommend dropping the `$9.99/mes` chip from the label (becomes just "empezar ↗"). Pricing section at `:248-296` rewritten as **two cards**: annual primary ($79/año, `AHORRA $40` badge), monthly secondary ($9.99/mes); both CTAs link to `/auth/sign-up?plan=annual\|monthly` | Wire the homepage to feed the new flow |
| `messages/es.json` + `messages/en.json` | New keys: `pricing_annual_amount`, `pricing_annual_period`, `pricing_annual_save_badge` ("AHORRA $40"), `pricing_annual_cta`, `pricing_monthly_amount` (existing `pricing_amount` may stay or rename), etc. Existing keys kept for safe revert. | i18n |

Sam approves the AHORRA badge exact copy + EN equivalent before this commit lands.

### Commit H — Smoke test plan (docs only)

| File | Change | Reason |
|---|---|---|
| `SMOKE_TEST_PLAN.md` (NEW) | Step-by-step incognito flow with expected DB state at each step (`profiles` row before signup, after signup, after Checkout, after trial conversion). Test cards. Cancel flow. | Per deliverable spec |

---

## (2) Migration SQL

```sql
-- supabase/migrations/0004_subscription_tier_extended.sql

-- Extend profiles.subscription_tier to allow trialing + past_due_grace.
-- Existing rows are 'free' or 'pro' (per migration 0001 default + Day 5
-- webhook writes), all of which pass the new check. Default unchanged.
-- RLS policies on profiles already cover this column.

alter table public.profiles
  add constraint profiles_subscription_tier_chk
  check (subscription_tier in ('free', 'pro', 'trialing', 'past_due_grace'));
```

**Why a CHECK and not an ENUM type:** ENUM migrations in Postgres are
painful to evolve (alter type add value, can't be in a transaction in
older PG). A CHECK constraint can be dropped + re-added cheaply if we
need to add another tier later. Trade-off: marginally less type safety
in the DB schema.

**Backward compat:** all existing rows ('free' or 'pro') pass the new
constraint. No data migration needed. The default value `'free'`
stays the same.

---

## (3) Stripe Checkout session params

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [
    {
      price: plan === "annual"
        ? process.env.STRIPE_PRICE_ID_VIA_PRO_ANNUAL!
        : process.env.STRIPE_PRICE_ID_VIA_PRO!,
      quantity: 1,
    },
  ],
  customer: stripeCustomerId,            // existing or freshly created
  success_url: `${origin}/${locale}/coach?upgraded=true`,
  cancel_url: `${origin}/${locale}/?canceled=true`,
  locale: locale === "es" ? "es" : "en",
  metadata: {
    supabase_user_id: user.id,
    plan,                                 // "monthly" | "annual"
  },
  subscription_data: {
    trial_period_days: 7,
    metadata: {
      supabase_user_id: user.id,
      plan,
    },
  },
  allow_promotion_codes: true,
  payment_method_collection: "always",   // require card upfront for trial
});
```

**Notes / open questions:**
- `payment_method_collection: "always"` is required for trials so Stripe
  takes the card upfront (default for trial subs is `if_required` which
  *doesn't* take card if no immediate charge).
- `allow_promotion_codes: true` shows the "Add promotion code" field on
  Stripe-hosted Checkout. Confirm Sam wants this exposed.
- `customer_creation` is implicit: we always pass `customer:` so Stripe
  reuses or doesn't create. Existing logic at [:46-62](src/app/api/stripe/checkout/route.ts) handles
  "customer not yet created → create with email + supabase metadata."
- `customer_email` not used — `customer:` takes precedence.
- `success_url` changed from existing `/dashboard?upgraded=true` to
  `/coach?upgraded=true` per Sam's spec ("user lands on /coach with
  full access"). Confirm.
- `cancel_url` — currently `${origin}/${locale}/coach` (existing in-coach
  upgrade flow assumed user came from coach). For first-time signup
  flow that lands here from the homepage, cancel back to homepage `/`
  may be more sensible. Recommend `/?canceled=true`. Confirm.
- The `?upgraded=true` query param is one-shot guard hint for the
  page-load race window between Stripe success redirect and webhook
  delivery (see Commit F notes).

---

## (4) Webhook event handlers

Required events (subscribe in Stripe Dashboard webhook settings):

```
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed         ← NEW
```

Handler logic per event:

| Event | Read from event | Write to `profiles` |
|---|---|---|
| `checkout.session.completed` | `session.customer`, `session.metadata.supabase_user_id`, `session.subscription.status` (need to fetch subscription) | `stripe_customer_id`, `stripe_price_id`, `subscription_tier` = `'trialing'` or `'pro'` based on status |
| `customer.subscription.updated` | `subscription.customer`, `subscription.status`, `subscription.items[0].price.id` | `stripe_price_id`, `subscription_tier` per status map (above) |
| `customer.subscription.deleted` | `subscription.customer` | `stripe_price_id = null`, `subscription_tier = 'free'` |
| `invoice.payment_failed` | `invoice.customer` | `subscription_tier = 'past_due_grace'` (idempotent — safe even if subscription.updated already wrote it) |

**Race-condition fix worth flagging:** the existing `applyToProfile()`
at [webhook/route.ts:33-55](src/app/api/stripe/webhook/route.ts) only writes through
`stripe_customer_id` lookup with `supabase_user_id` fallback. For
`subscription.updated`/`subscription.deleted` it passes `null`
fallback (line `:122`, `:132`), so if the customer was never linked
on `checkout.session.completed`, those events become silent no-ops.
Today this isn't reachable because `checkout.session.completed` always
fires first. With trial + payment_failed flow it remains reliable
**only if** `checkout.session.completed` always lands first. **Test
this in commit H's smoke plan.** Not changing the lookup logic in
this build.

---

## (5) Middleware gate logic — request → redirect map

**Recommendation: gates live in PAGE GUARDS, not in middleware.** The
audit confirmed pages already read profile data — adding a tier check
there is one extra line per page, no extra DB call. Middleware-based
gating would either need a JWT custom claim (Supabase setup not in
scope) or an extra DB roundtrip per request.

The middleware change in commit E is **purely cookie-setting** for the
plan intent — no access decisions made there.

| User state | URL hit | Page guard outcome |
|---|---|---|
| Logged out | `/coach`, `/dashboard`, `/log/*` | Existing: `redirect("/auth/sign-in")`. Unchanged. |
| Logged in, `subscription_tier='free'` | `/coach`, `/dashboard`, `/log/*` | NEW: `redirect("/api/stripe/upgrade?plan=" + (cookie('pp_intent_plan') ?? 'annual'))` |
| Logged in, `'free'` + `?upgraded=true` | `/coach` | Allow once (post-Checkout race window). Page renders. Webhook should land within seconds. Subsequent hits without `?upgraded=true` will redirect again until tier flips — which is fine because the user is already on /coach. |
| Logged in, `'trialing'` | `/coach`, `/dashboard`, `/log/*` | Allow |
| Logged in, `'pro'` | `/coach`, `/dashboard`, `/log/*` | Allow |
| Logged in, `'past_due_grace'` | `/coach`, `/dashboard`, `/log/*` | Allow (it's grace period) |
| Any state | `/`, `/auth/*`, `/privacy`, `/terms` | Allow (public) |

**Notes:**
- The existing `if (!user)` redirect lands users on `/auth/sign-in`,
  not `/`. Spec asks "logged out + /coach → redirect /pricing or
  sign-up?" — recommend keeping existing `/auth/sign-in` (we need
  authentication before we can know whom to charge; sending them to
  homepage marketing makes them re-click EMPEZAR which feels worse).
- The `/api/stripe/upgrade` redirect target must itself succeed
  (creates a Stripe customer if needed, creates Checkout session,
  302s to Stripe URL). On endpoint error, falls back to homepage `/`
  with a `?error=checkout_failed` param. Confirm.

---

## (6) Proposed commits, in order

1. **A:** `feat(subscription): add helper + migration for trialing/past_due_grace tiers` — DB migration + helper + 3 read-site swaps. No new behavior.
2. **B:** `chore(env): document STRIPE_PRICE_ID_VIA_PRO_ANNUAL` — `.env.example` only (or skip per scope review).
3. **C:** `feat(stripe): add upgrade endpoint + extend checkout for plan + 7-day trial` — new `/api/stripe/upgrade` route, modify `/api/stripe/checkout`.
4. **D:** `feat(stripe-webhook): handle trialing + past_due_grace + invoice.payment_failed` — webhook extension.
5. **E:** `feat(middleware): set pp_intent_plan cookie from ?plan=X on auth routes` — proxy.ts extension.
6. **F:** `feat(paywall): page guards on /coach, /dashboard, /log/* enforce active subscription` — the actual paywall.
7. **G:** `feat(home): two-card pricing (annual primary $79, monthly $9.99) + EMPEZAR routes through Checkout` — homepage rewrite.
8. **H:** `docs: SMOKE_TEST_PLAN for paywall flow` — incognito test steps + DB state expectations.

**8 commits, equal to the spec ceiling.** If commit B is dropped, 7.

---

## (7) Risks / unknowns — Sam input needed

1. **Live annual Stripe price** — needs to be created in Stripe Dashboard. Sam must do this and provide `price_...` ID for Vercel env. Cannot script (per constraint).
2. **Live monthly Stripe price** — current env var is `STRIPE_PRICE_ID_VIA_PRO`. Day 5 used a test-mode price. **Sam to confirm Vercel `STRIPE_PRICE_ID_VIA_PRO` is set to the live monthly price** ($9.99/mo). If still test-mode, every Checkout fails or charges nothing.
3. **Annual exact amount** — spec says `$79/yr`. Math for the badge: `9.99 × 12 = $119.88`. Saved = `$40.88`. Badge copy `AHORRA $40` rounds down — clean. Confirm "$79/año" in ES, "$79/yr" in EN.
4. **Hero CTA chip** — recommend dropping `$9.99/mes` from `"empezar · $9.99/mes ↗"` since annual is now primary. Final: `"empezar ↗"`. Pricing section below carries the price disclosure. Confirm.
5. **Cancel URL** — `/coach` (current) vs `/?canceled=true` (recommended for first-time-signup flow). Recommend the latter.
6. **`allow_promotion_codes`** — true exposes a promo code field. Recommend yes (you can run growth experiments). Confirm.
7. **`?upgraded=true` race-window bypass** — recommended above. Alternative: do nothing and accept the rare re-redirect during the first 1-2 seconds. Confirm.
8. **`pp_intent_plan` cookie scope** — 1-hour expiry, `SameSite=Lax`, `Secure` in prod, NOT httpOnly so future client code could read it. Plain-text values `'monthly'`/`'annual'`. No signing — intent isn't sensitive. Confirm.
9. **Existing `free` users in DB** — if any row in production `profiles` already has `subscription_tier='free'` (Sam himself, others?) they will be redirected to Checkout on next visit after this lands. Acceptable assumption: only Sam + maybe one other test account. Confirm.
10. **The existing in-coach upgrade button** at `CoachChat.tsx:307` calls POST `/api/stripe/checkout` with body `{locale}`. After commit C extends the endpoint to accept `plan`, default is `"annual"`. So the in-coach button defaults to annual too. Confirm intentional, or want it to keep monthly default?
11. **Trial cancellation mid-trial** — if user cancels during 7-day trial via Stripe Customer Portal, `customer.subscription.deleted` fires. Webhook flips tier to `'free'`. User loses access immediately. Standard behavior. Confirm acceptable.
12. **Customer Portal retention offers** — Stripe Customer Portal can offer a discount when users hit cancel. Currently not configured. Out of scope tonight. Flag.
13. **Trial reminder email** — `customer.subscription.trial_will_end` event fires 3 days before end. Could send reminder via Resend (env `RESEND_API_KEY`). Out of scope tonight; flag.
14. **Sentry coverage** — webhook already wraps errors at [webhook/route.ts:144](src/app/api/stripe/webhook/route.ts). New endpoints should match. Will add `Sentry.captureException` to `/api/stripe/upgrade`.

---

## What I will NOT do (constraint reaffirmation)

- Not touching `src/components/CoachChat.tsx` beyond what scope says (3-query gate stays at line `:307` — its call to POST `/api/stripe/checkout` keeps working because we extend the endpoint backward-compatibly with `plan` defaulting to `"annual"`).
- Not touching the Bukowski system prompt or any coach response logic.
- Not removing existing webhook handlers — only extending them.
- Not touching `auth/sign-in/page.tsx` or `auth/sign-up/page.tsx` (Day 7-8 ship). Plan intent flows through cookie set by middleware, not by sign-up page logic.
- Not touching legal/privacy/terms pages.
- Not touching the homepage editorial layout outside the pricing section + hero CTA href.
- Not changing any Spanish or English copy without showing Sam first (commit G will include the new strings as a separate review point).
- Not testing against live Stripe with real cards — incognito + test cards only until "go live test" approval.
- Not pushing to `origin/main` without showing the commit message + diff first per spec (deviation from prior tasks where I pushed straight up — this task explicitly forbids).

---

## What I need from Sam to proceed

**Approval items (yes/no per item):**

1. Approve commit list (8 commits A–H, in order)?
2. Approve "modify existing homepage pricing section, no `/pricing` page"? (Recommendation 8)
3. Approve "page guards, not middleware, for the actual paywall enforcement"? (Section 5)
4. Approve "drop `$9.99/mes` chip from hero CTA"? (Risk 4)
5. Approve `cancel_url = /?canceled=true`? (Risk 5)
6. Approve `allow_promotion_codes: true`? (Risk 6)
7. Approve `?upgraded=true` race-window bypass? (Risk 7)
8. Approve cookie config (Risk 8)?
9. Approve in-coach upgrade button defaulting to annual (Risk 10)?
10. Approve `AHORRA $40` exact copy? Provide EN equivalent (`SAVE $40`?).

**Action items (Sam-side):**

A. Create live Stripe annual price ($79/yr) in Stripe Dashboard, provide `price_...` ID.
B. Confirm `STRIPE_PRICE_ID_VIA_PRO` in Vercel env is the **live** monthly price (not Day 5 test).
C. Confirm Stripe webhook endpoint URL in Stripe Dashboard is `https://www.pacopeptide.com/api/stripe/webhook` (per CLAUDE.md "Stripe webhooks must target www") and that the four events listed in section 4 are subscribed.
D. Provide `STRIPE_PRICE_ID_VIA_PRO_ANNUAL` for `.env.local` (mine for build verification doesn't actually need it — but Vercel does for prod).

**Once approved, I'll execute commit A first, show diff + message, await go-ahead, then commit B, etc. One at a time. No pushing until you say so.**

---

End of scope proposal. No code written. Awaiting review.
