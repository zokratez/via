# PACO Product Roadmap

Living roadmap for launch polish and the next paid-product upgrades. Keep this file updated when Codex, Claude, or the user makes product decisions.

## Current Status

PACO is launch-ready for the original web SaaS checklist: public routes, protected routes, dashboard, coach, calculator, admin drafts/reviews, Stripe handoff, cron protection, and RLS isolation have been verified. The next work is product sharpness: make daily use easier, more visual, and more habit-forming.

## Pricing Channel Rules

- Current web SaaS: $7.99/month or $79/year with a 2-day Stripe trial.
- Future native iOS app: $9.99/month through Apple IAP / RevenueCat.
- Keep web pricing and App Store pricing documented separately so checkout, legal copy, and App Store listings do not drift.

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

## Private Progress Photos

Status: private upload/delete flow, same-angle comparison, on-demand AI visible-change analysis, and saved AI comparison reports are implemented. Clinician-shareable PDF/export reports are not implemented yet.

Safe product framing:
PACO observes patterns, estimates, explains possibilities, and helps users prepare better questions for their doctor. AI visual progress analysis compares private user photos over time and summarizes visible changes, trends, and questions the user may want to discuss with a clinician.

What it can do:
- Compare same-user progress photos over time.
- Summarize visible trend changes.
- Save AI comparison reports for later review.
- Correlate photos with weight, dose, symptoms, sleep, and notes.
- Produce an observer-style report a user can bring to a clinician.
- Let users delete photos.

What it should avoid:
- Claiming medical diagnosis.
- Identifying people or recognizing identity.
- Inferring sensitive traits.
- Making treatment decisions.
- Public posting without explicit user action.

## Food Calories And Macros

Status: private food logging, manual macro entry, AI meal photo scan, AI text-description estimates, barcode lookup, and repeat saved meals are implemented. Future native-depth work can feed the same `food_photos` log.

Safe product framing:
AI estimates food calories and macros from photos with confidence ranges. The user can edit the estimate before saving.

Suggested behavior:
- Show estimate as approximate.
- Ask for portion confirmation when uncertain.
- Save calories, protein, carbs, fat, and notes.
- Let Bukowski correlate food patterns with symptoms and weight trends.

Completed behavior:
- Photo optional: users can save a meal with only notes/macros.
- AI photo estimate fills editable calories, protein, carbs, and fat.
- AI text estimate works when the user describes the meal without a photo.
- Barcode lookup fills editable packaged-food nutrition from Open Food Facts.
- Saved meals can be repeated into today as private manual entries.
- Daily totals, 7-day rhythm, and dashboard food signal all use the same saved entries.

Next nutrition upgrades:
- Better portion prompts when confidence is low.

## Next Implementation: Cal AI-Style Nutrition Command Center

Goal:
Make `/food` feel like the daily nutrition cockpit, not just a meal log. The web version should deliver the core habit loop before native camera/HealthKit work starts.

Build now on web:
- Macro goal setup for calories, protein, carbs, and fat.
- Daily remaining targets: what is logged, what remains, and what is over/under.
- Large visual macro dashboard with rings/cards/bars that match PACO's dark espresso + brass language.
- Meal detail drilldowns from the dashboard and food page into saved entries.
- Clear labels for every macro field so mobile users never see unlabeled numbers.
- Better uncertainty prompts after AI food analysis, especially portion size, oil/sauce, sides, and hidden ingredients.
- Bukowski context injection from today's food totals so the coach can explain observed patterns with the same observer framing.

Defer to native:
- Live camera barcode scanning.
- Apple Health / Apple Watch activity integration.
- Depth/LiDAR-assisted portion estimates.

Safety:
- Always frame calories/macros as estimates unless manually entered from a label.
- Users review and edit before saving.
- No exact medical or body-composition claims from food data.
- Keep food photos and nutrition data private, deletable, and user-scoped.

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

PACO observes patterns, estimates, explains possibilities, and helps users prepare better questions for their doctor.
