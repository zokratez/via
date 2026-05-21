# Mi Meta Shadow Spec

## Purpose

`Mi Meta` is PACO's quiet goal companion. Internally it can be thought of as `El Fantasma`: the observer twin to Bukowski. Bukowski talks. Mi Meta watches the rhythm and opens only when the user asks.

## Current SaaS Scope

- Dashboard-only for now.
- Fixed Liquid Glass pill near the lower-right edge, above the existing bottom controls.
- Default state is calm: no permanent green dot, no all-caps label, no location-pin feeling.
- The green check appears only when there is a new meaningful signal.
- Tapping the pill clears that signal locally with `mimeta_last_seen_signal_id`.
- The sheet opens as a solid iOS-style bottom sheet with internal scrolling.

## Signal Rules

Signals should be rare and useful. Generate a new signal only for:

- Weight trend direction change over a recent 7-day window.
- Dose-log streak milestones: 3, 7, 14, or 30.
- A 7-day weight checkpoint window.
- First-ever dose, weight, or symptom entry.

Do not create signals for routine absence of data, daily time checks, or guilt-style nudges.

## Copy Rules

- Observational present tense.
- Slightly literary, never bossy.
- No clinical claims.
- No exclamation marks.
- No bright warning colors.
- Avoid second-person commands.
- Prefer: "El peso bajó 0.4 kg en los últimos 7 días."
- Avoid: "Tienes que registrar tu peso."

## Design Brief

Design a calm Liquid Glass companion called `Mi Meta`. It should feel like the iPhone Search pill, but more private and quieter. Default state: 88px by 32px pill, subtle target icon, lowercase serif italic `Mi meta`, muted white text, brass icon, no green dot. Signal state: only an 8px muted sage circle with a tiny white check at the top-right. No pulse, no red, no amber, no notification energy.

The bottom sheet should feel native and restrained: solid dark surface, rounded top corners, small drag handle, one observational sentence, a brass progress bar with no numbers, up to three action rows, and a quiet footer: `Tu Fantasma no decide. Observa.`

## Native App Later

- HealthKit can feed steps, active energy, body mass, sleep, workouts, and routes.
- Widgets, Live Activity, App Intents, Siri, and Spotlight can reuse the same `Mi Meta` status model.
- Apple Watch data should enrich observations, not turn the feature into a nag.
