# Product Requirements — GLP-1 Companion

## Positioning (one sentence)

The first Spanish-first companion app for the millions of people on GLP-1 medications — a bilingual dose tracker, symptom journal, and AI coach that helps you win the day, without replacing your doctor.

## Target user

- **Primary:** Spanish-speaking adult (US Hispanic or LATAM) on a GLP-1 drug, either branded (Ozempic/Wegovy/Mounjaro/Zepbound) or compounded. Has a prescription from a real provider. Wants help with the day-to-day: side effects, food, hydration, staying consistent.
- **Secondary:** English-speaking US adult on a GLP-1 who wants a lighter, less corporate alternative to Noom/MyFitnessPal.

## Why this wins

1. **Spanish is an unserved market.** Ozempic/Wegovy uptake in US Hispanic populations and Mexico is massive. Spanish-language companion tooling is near-zero.
2. **No regulatory cliff.** We don't prescribe, sell, or recommend drugs. We're a wellness tracker + wellness coach. Stays on the right side of FDA's general wellness policy.
3. **AI coach is the wedge.** Static log apps are boring. A Spanish-speaking AI that answers "me salté una dosis, ¿qué hago?" at 2am is the hook.
4. **Mobile-friendly pricing.** $9.99/mo undercuts Noom dramatically, sits at an impulse buy for the target demo.

## Core user journey

1. Land on `/es` from TikTok/IG/Reddit
2. Click "Empezar gratis" → magic-link signup
3. 3-question onboarding (medication, goal, current weight)
4. See dashboard with big primary actions: Log dose, Log weight, Ask coach
5. Log the first dose → small celebration
6. Ask the coach a question → see real value
7. Hit coach quota on day 2 → see paywall → convert

## MVP feature list (what we build in 7 days)

- Auth (email magic link + Google + Apple)
- Locale switcher (es / en)
- Dose log (with injection site rotation visual)
- Weight log (with simple chart)
- Side effect log (5 categories, 1-5 severity)
- AI coach (Claude Sonnet 4.6, guardrailed, Spanish-first)
- Free tier: 3 coach queries/day
- Pro tier: $9.99/mo or $59/yr, unlimited coach + PDF export
- Privacy policy + ToS + disclaimer footer

## Explicitly out of scope for MVP

- Mobile apps (web-responsive first, native in Week 2)
- Meal plans (Pro-only feature, Week 3)
- Doctor PDF export beyond basic (Week 2)
- Integrations with Apple Health / Google Fit (Week 4)
- Social / community (maybe never — moderation cost is high)
- Reminders / push notifications (Week 2, starts with email reminders)

## AI coach system prompt (first draft — lives in `lib/coach/system-prompt.ts`)

```
You are the Vía coach. You help people who are taking GLP-1 medications
(semaglutide, tirzepatide, liraglutide — branded or compounded) manage the day-to-day.

Respond in the user's locale ({locale}): Spanish (LATAM/Mexican register) or English.

You CAN help with:
- Practical food ideas, especially for managing nausea, early satiety, constipation.
- Protein target framing ("aim for X grams per day" as a general wellness guideline).
- Hydration guidance.
- Injection site rotation technique.
- Encouragement and accountability.
- Explaining what's in the user's own log (their recent doses, weight trend, symptom patterns).

You CANNOT and MUST NOT:
- Recommend a specific dose or dose change. Always: "Esto lo decides con tu médico."
- Diagnose a symptom. Always: "Si persiste o empeora, habla con tu médico."
- Recommend a specific pharmacy, vendor, or source for medication.
- Endorse "research use only" or underground peptide sources.
- Promise specific weight loss outcomes.

Tone: warm, direct, short. No fluff. No disclaimers at the start of every message — only when medically relevant. Use "tú" in Spanish, not "usted."

If the user asks something outside scope (unrelated to GLP-1 wellness), redirect gently.

If the user appears to be in medical crisis (severe symptoms, suicidal ideation), stop coaching and provide emergency resources for their country.
```

## Success metrics

- Week 1: 50 signups, 5 paying
- Month 1: 500 signups, 50 paying, $500 MRR
- Month 3: 5000 signups, 500 paying, $5000 MRR
- Month 6: 25000 signups, 2500 paying, $25000 MRR

## Risks & mitigations

- **App store rejection risk (later, for mobile):** Apple reviews wellness apps in this space carefully. Mitigation: disclaimers are explicit, no drug sales, no dose recommendations, clear "not a medical device" language in App Store listing.
- **User injury / lawsuit risk:** Mitigation: strict AI coach guardrails, explicit "not medical advice" everywhere, ToS with liability limits drafted by a lawyer before launch.
- **Copycat risk:** Mitigation: Spanish-first + voice + brand is defensible. Feature parity gets copied — brand doesn't.
- **GLP-1 market shrinks:** Mitigation: pivot the app to general "injection wellness" (TRT, peptide therapy, fertility injectables) — same infrastructure.
