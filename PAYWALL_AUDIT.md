# PACO Peptide — Paywall Audit

**Branch:** main · **Tip:** ba4f1fc · **Date:** 2026-05-08

## Bug summary

Incognito → click EMPEZAR on `/es` → land on `/es/auth/sign-up` →
Google OAuth → land on `/es/dashboard` → full coach access. No Stripe
Checkout, no charge.

The Stripe Checkout code from Day 5 is **still present and unchanged
in logic** (only Sentry instrumentation added since `64820d6`). The
bug is **wiring**: the homepage CTA points to `/auth/sign-up` (free
account), and **no route in the app gates access on subscription
state**. The Checkout endpoint is reachable from exactly **one** UI
spot — the in-coach upgrade button — and only when a free user has
exhausted their daily 3-query quota. Anyone who never hits the quota
ceiling never sees Checkout.

---

## ROUTING

### Q1. EMPEZAR button — file, line, href

`src/app/[locale]/page.tsx:140` and again at `:311`. Both are
`<Link href="/auth/sign-up" style={ctaButtonStyle}>` rendering the
i18n key `t("hero_cta_primary")` (= `"empezar · $9.99/mes ↗"` in
`messages/es.json:14`) and `t("pricing_cta")` (= `"empezar ↗"` at
`messages/es.json:36`) respectively. The `$9.99/mes` text is
displayed inside the button label but the href routes to free signup,
not to Checkout. The next-intl `Link` resolves the href to
`/es/auth/sign-up` or `/en/auth/sign-up` based on current locale.

### Q1b. Client-side handler attached after mount?

**NO.** `src/app/[locale]/page.tsx` is a server component (no
`"use client"` directive at top). `grep -nE "useEffect|addEventListener|onClick"
src/app/[locale]/page.tsx` returns **zero matches**. The button is a
plain `<a>` (rendered by next-intl `Link`) with no JS attached. The
href is the entire behavior.

### Q2. /es/auth/sign-up — Stripe imports or calls?

**NO.** `grep -niE "stripe|checkout" src/app/[locale]/auth/sign-up/page.tsx`
returns zero matches. The sign-up page only imports Supabase auth
(`supabase.auth.signUp` then `supabase.auth.signInWithPassword` for
email flow at lines `156-164`, and `supabase.auth.signInWithOAuth`
for Google at `175-184`). On success it does
`router.push("/dashboard")` at `src/app/[locale]/auth/sign-up/page.tsx:170`.
No Checkout call, no redirect to a payment surface, no subscription
intent stored anywhere.

### Q3. OAuth callback — file, line, post-success behavior

`src/app/auth/callback/route.ts` (18 LOC, server route). On a valid
`?code=...`, it calls `supabase.auth.exchangeCodeForSession(code)`
at `:11` and on success redirects to the `?next=` query param or
`/es/dashboard` if absent (line `:7`). On failure or missing code it
redirects to `/es/auth/sign-in` (line `:17`). **No subscription
check, no profile read, no first-time-user branch, no Checkout
redirect.** The `next` param is set by the client when initiating
OAuth — at `src/app/[locale]/auth/sign-up/page.tsx:181` and
`src/app/[locale]/auth/sign-in/page.tsx:175` it's hardcoded to
`/${locale}/dashboard`. So every OAuth round-trip from the new auth
pages lands on dashboard, regardless of subscription tier.

### Q4. Middleware — exists? gates? checks?

`src/middleware.ts` does **NOT** exist. The Next.js 15 equivalent
lives at `src/proxy.ts` (15 LOC). It runs two middlewares in series:
(a) `next-intl/middleware` for locale routing, and (b) `updateSession`
from `src/lib/supabase/middleware.ts` which calls
`supabase.auth.getUser()` purely to refresh the session cookie (line
`:32` of the helper). The matcher at `src/proxy.ts:14` is
`["/((?!api|_next|_vercel|auth/callback|.*\\..*).*)"]` — excludes
`/api/*`, `/_next/*`, `/_vercel/*`, `/auth/callback`, and any URL with
a dot. **No path is subscription-gated by middleware. No path is
auth-gated by middleware either** — `updateSession` reads the session
but does not act on it.

### Q5. /coach and /dashboard — subscription check at top?

