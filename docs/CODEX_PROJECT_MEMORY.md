# Codex Project Memory

Use `docs/PACO_VISION.md` first, then this file alongside `docs/CODEX_QA_HANDOFF.md` and `docs/PACO_PRODUCT_ROADMAP.md` when restarting PACO Peptide work.

## Operating Mode

- Work from `/Users/samoteo/Code/via`.
- Check `git status --short --branch` before edits.
- Keep changes focused, build before committing, then push to `main`.
- Preferred build command:

```bash
UPSTASH_REDIS_REST_URL=https://example.com UPSTASH_REDIS_REST_TOKEN=dummy npm run build
```

- Protected live API smoke checks should return `401` when logged out. A `404` usually means the deployment has not reached production yet or the route is missing.

## Product North Star

PACO Peptide should feel like a private, Spanish-first command center for peptide journalism, Bukowski coaching, GLP-1 tracking, nutrition, and visual progress. The product earns trust by not selling peptides or vendors.

## Pricing Memory

- Web Stripe checkout: $7.99/month or $79/year with a 2-day trial.
- Future Apple native app: $9.99/month through Apple IAP / RevenueCat.
- Do not change one channel's price when updating the other; web and native pricing are intentionally different.

## UX Rules

- Mobile-first. Most real QA happens on iPhone.
- Preserve the dark espresso, brass, editorial visual language.
- Buttons, cards, and graphs should feel alive with tasteful hover/tap motion.
- Never rely only on placeholders for important fields. Mobile users need persistent labels.
- Dashboard should connect every feature into one daily habit loop.

## AI Safety Rules

- PACO observes patterns, estimates, explains possibilities, and helps users prepare better questions for their doctor.
- Food-photo analysis may estimate calories/macros, but users must review and edit before saving.
- Progress-photo AI may describe visible, non-sensitive changes and photo-quality limits.
- Do not claim exact fat loss, muscle loss, body-fat percentage, diagnosis, disease, swelling, pregnancy, age, attractiveness, identity, ethnicity, mental state, or health status from photos.
- For body composition, frame output as a visual trend only and recommend DEXA, BodPod, InBody, calipers, or a clinician for true measurement.
- Update privacy copy whenever photos or user data are sent to an AI provider.

## Migration Discipline

- Migrations that add NOT NULL columns must ship with synchronized app code that populates the column on every insert, OR a column default, OR a backfill UPDATE before the constraint applies.
- When code stops requiring a foreign-key relationship, drop NOT NULL on that FK column in the SAME migration, not a later hotfix.
- Migration files committed to the repo are NOT auto-applied to production. Either apply via Supabase MCP or hand Sam the SQL to paste into the dashboard SQL Editor.
- "Build passed" != "feature works." Verify the affected user flow in production before declaring shipped.

## Commit Protocol (two-tier)

Default to BUILD-AND-COMMIT in one shot, QA after. Pre-flight-and-confirm ONLY when a change hits a RISK GATE.

RISK GATES (require pre-flight -> Sam confirms -> then build):

- Schema changes / migrations (anything touching the database structure)
- Shared components used by multiple routes (e.g. MobileBottomNav, layout)
- Live routes real users hit (/dashboard, /coach, /food, /log/*, etc.)
- Anything irreversible or hard to revert
- Anything that could change behavior for paying users

SAFE (build, commit, push, then Sam QAs - NO pre-flight stop):

- New isolated files/components nothing else imports yet
- Contained changes on flag-hidden routes (e.g. /today while flagged)
- Copy/i18n edits, styling on non-shared elements
- Single-file changes with no shared blast radius

ALWAYS, regardless of tier:

- Report git tip before building
- Surgical scope, one logical change per commit
- Read full files before editing, read diff before commit
- Report any new i18n keys (ES+EN)
- If a "safe" task turns out to touch a risk gate mid-build -> STOP and report

Sam confirmed this protocol June 4, 2026. Graduate toward fewer stops as the loop proves reliable; do NOT commit directly to main without showing pre-flight on risk-gate changes.

## Premium Polish Backlog — apply when Today/web is near-final, before native

Source: "5 invisible details that make an app feel premium." These are the "feels right" decisions to apply once core function is done. NOT to be done mid-launch. Web-fixable items first; native-only items deferred to the iOS build.

WEB-FIXABLE (do as a polish pass before declaring web done):

1. Keyboard behavior on loggers (dose/weight/water/sleep/symptom forms): verify the input is never covered by the keyboard, the save button stays visible, scroll accounts for keyboard height, dismiss feels intentional. This is the "separates serious devs" item — highest-value web polish. UNVERIFIED as of launch — must QA each logger form on a real phone.
2. Loading states on Today + loggers: replace any spinner/blank with skeleton-shimmer that outlines the content shape. Empty states already good ("Toca para registrar", recede, "próximamente") — keep those.
3. Press states: web tiles have hover/active lift+scale (decent). Verify the ~100ms physical press response feels right on tap, not just hover.

NATIVE-ONLY (defer to iOS app build — impossible on web):

4. Haptics: success on log-save, soft tick on toggle, confirm on dose-save. Rule: haptics confirm state changes/decisions ONLY — never nav/scroll/idle. (expo-haptics or react-native-pulsar when native.)
5. True spring press physics: iOS 26 Liquid Glass gives this free natively; Android/older needs a press-animation lib. Native gets this automatically.

Principle from the source: premium = stacking ~20 invisible decisions, not flashy animation. Subtle only — animate ONLY when motion answers a question the user just asked (150–300ms). PACO already avoids over-animation; keep it.

## Current Feature Map

- Dashboard: command center with dose, sleep, food, progress, symptoms, coach, weekly rhythm signals.
- Food: private photo upload/delete, optional-photo manual meals, AI photo/text meal estimates, barcode nutrition lookup, repeat saved meals, editable calories/protein/carbs/fat, daily totals, weekly rhythm, daily insight.
- Progress: private progress photos, angle stats, side-by-side comparison, on-demand AI visible-change analysis, saved AI comparison reports.
- Coach: Bukowski conversation flow, history, PDF export.
- Calculator: peptide syringe/math tool.
- Admin: article drafts and reviews moderation.

## Data And Privacy Rules

- Use RLS-protected tables for user data.
- Server routes must verify row ownership before reading private Supabase storage objects.
- Prefer passing row IDs from the browser, then resolving rows server-side under the signed-in user.
- Do not treat client-supplied storage paths as authority.
- Any future sharing or use-case permission must be explicit opt-in.

## Next Safe Build Ideas

- Persist AI progress analysis results so users can revisit them.
- Add camera-based barcode scanning later if native/PWA support is worth it. Manual barcode lookup is complete.
- Add a single daily check-in flow that gathers food, progress, sleep, symptoms, weight, and Bukowski question in one pass.
- Add richer chart drilldowns from dashboard tiles into the underlying logs.
- Build the Cal AI-style nutrition command center on web next: macro goals, remaining targets, visual rings/cards, meal drilldowns, portion uncertainty prompts, and Bukowski food context. Defer live barcode camera, HealthKit, and depth/LiDAR to native.
