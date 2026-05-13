# CLAUDE.md — Working Agreement

**Product:** PACO Peptide — Spanish-first GLP-1 tracker + AI coach.
**Owner:** Sam (ooabi LLC). Single developer. Ship-fast mode.

## Hard rules (do not violate)

1. **Accuracy over agreement.** Push back before building. If the ask is wrong, say so.
2. **No guessing.** Research and verify before writing code. Never invent APIs, props, or dependencies.
3. **Read full files before editing.** No partial-file assumptions.
4. **One fix per commit.** Surgical only. No refactoring outside scope.
5. **No new dependencies without approval.** Ask before adding to package.json.
6. **Nothing costs money without approval.** No paid API calls in dev without a clear budget.
7. **Evidence-first.** Code compiling ≠ feature working. Track separately: code / local device / production verified.
8. **Spanish is the default locale.** English is fallback. All user-facing copy lives in `messages/es.json` first, then translated to `messages/en.json`. Never inline hardcoded copy.

## Tech stack (locked)

- **Framework:** Next.js 15 App Router (web landing + web dashboard)
- **Mobile:** Expo / React Native (same Supabase backend, same Spanish locale files)
- **UI:** Tailwind CSS + shadcn/ui (web), NativeWind 4.2.3 (mobile — matches Huh?)
- **DB + Auth:** Supabase (new project, do not reuse `vibe-lang`)
- **Payments:** Stripe (web subs) + RevenueCat (mobile subs, matches Huh?)
- **Email:** Resend
- **AI coach:** Claude Sonnet 4.6 via Anthropic API
- **Hosting:** Vercel (web) + EAS (mobile)
- **Domain:** apex `pacopeptide.com` 307 redirects to `www.pacopeptide.com` (canonical). Stripe webhooks must target www. Confirmed via Vercel Domains May 5 2026.
- **Analytics:** PostHog (funnels) + Plausible (public metrics)
- **i18n:** next-intl (web) + expo-localization + i18n-js (mobile)

## Dev setup

- Fresh git worktrees don't inherit `node_modules` from the parent. Run `npm install` the first time you enter any new worktree under `.claude/worktrees/` before `tsc`, `next dev`, or `next build` will work.

## What this product is

A companion app for people on GLP-1 medications (semaglutide, tirzepatide, liraglutide — branded OR compounded).

Investigational compounds in active clinical trials may be discussed at the level of published trial data only — retatrutide, cagrilintide, survodutide. No personalized dosing for any compound, approved or investigational. No sourcing guidance for investigational compounds.

It tracks:
- Dose log (which med, how much, when)
- Injection site rotation
- Weight + body measurements
- Side effects (nausea, fatigue, constipation, headache)
- Food intake against protein goals
- Hydration

Plus an AI coach (Claude Sonnet 4.6) that answers questions *within scope* — explicitly non-medical, explicitly not a prescriber.

- **Referral system:** `coach_referrals` Supabase table holds the vetted physician/provider list. Operator (Sam) populates and toggles `active=true` manually after vetting and consent. Bukowski reads via service role at request time when `REFERRAL_REQUEST` intent fires. Never hardcode names in prompt or code.

## What this product is NOT

- Not a pharmacy. We do not sell peptides. Not RUO, not compounded, not any form.
- Not a prescriber. We do not recommend doses, drugs, or treatment changes.
- Not a medical device. FDA wellness-app guidance applies; we stay on the "general wellness" side.

## AI coach guardrails (enforced at system prompt level)

The coach MUST:
- Refuse to recommend specific doses or dose changes.
- Refuse to diagnose side effects or medical conditions.
- Redirect to prescriber for personalized dosing decisions and individual medical questions. Do not use "consult a professional" as a filler disclaimer — the persistent footer already handles the not-a-doctor framing.
- Answer practical questions (protein targets, food ideas, hydration, injection rotation technique, side-effect coping strategies with lifestyle framing).

The coach MUST NOT:
- Endorse or recommend specific vendors, pharmacies, or unapproved sources.
- Discuss acquiring medication outside a prescription.
- Make weight-loss promises or guarantees.

## Diario publishing pipeline (locked)

Four-stage flow, fully cron-driven except for the human review step:

1. **Scrape** (`/api/cron/scrape-pubmed`, daily 06:00 UTC) — pulls the last 7 days of PubMed results for the locked peptide term list into `peptide_research_raw`.
2. **Draft** (`/api/cron/draft-articles`, daily 07:00 UTC) — picks up to 3 newest research rows not yet drafted, generates ES + EN article drafts via Claude Sonnet 4.5 with Bukowski-voice few-shot, inserts into `article_drafts` as `pending_review`.
3. **Review** (manual, Supabase SQL editor) — Sam reads each draft, sets `status='approved'` (or `'rejected'`) and `reviewed_at=now()` on the row. There is no UI; Supabase Dashboard is the editorial surface.
4. **Publish** (`/api/cron/publish-drafts`, every 4 hours) — picks up all `approved` drafts (capped 20/run), writes `.md` files to `src/content/articles/{language}/{slug}.md` via the GitHub Git Data API in a single atomic commit, then flips drafts to `status='published'` with the commit SHA recorded.

No force-push, no rebase, no PR flow. Sam's approval in step 3 IS the editorial gate; the publish cron just executes it.

## Ship checklist (gate for public launch)

- [ ] Auth works end-to-end (sign up → verify → log in → log out)
- [ ] Payments work (Stripe test + live, RevenueCat sandbox + prod)
- [ ] Webhook signatures verified (Stripe + RevenueCat)
- [ ] Spanish + English both pass visual QA
- [ ] Privacy policy + ToS live and linked
- [ ] PostHog events firing (signup, first_log, first_coach_query, subscription_start)
- [ ] Sentry connected for web + mobile
- [ ] Apple TestFlight build passes internal review
- [ ] Google Play internal track passes
- [ ] Landing page has Spanish hero + English toggle