**NO.** Both pages do `if (!user) redirect({href: "/auth/sign-in", ...})`
and that is the only access guard:
- `src/app/[locale]/dashboard/page.tsx:49-51` — auth-only check
- `src/app/[locale]/coach/page.tsx:35-37` — auth-only check

Both then read profile data:
- Dashboard: `src/app/[locale]/dashboard/page.tsx:53-57` reads
  `display_name, stripe_price_id`. The boolean `hasStripeSubscription`
  at `:62` is computed from `stripe_price_id`, but only used at `:188`
  to conditionally render the "Manage subscription" link. Free users
  see the dashboard without restriction.
- Coach: `src/app/[locale]/coach/page.tsx:39-45` reads
  `subscription_tier`, derives `isPro = tier === "pro"` at `:45`, then
  uses it ONLY for quota math at `:48-58` (passing `isPro` and
  `initialQuotaRemaining` to `<CoachChat>`). The page renders for both
  free and pro users.

**There is no place in the app where a non-pro user is denied access
to either page.** The subscription check exists but is wired to rate
limiting, not access gating.

---

## PROFILES

### Q6. profiles columns

From `supabase/migrations/0001_init.sql:8-20` plus
`supabase/migrations/0002_stripe_profile_columns.sql:6-8`:

| column                    | type           | default                           |
|---|---|---|
| `id`                      | `uuid`         | (PK, FK → `auth.users(id)` ON DELETE CASCADE) |
| `created_at`              | `timestamptz`  | `now()`                           |
| `updated_at`              | `timestamptz`  | `now()`                           |
| `locale`                  | `text`         | `'es'`                            |
| `display_name`            | `text`         | NULL                              |
| `sex`                     | `text`         | NULL                              |
| `birth_year`              | `int`          | NULL                              |
| `height_cm`               | `numeric(5,2)` | NULL                              |
| `goal_weight_kg`          | `numeric(5,2)` | NULL                              |
| `subscription_tier`       | `text`         | `'free'` (NOT NULL)               |
| `subscription_expires_at` | `timestamptz`  | NULL                              |
| `stripe_customer_id`      | `text`         | NULL (unique partial index where `not null`) |
| `stripe_price_id`         | `text`         | NULL                              |

RLS enabled. Self-only `select`/`insert`/`update` policies at
`0001_init.sql:24-29`.

### Q7. Trigger on auth.users insert?

**YES.** `public.handle_new_user()` defined at
`supabase/migrations/0001_init.sql:151-162` (security definer, search
path `public`). It runs `insert into public.profiles (id, locale)
values (new.id, coalesce(new.raw_user_meta_data->>'locale', 'es'))`.
Trigger `on_auth_user_created` at `:164-166` fires `after insert on
auth.users for each row`.

So every new auth.users row gets a profiles row with: `id` =
auth user id; `locale` = `'es'` unless OAuth metadata supplied
otherwise; **all other columns left at table defaults**, which means
`subscription_tier='free'`, `stripe_customer_id=null`,
`stripe_price_id=null`, `subscription_expires_at=null`.

### Q8. tortillabarllc@gmail.com — actual row values

**NOT FOUND.** Cannot query the live Supabase database from this
environment — no service-role key, no psql credentials available. To
verify, you'd run in Supabase SQL editor:

```sql
select p.*
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'tortillabarllc@gmail.com';
```

Expected based on the trigger semantics + bug description: `id` = the
google-OAuth user id; `subscription_tier='free'`;
`stripe_customer_id=null`; `stripe_price_id=null`;
`subscription_expires_at=null`. If those are the values, it confirms
no Checkout ever fired for this user (no webhook ever wrote
`stripe_customer_id` or flipped tier to `pro`).

### Q9. "Is this user a subscriber" check — file, line, exact condition

There are **three** subscriber checks, none of which gate access:

1. `src/app/[locale]/coach/page.tsx:44-45`:
   ```ts
   const tier = profile?.subscription_tier ?? "free";
   const isPro = tier === "pro";
   ```
   Used at `:48` only to skip quota lookup, and passed to
   `<CoachChat isPro={isPro} ...>` at `:63` for in-component quota UX.

2. `src/app/[locale]/dashboard/page.tsx:62`:
   ```ts
   const hasStripeSubscription = Boolean(profile?.stripe_price_id);
   ```
   Used at `:188` only to conditionally render the manage-subscription
   link.

