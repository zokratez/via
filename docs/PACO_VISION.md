# PACO Peptide Product Vision

Version 1.0  
Date: June 3, 2026  
Author: Sam Oteo with Claude/Codex

Use this as the durable north-star document for future PACO Peptide build dispatches. When scope, framing, sequencing, copy, or design direction is unclear, read this first.

## Product Principle

PACO observes patterns, estimates, explains possibilities, and helps users prepare better questions for their doctor.

This sentence governs product copy, AI outputs, marketing claims, and all medical-adjacent language. PACO is not a doctor, does not diagnose, does not prescribe, and does not tell users what to do with their bodies. PACO observes, estimates, explains, and prepares users to have informed conversations with clinicians.

Every feature in this document serves this principle.

## What PACO Is

PACO Peptide is a Spanish-first AI health companion that helps people on GLP-1 and peptide therapy understand their day. It exists in two forms.

### Web SaaS

Current product: [pacopeptide.com](https://www.pacopeptide.com), shipped May 18, 2026.

- Stack: Next.js 16.2.4, Supabase, Stripe, Anthropic SDK, Vercel.
- Pricing: $7.99/month or $79/year with a 2-day Stripe trial.
- Bukowski AI coach: 3 messages/day free, unlimited Pro.
- Daily logging: doses, weight, food, water, sleep, symptoms, photos.
- AI food estimation: photo, text, and barcode.
- Visual progress photo comparison with AI analysis.
- Peptide reconstitution calculator.
- Journalism content pipeline: PubMed scrape to AI draft to manual review.

### Native iOS App

Planned and parked behind web polish.

- Stack: Expo / React Native, RevenueCat IAP.
- Pricing: $9.99/month.
- HealthKit and Apple Watch deep integration.
- El Fantasma: ambient companion across four iOS surfaces.
- Voice-first interaction with OpenAI Realtime and ElevenLabs Spanish.
- Cal AI-style food scanning with LiDAR depth on supported Pro devices.
- Bundle ID: `com.ooabisabi.pacopeptide`.
- App Group: `group.com.ooabisabi.pacopeptide`.

The web product is the current build focus. Native is planned, scoped, and parked. Both share the same Supabase backend and the same product principle.

## Who PACO Is For

Primary users are Spanish-speaking adults on GLP-1 medications or peptide therapy who want to track their journey, understand their daily status, and have better conversations with their doctor.

Examples include semaglutide, tirzepatide, retatrutide, liraglutide, BPC-157, TB-500, and adjacent research compounds.

Secondary users are English-speaking peptide users underserved by competitor apps that treat GLP-1 like generic weight loss.

PACO is not for people seeking diagnosis, prescription, dosing advice, or medical decisions. PACO redirects those decisions to clinicians.

## What Makes PACO Defensible

PACO owns four intersections competitors do not currently own together.

- Spanish-first peptide-literate doctor-deferral coaching. GLP-1 trackers are not Spanish-first; Spanish wellness apps are not peptide-aware; PACO combines both with an observer persona.
- El Fantasma ambient companion pattern. A persistent low-attention presence that knows the user's day from HealthKit and speaks voice-first in Spanish.
- Peptide dose intelligence tied to outcomes. Native can eventually correlate dose timing with weight, side effects, sleep, food, and activity patterns.
- Cal AI-parity food scanning fused with full-pillar coaching. Cal AI focuses on food. PACO owns the intersection of food, peptides, vitamins, nutrition, exercise, water, meditation, and daily context.

## Design Language

The visual identity is warm dark editorial: espresso background, brass accent, Iowan Old Style serif for editorial voice, and system sans for UI.

Existing base tokens in `src/app/globals.css`:

- `--pp-bg: #1a1614`
- `--pp-surface: #221c19`
- `--pp-border: #3d342e`
- `--pp-text: #f4ede0`
- `--pp-text-secondary: #a89788`
- `--pp-text-tertiary: #6b5d52`
- `--pp-accent: #c9966b`
- `--pp-font-serif: 'Iowan Old Style', Palatino, Georgia, serif`
- `--pp-font-sans: -apple-system, BlinkMacSystemFont, ...`

### Metric Color System

Each metric gets the same color everywhere in the app: charts, log forms, notifications, widgets, and Watch complications.

- Protein: `#d99a5b`, dusty rust.
- Water: `#5dcaa5`, seafoam teal.
- Steps: `#97c459`, sage green.
- Calories: `#ef9f27`, warm amber.
- Sleep: `#7f77dd`, night violet.
- Weight: `#ed93b1`, muted rose.
- Dose: `#c9966b`, brass.
- Symptom: `#d85a30`, terracotta.

Each metric also needs `-tile`, `-border`, and `-text` variants.

### Apple Health-Style Tiles

- 18px border radius.
- Tinted dark fill using the metric tile token.
- Outline icon top-left.
- Badge top-right.
- Large serif number.
- Two-line label below.
- Glass-edge shimmer via layered box-shadow.

### Liquid Glass

Liquid Glass belongs on floating chrome only: search pill, floating action buttons, sheets, tab indicators, and future native surfaces.

Liquid Glass does not belong on content: cards, tiles, and list items should use solid tinted surfaces.

Respect `prefers-reduced-transparency` with solid-color fallbacks.

The existing `GlobalSearch.tsx` search pill is shipped and locked. Do not modify it without explicit Sam approval.

### Motion

- Tile press: `scale(0.97)` with an 80ms transition, then spring back.
- Tile hover: `translateY(-1px)` with brighter shimmer.
- Number count-up on first paint of the day, 600ms.
- Stagger card fade-in 60ms apart on Today screen load.
- Bukowski pilcrow: soft breathing pulse when there is a new insight.
- Respect `prefers-reduced-motion` with opacity crossfades only.

## 4.5 MEASUREMENT HONESTY — WHAT WEB CAN AND CANNOT TRACK

PACO only displays metrics it can truthfully measure. A health app that 
shows fake or placeholder numbers destroys trust. This rule governs 
which metric tiles appear on web vs native.

WEB (PWA at pacopeptide.com) — can only track what the user logs:
  - Food (calories CONSUMED, macros) — manual + photo + barcode entry
  - Weight — manual entry or future Bluetooth scale
  - Doses, Sleep, Symptoms, Water — manual log
  A web app in Safari CANNOT read the iPhone pedometer, heart rate, or 
  any HealthKit data. This is an Apple privacy boundary, not a bug. Do 
  not build a steps tile, calories-burned tile, HRV tile, or any 
  sensor-derived metric on web. They would only show fake data.

NATIVE iOS (paco-mobile) — adds everything HealthKit provides:
  - Steps (real, HKQuantityType.stepCount)
  - Calories BURNED (real, .activeEnergyBurned + .basalEnergyBurned, 
    computed by Apple from heart rate + weight + motion, NOT a crude 
    step multiplier)
  - Heart rate, HRV, sleep stages, walk auto-detection
  Only on native can PACO show the full calories-in vs calories-out 
  daily picture.

TILE RULES:
  - The "calorías" metric on web is calories CONSUMED (from food), and 
    must be labeled so users never mistake it for calories burned.
  - Steps and calories-burned tiles are NATIVE-ONLY. On web, show a 
    "próximamente con la app / coming soon with the app" placeholder 
    that is clearly NOT a real number.
  - Never display a sensor-derived metric on web with placeholder data 
    styled to look real.

This is a direct application of the product principle: PACO can only 
observe what it can actually measure.

## Information Architecture

Principle: one flow per day, three surfaces always reachable.

### Today

The only page that matters when the app opens.

- The Verdict: Bukowski one-liner describing where the user stands today.
- Six metric tiles in a 2x3 grid: protein, water, steps, calories, sleep, weight.
- Pinned dose strip with next injection and countdown.
- Bukowski paragraph with today's pattern observation.

### Log

Universal entry verb, eventually exposed as a bottom-center brass plus button.

The Log sheet contains eight options:

- Dosis
- Comida
- Peso
- Agua
- Sueño
- Síntoma
- Progreso
- Nota

Each option uses its metric color for the icon. Tap opens the right form, saving returns the user to Today.

### Bukowski

Always one tap away. When opened from Today, Bukowski's first line references what is logged today. Bukowski may pulse softly when there is a new pattern to share.

### Drilldowns

- Protein tile: `/food`
- Water tile: `/log/water`
- Steps tile: `/steps`
- Calories tile: `/food`
- Sleep tile: `/log/sleep`
- Weight tile: `/weight`
- Dose strip: `/calendar`
- Bukowski paragraph: `/coach`

Other pages remain accessible but de-emphasized: `/calendar`, `/admin`, `/calculator`, and `/journal`.

## Food Command Center

Linear: `SAM-46`.

This is the next major feature after dashboard refresh. It is the Cal AI-style nutrition cockpit. It lives at `/food` and is reached from the universal Log sheet or by tapping Protein/Calories on Today.

### Food Command Center Structure

- Hero: calories remaining as a single big serif number.
- Macro bars: protein, carbs, fat, and fiber using metric colors.
- Today's meals as cards with thumbnail/icon, meal name, time, calories, macro breakdown, and confidence badge.
- Bukowski food strip: two-line observation connecting food to peptide context, with clinician deferral where health-adjacent.

### Web Phase

- Manual entry.
- AI photo estimate.
- AI text estimate.
- Barcode lookup.
- USDA FoodData Central as macro ground truth.
- Per-user correction learning.
- Explicit confidence ranges.

### Native Phase

Deferred to native research.

- Live camera barcode.
- LiDAR depth-assisted portion estimation on supported Pro devices.
- HealthKit nutrition write-back.

## Native iOS App

Native remains parked until the web product is polished and `SAM-46` has real user engagement data.

### El Fantasma Four Surfaces

- In-app floating Liquid Glass pill.
- Lock Screen and Home Screen widgets.
- Live Activity / Dynamic Island.
- Spotlight and Siri via App Intents.

### HealthKit Tier 1

- Step count.
- Active and resting energy.
- Heart rate and zones.
- HRV.
- Sleep stages.
- Weight and body composition from compatible sources.
- Water.
- Mindful minutes.
- Walk auto-detection.
- Medication events, if current Apple APIs support the required use case.

### Apple Watch

- Complications: water ring, next dose, daily status, steps.
- Native Watch app: quick log water/dose, start mindful, voice prompt.
- Background HealthKit delivery where supported.

### Voice

- OpenAI Realtime API for low-latency conversation.
- ElevenLabs Spanish for Bukowski's voice when the premium tier reaches it.
- Voice is always optional and never required.

### Native Pricing

- $9.99/month Apple IAP through RevenueCat.
- Apple Small Business Program target commission: 15%.
- Free tier: dose log, basic HealthKit weight, calendar reminders, side effects.
- Premium: Bukowski coaching, El Fantasma full features, food map, PDF exports, AI correlations, multi-medication.

## Build Sequence

### Phase 1: Docs And Tickets

- Reframe wording to observer voice across all docs.
- Create four planning tickets in Linear.
- No UI code yet.

### Phase 2: Visual Upgrade Of Existing Dashboard

- Add per-metric color tokens to `globals.css`.
- Build `MetricTile` component with Apple Health style and glass-edge shimmer.
- Refactor dashboard cards onto `MetricTile`.
- Refactor dose strip and Bukowski paragraph.
- Stage Liquid Glass utility classes for future use.

### Phase 3: Today Screen Redesign

- Rebuild dashboard as Today: verdict at top, 2x3 metric grid, pinned dose strip, Bukowski paragraph.
- Ship behind a feature flag.
- Keep existing dashboard live until ready.
- Add drilldown screens for each metric tile.

### Phase 4: Bottom Nav And Log Sheet

- Three-surface bottom nav: Today, Log, Bukowski.
- Brass plus button as universal Log entry.
- Eight-verb log sheet.
- Existing log forms should be reused wherever possible.

### Phase 5: Cal AI-Style Food Command Center

- Calorie hero.
- Four macro bars.
- Meal list.
- Bukowski food strip.
- USDA FoodData Central integration.
- Per-user correction learning.
- Explicit confidence surfaces.

### Phase 6: Onboarding And Paywall Experiments

- Superwall integration research.
- First three experiments: trial length, paywall placement, anchor pricing.

### Phase 7: Native iOS App

- Unpark native only after web product polish and `SAM-46` engagement data.
- Start from `docs/PACO_NATIVE_PLAN.md`.
- Follow `docs/PACO_NATIVE_SAFETY.md`.
- Build El Fantasma four surfaces.
- Build HealthKit Tier 1 integrations.
- Add Apple Watch app and complications.
- Add voice-first ghost.
- Add Cal AI-parity food scan with LiDAR when available.

## Planning Tickets

### Ticket A: Native Safety And Compliance Plan

Output: `docs/PACO_NATIVE_SAFETY.md`.

- Apple Guideline 1.4.1 lane.
- Third-party AI consent language.
- In-app disclaimer copy in Spanish and English.
- HealthKit read vs write scope.
- Data retention and deletion policy.

### Ticket B: Consolidate Native iOS Master Plan

Output: `docs/PACO_NATIVE_PLAN.md`.

- Source from the May 21, 2026 El Fantasma spec.
- HealthKit Tier 1.
- Apple Watch.
- El Fantasma four surfaces.
- Pricing.
- Single durable doc for native unpark.

### Ticket C: Nutrition Data Upgrade

- USDA FoodData Central as macro ground truth.
- Per-user correction learning.
- Confidence ranges.
- Spanish-language Latino cuisine fixture set.

### Ticket D: Paywall And Onboarding Experiment Plan

Output: `docs/PACO_PAYWALL_PLAN.md`.

- Superwall integration research.
- First three experiments scoped.
- Queued for month 3.

## Future Build Rules

### Voice And Copy

- Observer framing, never advisor framing.
- Use ask-your-doctor language at the end of health-adjacent statements, not as a cold opener.
- Bukowski is a journalist, not a clinician.
- No exact percentages of body fat, fat loss, muscle loss, disease risk, or medication efficacy from photos or AI inference.
- Frame estimates as estimates, with confidence ranges.

### Visual

- Every metric uses its locked color everywhere.
- Glass on chrome only, never on content.
- Brass is reserved for dose, CTAs, and Bukowski's pilcrow.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Mobile-first QA on real iPhone Safari before declaring done.

### Code

- One commit per logical change.
- Build before commit.
- Push to `main`.
- Do not touch existing tokens or shipped components without explicit Sam approval.
- Do not modify `GlobalSearch.tsx` without explicit Sam approval.
- Pause and ask if a dispatch is ambiguous or conflicts with current repo state.

### Cost

- Nothing costs money without Sam approval.
- Anthropic API has a spend cap.
- Bukowski free tier is 3 messages/day to control cost.
- No new third-party services without scoped ticket and budget.

### Privacy

- Default private.
- No public sharing without explicit opt-in.
- RLS on every user-data table.
- Server routes verify row ownership before reading private Supabase storage objects.
- Users can delete entries and photos at any time.
- All AI provider data flow must be disclosed in privacy copy.

## What This Document Is Not

This is not a build dispatch. It does not direct Codex to execute any specific step today. It is the reference map every future dispatch is written against.

When a dispatch says "build the Today screen," this document defines what the Today screen is, what it contains, what color the tiles are, what font the verdict uses, and how it relates to the rest of the product. The dispatch itself contains the concrete commit-level work.

When in doubt, read this first.
