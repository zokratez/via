# PACO Product Roadmap

Living roadmap for launch polish and the next paid-product upgrades. Keep this file updated when Codex, Claude, or the user makes product decisions.

## Current Status

PACO is launch-ready for the original web SaaS checklist: public routes, protected routes, dashboard, coach, calculator, admin drafts/reviews, Stripe handoff, cron protection, and RLS isolation have been verified. The next work is product sharpness: make daily use easier, more visual, and more habit-forming.

## Immediate UX Polish

- Dashboard command center: complete.
- Colorful weekly rhythm graph: complete.
- Premium hover/tap motion for dashboard cards, action buttons, and graph cells: in progress.
- Mobile bottom navigation: next recommended flow improvement.
- Single daily check-in flow: first-pass guided hub complete.

## Next Core Feature: Daily Check-In

Goal: one guided flow that lets a user quickly log the day without thinking about where to go.

Suggested fields:
- Weight
- Dose taken or skipped
- Symptoms
- Sleep
- Food note or food photo
- Progress photo
- One question for Bukowski

Privacy rules:
- Default private.
- No public sharing by default.
- User can delete entries and photos.
- Any use-case sharing must be explicit opt-in.

## Future Feature: Private Progress Photos

Status: Phase 1 private upload/delete flow implemented. AI comparison and doctor-ready reports are not implemented yet.

Safe product framing:
AI visual progress analysis compares private user photos over time and summarizes visible changes, trends, and questions the user may want to discuss with a clinician. It is not medical diagnosis and does not replace a licensed professional.

What it can do:
- Compare same-user progress photos over time.
- Summarize visible trend changes.
- Correlate photos with weight, dose, symptoms, sleep, and notes.
- Produce a doctor-ready report.
- Let users delete photos.

What it should avoid:
- Claiming medical diagnosis.
- Identifying people or recognizing identity.
- Inferring sensitive traits.
- Making treatment decisions.
- Public posting without explicit user action.

## Future Feature: Food Photo Calories And Macros

Status: Phase 1 private food photo/manual macro tracking in progress. AI estimates are not implemented yet.

Safe product framing:
AI estimates food calories and macros from photos with confidence ranges. The user can edit the estimate before saving.

Suggested behavior:
- Show estimate as approximate.
- Ask for portion confirmation when uncertain.
- Save calories, protein, carbs, fat, and notes.
- Let Bukowski correlate food patterns with symptoms and weight trends.

## Future Feature: Native Depth-Assisted Portions

Status: parked for native-app research. Do not build into the web/PWA first pass.

Idea:
Use supported phone depth/LiDAR signals in a future native iOS/Android app to improve portion and volume estimates for meal photos.

Why later:
- Normal mobile web/PWA access to depth/LiDAR is limited and inconsistent.
- Native implementation may be needed.
- Depth data may improve volume estimates, but the product still needs AI analysis plus user confirmation.

Acceptance criteria for future research:
- Confirm whether current iOS/Android APIs can access useful depth data from food photos.
- Test whether depth-assisted estimates are meaningfully better than AI image estimate plus portion confirmation.
- Keep all depth/photo data private, deletable, and user-scoped.
- Never present estimates as exact nutrition facts.

## Product Principle

PACO should feel like a private command center: beautiful enough to use daily, precise enough to trust, and careful enough not to pretend it is a doctor.