3. `src/app/api/coach/route.ts:99`:
   ```ts
   const isPro = profile?.stripe_price_id != null;
   ```
   Used at `:103` and `:274` for rate limiting only — `if (!isPro)` →
   apply 3-queries-per-day cap. Returns `429 quota_exhausted` if
   exceeded; **does not 402, does not redirect to Checkout**.

**Note inconsistency:** the coach page uses `subscription_tier === "pro"`
(text comparison), the dashboard and api/coach route use
`stripe_price_id != null` (presence check). Webhook writes both fields
together, so they should agree in practice — but a state where one is
set and the other isn't would diverge. No blocker for the current bug,
just a fragility.

**No "redirect non-subscriber to checkout" check exists anywhere.**

---

## STRIPE

### Q10. `stripe.checkout.sessions.create` — every match

**One match.** `src/app/api/stripe/checkout/route.ts:67`. Trigger:
`POST /api/stripe/checkout` with body `{ locale: "es" | "en" }`.
Handler authenticates via `supabase.auth.getUser()` at `:33-38`,
returns 401 if no session, then creates-or-reuses a Stripe customer
at `:46-62`, then creates a subscription Checkout session at `:67-75`
with `mode: "subscription"`, `line_items: [{price: STRIPE_PRICE_ID_VIA_PRO, quantity: 1}]`,
`success_url: ${origin}/${locale}/dashboard?upgraded=true`, and
`cancel_url: ${origin}/${locale}/coach`. Returns
`{ url: session.url }` for the client to `window.location.href = url`.

### Q11. Trace backwards — what UI hits /api/stripe/checkout?

**One caller.** `src/components/CoachChat.tsx:307`:
```ts
const res = await fetch("/api/stripe/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ locale }),
});
```
Inside the `startUpgrade()` function at `src/components/CoachChat.tsx:302-328`.
That function is invoked when a free user with quota_exhausted clicks
the in-coach upgrade button. Need to be authenticated AND need to
have hit the daily 3-query ceiling before this UI surfaces.

**No homepage button, no sign-up button, no dashboard button, no
post-OAuth flow** calls `/api/stripe/checkout`. The only path to
Checkout is: sign up → use coach 3 times → see paywall → click
upgrade. Anyone who never burns through 3 queries has zero exposure
to Checkout.

This is the wiring bug. The homepage CTA labeled `"empezar · $9.99/mes ↗"`
implies a payment intent ("start at $9.99/month") but its `href` is
free signup with no downstream redirect to Checkout.

### Q12. /api/stripe/webhook — events handled and DB writes

`src/app/api/stripe/webhook/route.ts:88-141` (switch on `event.type`):

| Event | DB writes (via `applyToProfile()` at `:33-55`) |
|---|---|
| `checkout.session.completed` (`:89-115`) | `profiles.stripe_price_id = <price>`, `profiles.subscription_tier = 'pro'`. Falls back to `stripe_customer_id = <customerId>` if matching by customer fails and `supabase_user_id` was provided in session metadata. |
| `customer.subscription.updated` (`:116-127`) | `profiles.stripe_price_id = <price>`, `profiles.subscription_tier = isActive ? 'pro' : 'free'` (active = status `active` or `trialing`). |
| `customer.subscription.deleted` (`:128-137`) | `profiles.stripe_price_id = null`, `profiles.subscription_tier = 'free'`. |
| anything else (`:138-140`) | logged to console, no DB write. |

Lookup strategy in `applyToProfile()` (`:40-54`): primary lookup is
`profiles.stripe_customer_id = customerId`. If no row matches AND a
fallback `supabase_user_id` was supplied, it updates by id and also
sets `stripe_customer_id` to seal the linkage. **There's a writable
gap:** `customer.subscription.updated` and `customer.subscription.deleted`
pass `null` as the fallback id, so if a customer row never got linked
on `checkout.session.completed`, those later events become silent
no-ops. Not the cause of today's bug (no Checkout ever fired) but a
consistency hazard.

Webhook signature verification at `:80-85` (HMAC via Stripe SDK). DB
writes use the **service-role** Supabase admin client (`getAdminClient()`
at `:17-26`), which bypasses RLS — required because the webhook isn't
authenticated as the user.

### Q13. Last commit touching src/app/api/stripe/ or src/lib/stripe/

