# PACO i18n Architecture

Source of truth mirrored from Linear: `PACO — Provider & Multilingual Architecture (LLM / Voice / i18n) — growth-ready`  
Linear slug: `140781c608ed`  
Mirrored: 2026-06-09

## Contract

PACO launches bilingual with Spanish as the canonical source copy.

- ES is primary/canonical.
- EN is translated from ES, not the other way around.
- Future languages should be added by locale file + persona copy + voice map + supported-locale config.

## Rules

- No hardcoded user-facing strings in components.
- Locale is passed into AI calls as data, not baked into the system prompt forever.
- Bukowski and El Fantasma need localized character/tone, not literal translation only.
- Voice identity is per language: `{ locale -> voice_id }`.

## Acceptance

Adding Portuguese or another future language should not require new model/provider wiring.

