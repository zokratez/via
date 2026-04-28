# 7-Day Ship Plan

Goal: paying customers by Day 10. Launch-ready MVP by Day 7.

## Day 1 — Monday: Foundation

- [ ] `npx create-next-app@latest` with TypeScript, Tailwind, App Router, `/src` dir
- [ ] `npx shadcn@latest init`
- [ ] Drop `CLAUDE.md` and `.cursorrules` from this starter into repo root
- [ ] `npm i @supabase/ssr @supabase/supabase-js next-intl zod react-hook-form lucide-react`
- [ ] Create Supabase project (**new project — do not reuse `vibe-lang`**)
- [ ] Run `supabase/migrations/0001_init.sql` in Supabase SQL editor
- [ ] Add env vars to `.env.local` and to Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
- [ ] Deploy bare app to Vercel. Confirm live URL.

**DoD:** Live URL loads, shows "Hello." No errors.

## Day 2 — Tuesday: Auth + i18n shell

- [ ] Implement next-intl with `[locale]` routing. Default `es`. Fallback `en`.
- [ ] Drop `messages/es.json` and `messages/en.json` from starter
- [ ] Supabase auth with magic link + Google OAuth
- [ ] `/es` and `/en` landing pages hooked up to the copy
- [ ] `/es/dashboard` gated by auth, shows greeting from `messages/es.json`
- [ ] RLS smoke test: log in as two users, confirm neither sees the other's data

**DoD:** Sign up in Spanish, see Spanish dashboard. Toggle to English. Log out. All working.

## Day 3 — Wednesday: Core logging

- [ ] Dose logging form (server action to `doses` table)
- [ ] Weight entry form (server action to `weight_entries`)
- [ ] Side effect form (server action to `side_effects`)
- [ ] Dashboard shows: last dose, weight delta, streak (days with at least one log)
- [ ] Simple weight chart (Recharts)

**DoD:** Log a full day: dose + weight + symptom. Dashboard reflects it.

## Day 4 — Thursday: AI coach

- [ ] `lib/coach/system-prompt.ts` with strict guardrails (no dose advice, no vendors, always refer to prescriber)
- [ ] `lib/coach/guardrails.ts` — post-response check for red-flag phrases
- [ ] Coach chat UI (simple, shadcn `Card` + input + message bubbles)
- [ ] Usage counter: 3 free queries/day, enforced server-side
- [ ] Model: `claude-sonnet-4-6` via Anthropic SDK
- [ ] Spanish-first system prompt — coach responds in user's locale

**DoD:** Ask "¿qué como si tengo náuseas?" — get a non-medical, helpful Spanish answer. Ask "¿qué dosis me tomo?" — get a refusal that points to the prescriber.

## Day 5 — Friday: Payments + paywall

- [ ] Stripe products: `pro_monthly` ($9.99), `pro_annual` ($59)
- [ ] `/es/pro` and `/en/pro` paywall pages
- [ ] Stripe Checkout server action
- [ ] Webhook endpoint at `/api/webhooks/stripe` — update `profiles.subscription_tier` + `subscription_expires_at`
- [ ] Coach quota: Pro = unlimited, Free = 3/day
- [ ] **Verify the webhook signature.** Not optional.

**DoD:** Test card subscribes, `profiles` row flips to `pro`, coach unlocks. Cancel webhook flips back.

## Day 6 — Saturday: Polish + legal

- [ ] Privacy policy page (`/es/privacidad`, `/en/privacy`) — drafted, lawyer-reviewed version pending
- [ ] Terms of Service (`/es/terminos`, `/en/terms`)
- [ ] Footer with disclaimer: "Esta app no reemplaza a tu médico. No recetamos ni vendemos medicamentos."
- [ ] Meta tags, OG image, favicon
- [ ] PostHog installed, events: `signup`, `first_dose_logged`, `first_coach_query`, `subscription_started`
- [ ] Sentry installed
- [ ] Lighthouse pass: ≥90 on Performance, ≥95 on A11y

**DoD:** App feels shippable. Open in incognito — you'd pay for it.

## Day 7 — Sunday: Launch

- [ ] Post to Product Hunt (scheduled for Tuesday launch — Sundays are weak)
- [ ] Post to r/Semaglutide, r/Tirzepatide, r/Mounjaro (read rules — some allow creator posts, some don't)
- [ ] Spanish: post to r/Ozempic_es if exists, r/PerderPeso, Facebook groups "GLP-1 en español"
- [ ] TikTok: short demo video in Spanish (use @laseuleplume voice for the creative direction, not the content)
- [ ] X post chain — @ooabisabi
- [ ] Email to your Huh? waitlist if you have one that overlaps

**DoD:** 50 signups minimum by EOD. First paying customer by Day 10.

## Mobile (Week 2)

Web MVP first. Once web is earning, `npx create-expo-app`, reuse the Supabase client, reuse `messages/*.json` via `i18n-js`, reuse Stripe server actions (via RevenueCat for mobile IAP).

You already have the Expo + NativeWind 4.2.3 + RevenueCat pattern working from Huh? — that carries over.
