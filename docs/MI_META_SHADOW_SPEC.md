# Mi Meta Shadow Spec

## Purpose

`Mi Meta` is PACO's persistent goal companion: a quiet shadow that follows the user through the product and surfaces the next useful action. It should feel like the iPhone Search pill, but for the user's own journey.

## Product Position

- User-facing name: `Mi Meta` / `My Goal`.
- Personality: calm, observant, practical, never alarmist.
- Role: connect logs, food, sleep, symptoms, progress, coach, and Diario into daily/weekly/monthly goal guidance.
- Safety boundary: no diagnosis, no treatment decisions, no body-fat certainty, no medical claims. It explains possible patterns and helps users prepare questions for a clinician.

## SaaS V1

- Add a constant floating Liquid Glass pill across user-facing pages.
- Open a small goal sheet with quick actions:
  - Dashboard status
  - Food/macros
  - Check-in
  - Bukowski
- Use a green check signal for helpful, non-urgent nudges.
- Keep the component global in the locale layout so future native app and HealthKit data can feed the same concept.

## SaaS V2

- Add `user_goals` table for weight target, protein target, step target, sleep target, hydration target, and weekly focus.
- Add `goal_signals` table for daily soft alerts such as low protein, missed check-in, low sleep, high symptom day, or new Diario article relevance.
- Add `/api/my-goal/status` to summarize current user status.
- Add Bukowski context injection so the coach can reference recent signals.
- Add goal-specific Diario recommendations.

## Native iOS Later

- HealthKit read permissions for steps, active energy, body mass, sleep, workouts, and routes.
- Widgets, Live Activity, App Intents, Siri, and Spotlight actions.
- Apple Watch signals feed the same `Mi Meta` status model.

## UX Rules

- It should be present but not annoying.
- Default pill state should be quiet, text-first, and elegant.
- The green check should not be permanent. It appears only when there is a new goal signal or useful alert.
- When shown, the alert indicator should be only a small green check mark, not a large badge or red-style notification.
- The open sheet must scroll inside itself on mobile so the page behind it does not trap the user.
- The visual direction should feel like iPhone Search/Spotlight: liquid glass, simple, restrained, and premium.
- Never use fear-based alerts.
- Always let the user decide what to do.
- Every insight should have a next action: log, read, ask Bukowski, or bring to doctor.

## Claude Design Brief

Design a calmer, more elegant `Mi Meta` companion for PACO Peptide. It should sit near the mobile bottom navigation like the iPhone Search pill, but it must be less loud than a notification. Default state: small glass pill with a subtle outline icon and the text `Mi Meta`. Alert state: show only a small green check mark when PACO has a new useful signal; otherwise no green check is visible. The sheet should feel like a premium iOS bottom sheet, scroll internally on small screens, and summarize the user's goal status plus next actions. Avoid medical diagnosis language. Tone: observant shadow, not nagging coach.
