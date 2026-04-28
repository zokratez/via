# First Cursor Prompt (paste into Cursor on Day 1, after repo is scaffolded)

## Context you give Cursor first

> Read `CLAUDE.md`, `.cursorrules`, `docs/PRD.md`, and `docs/SEVEN_DAYS.md` in this repo. Acknowledge you've read them. Do not start coding until you have.

Wait for acknowledgment. Then:

## Day 1 close-out prompt

> Day 1 task: scaffold the Next.js 15 App Router project with these specific additions:
>
> 1. Set up `next-intl` with routing for `/[locale]/...`. Default locale `es`, supported locales `["es","en"]`. Configure middleware, `i18n/routing.ts`, and `i18n/request.ts`.
> 2. Wire `messages/es.json` and `messages/en.json` (already in the repo) to `next-intl`. Do not hardcode any user-facing strings anywhere.
> 3. Set up Supabase SSR: create `lib/supabase/server.ts` (server client) and `lib/supabase/client.ts` (browser client), using `@supabase/ssr`. Read env vars from `process.env.NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
> 4. Create `/[locale]/page.tsx` as the landing page. Use the copy from the `landing` section of the translation files. Tailwind + shadcn Button. Hero, 3 feature cards, CTA.
> 5. Create `/[locale]/auth/sign-in/page.tsx` — magic link form that calls `supabase.auth.signInWithOtp`.
> 6. Create `/[locale]/dashboard/page.tsx` — server component that requires auth (redirects to sign-in if no session). Shows the `dashboard.greeting_*` string based on time of day with the user's name from `profiles`.
> 7. Add a tiny `LocaleSwitcher` component in the header — toggles between `/es/...` and `/en/...` preserving the current path.
>
> Deliverables:
> - Complete code for every new file.
> - A list of exact `npm i` commands I should run.
> - The exact env vars I need to set.
> - The `middleware.ts` content.
>
> Do not skip RLS — the Supabase migration is already applied. Confirm you'll respect that.

## Good patterns to keep using across days

- Always reference `CLAUDE.md` and `docs/PRD.md` at the start of each new session.
- Ask Cursor: "Before you edit, list the files you'll touch." Makes scope visible.
- After each feature: "Write a one-paragraph summary of what you changed and why, for the commit message."
- When stuck: paste the exact error + "Explain the root cause in two sentences before proposing a fix."
