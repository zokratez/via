# Codex QA Handoff

Use this file to restart PACO Peptide QA quickly without re-discovering the project.

## Product

PACO Peptide is a Spanish-first bilingual peptide journalism and AI coach platform. The trust position is no commerce: PACO does not sell peptides.

## Production

- Live site: `https://www.pacopeptide.com`
- Repo: `github.com/zokratez/via`
- Main locale: Spanish (`/es`)
- Admin routes: `/es/admin/drafts`, `/es/admin/reviews`
- Core private routes: `/es/dashboard`, `/es/coach`, `/es/calendar`, `/es/log/dose`, `/es/log/weight`, `/es/log/symptom`, `/es/log/sleep`

## Safe QA Order

1. Check `git status --short --branch` and latest commit.
2. Run production build with safe dummy Redis values:
   `UPSTASH_REDIS_REST_URL=https://example.com UPSTASH_REDIS_REST_TOKEN=dummy npm run build`
3. Smoke public routes: `/es`, `/en`, `/es/diario`, `/en/journal`, `/es/calculadora`, `/en/calculator`, `/es/privacy`, `/es/terms`, `/es/reviews/submit`, `/es/feed.xml`, `/en/feed.xml`.
4. Smoke protected redirects without cookies: `/es/dashboard`, `/es/coach`, `/es/admin/drafts`, `/es/admin/reviews` should redirect.
5. Confirm cron endpoints reject missing auth with `401`.
6. Visually test calculator examples and custom blank inputs.
7. Visually test coach response and PDF export with a safe educational question.
8. Visually test dashboard tiles, tabs, charts, alerts, and search.
9. Submit one clearly labeled QA review only when approved, confirm it appears in admin reviews, then reject it.

## Do Not Do Without Explicit Approval

- Do not approve or publish article drafts in production.
- Do not submit real dose, weight, symptom, or sleep logs unless the user asks.
- Do not run authenticated cron jobs with `CRON_SECRET` unless the user approves that exact run.
- Do not complete real Stripe purchases or subscription changes without approval.
- Do not ask for passwords, API keys, or one-time codes in chat.

## Current Hardening Notes

- Admin access is database-backed through `public.admin_users`.
- `ADMIN_FALLBACK_EMAILS` is optional and should only be used as temporary break-glass access.
- Public search returns article results for logged-out visitors; private results require auth.
- Calculator canonical paths are `/es/calculadora` and `/en/calculator`.
- Terms pricing should match `$79/year` and `$9.99/month`.
