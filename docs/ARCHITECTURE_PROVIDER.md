# PACO Provider Architecture

Source of truth mirrored from Linear: `PACO — Provider & Multilingual Architecture (LLM / Voice / i18n) — growth-ready`  
Linear slug: `140781c608ed`  
Mirrored: 2026-06-09

## Principle

Every AI, voice, and copy surface is provider-agnostic and language-agnostic. Adding a language or swapping a provider should be config/content work, not a rewrite.

## Provider layers

1. UI copy lives in locale files.
2. AI reasoning/text uses provider interfaces and receives locale per call.
3. Voice/TTS uses a provider interface and a per-locale voice map.

## Current v1 decisions

- Scanner vision: OpenAI `gpt-4.1-mini`, pending Latin-food bake-off verdict.
- Coach / Bukowski / El Fantasma reasoning: Claude Sonnet via existing web coach path where applicable.
- TTS identity voice: ElevenLabs behind a `TTSProvider` interface; evaluate lower-latency/lower-cost providers for non-identity or realtime paths.
- Launch languages: ES + EN. ES is canonical; EN is translation.

## Growth contract

Adding a language should require:

1. New locale file.
2. Persona copy for Bukowski and El Fantasma in that language.
3. Locale-specific voice ID in a voice map.
4. Supported-locale config flip.

If adding a language requires rewriting provider code, the architecture failed.

## Cost guardrail

Voice and proactive AI are cost multipliers. Gate voice-heavy/proactive features behind spend caps and consider voice as Pro-tier where needed.

