# PACO Connected App Architecture

Source of truth mirrored from Linear: `PACO — Connected App Architecture: shared user-context, no re-asking, autonomous behavior`  
Linear slug: `ec22083b583b`  
Mirrored: 2026-06-09

## Principle

PACO is one organism, not disconnected screens. Every feature reads from and writes to shared user context so the user does not re-state what PACO already knows.

## Shared context includes

- Profile and goals.
- Dose schedule and recent doses.
- Today's logs: food, water, weight, sleep, symptoms.
- HealthKit signals on native: steps, active energy, weight trend.
- Recent patterns: mealtimes, coffee habit, dose-day hydration, frequent foods.
- Subscription tier and caps.

## Feature behavior

- Scanner knows goals, today's intake, dose context, and time of day.
- Coach opens with the day's logs, goals, and recent patterns.
- Today aggregates calories in/out, water, weight trend, and dose status.
- El Fantasma reads whole context and history as the Liahona arc.
- Logging screens write back to the shared tables and refresh context.

## Implementation shape

Build one shared context provider/store that batches key reads and refreshes on write. Avoid pairwise feature integrations that turn into N-squared spaghetti.

## Guardrail

Connect data freely. Gate proactive model calls behind spend caps.