```
fb8bdfd feat: add Sentry error tracking + fix entity name to ooabi LLC
7629041 feat(stripe): /api/stripe/portal creates Customer Portal session
b2d152b feat(stripe): /api/stripe/webhook handles subscription events
2d382d1 feat(stripe): /api/stripe/checkout creates Checkout Session
8bf36cc feat(stripe): add Stripe SDK server wrapper
```

Most recent: `fb8bdfd` — Sentry instrumentation. The four prior
commits are the original Day 5 build-out (May 3). **Nothing has
removed or rewritten Stripe logic since Day 5.** The Checkout
endpoint is byte-equivalent to the version that worked in test mode
on May 3 (modulo Sentry).

### Q14. Webhook diff: HEAD vs 64820d6

```diff
diff --git a/src/app/api/stripe/webhook/route.ts b/src/app/api/stripe/webhook/route.ts
index 5edb4e8..da71fba 100644
--- a/src/app/api/stripe/webhook/route.ts
+++ b/src/app/api/stripe/webhook/route.ts
@@ -1,5 +1,6 @@
 import { NextRequest } from "next/server";
 import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
+import * as Sentry from "@sentry/nextjs";
 import type Stripe from "stripe";
 import { getStripe } from "@/lib/stripe/server";
@@ -140,6 +141,7 @@ export async function POST(req: NextRequest) {
     }
   } catch (err) {
     console.error("[stripe/webhook] handler error", err);
+    Sentry.captureException(err);
     return jsonResponse(500, { error: "generic" });
   }
```

Two added lines: a Sentry import and a `Sentry.captureException(err)`
call inside the existing catch block. Zero logic change. The webhook
behavior at HEAD is identical to the Day 5 version that handled the
test-mode subscription successfully.

---

## Diagnosis (one paragraph)

The Checkout code is intact and the webhook code is intact. The
production bug is wiring: the homepage CTA `"empezar · $9.99/mes ↗"`
links to `/es/auth/sign-up` (free signup) instead of triggering
Checkout. The OAuth callback hardcodes `next=/${locale}/dashboard`
with no subscription branch. No middleware, page-level guard, or
route handler enforces "must be `subscription_tier='pro'` to access
/coach or /dashboard." The only path into Stripe Checkout is from
inside the coach UI when a free user has hit their daily 3-query
quota — a path that requires sign-up + 3 successful coach queries
first, all free. The user reaches `/coach`, gets up to 3 free
answers, never sees Checkout. The Day 5 smoke test passed because
the test exercised the in-coach quota-exhausted upgrade button
directly, not the homepage CTA flow.

## What's NOT verified in this audit

- **`tortillabarllc@gmail.com` row state** (Q8) — requires Supabase
  access I don't have. Best inferred from the trigger logic above:
  `subscription_tier='free'`, both Stripe ID columns null. Verify in
  Supabase SQL editor with the query in Q8.
- **Stripe dashboard state** — no Checkout sessions or customers
  created for this email expected; verify in Stripe dashboard's
  Customers tab if you want positive proof no Checkout ever ran.
- **Production webhook delivery health** — out of scope; if Stripe
  reports webhook delivery errors for past test-mode events, that's a
  separate question.

## Files referenced

- `src/app/[locale]/page.tsx:140`, `:311` — homepage CTAs
- `src/app/[locale]/auth/sign-up/page.tsx:170-184` — sign-up flow
- `src/app/[locale]/auth/sign-in/page.tsx:175` — sign-in OAuth `next` param
- `src/app/auth/callback/route.ts:7,11,13,17` — OAuth callback
- `src/app/[locale]/dashboard/page.tsx:49-51,62,188` — dashboard guard + sub check
- `src/app/[locale]/coach/page.tsx:35-37,44-48,63` — coach guard + sub check
- `src/app/api/stripe/checkout/route.ts:67` — Checkout creation
- `src/app/api/stripe/webhook/route.ts:88-141` — webhook event handlers
- `src/app/api/coach/route.ts:99,103,274` — API rate-limit gate
- `src/components/CoachChat.tsx:307` — only Checkout caller in UI
- `src/proxy.ts:14` — middleware matcher (no sub gating)
- `src/lib/supabase/middleware.ts:32` — session refresh only
- `supabase/migrations/0001_init.sql:8-20,151-166` — profiles + auto-create trigger
- `supabase/migrations/0002_stripe_profile_columns.sql:6-8` — Stripe columns
