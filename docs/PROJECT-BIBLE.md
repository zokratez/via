# PACO PEPTIDE — PROJECT BIBLE
## Complete Build Record, Lessons Learned, Reusable Patterns

**Last updated:** May 13, 2026  
**Entity:** ooabi LLC (Eagle Mountain, UT)  
**Domain:** pacopeptide.com ($11.48/yr Namecheap, WhoisGuard)  
**Repo:** github.com/zokratez/via → ~/Code/via  
**Stack:** Next.js 16.2.4 Turbopack, TypeScript, Supabase Pro, Anthropic SDK (Sonnet 4.5), Stripe, Upstash, Vercel Hobby  

---

## 1. WHAT WAS BUILT (Days 1–12)

### Infrastructure
| Component | Detail | Commit/Date |
|---|---|---|
| Domain | pacopeptide.com, canonical at www, apex 307→www | Day 1 |
| Hosting | Vercel Hobby tier, auto-deploy from GitHub | Day 1 |
| Database | Supabase Pro (vrxmnuvedakrrpvetybq), us-west-1, no auto-pause | Day 1 |
| Auth | Supabase magic link, no passwords | Day 1 |
| Payments | Stripe live (acct_1T1xaHC0ioyOCtQF) | Day 6–8 |
| Rate limiting | Upstash Redis, 30/hr free, pro bypass | Day 9 |
| Legal | Privacy + Terms ES/EN, updated Day 12 with AI/Upstash/retention disclosures | Day 6, updated Day 12 |

### Payments (Stripe)
| Plan | Price | Price ID |
|---|---|---|
| Annual | $79/yr | price_1TW0RjC0ioyOCtQFITaFq8wX |
| Monthly | $7.99/mo | `STRIPE_PRICE_ID_VIA_PRO` must point at the live $7.99 Stripe Price |
| Free trial | 2 days on both | — |
| Webhook | we_1TUgE1C0ioyOCtQFa0z7yX7O at www.pacopeptide.com/api/stripe/webhook | Day 8 |

### Future Native App Pricing

The web SaaS and native app pricing are intentionally different:
- Web Stripe checkout: $7.99/mo or $79/yr, 2-day trial.
- Future Apple App Store IAP / RevenueCat: $9.99/mo. This accounts for App Store economics and should not overwrite the web Stripe price.

**LESSON:** Stripe webhooks don't follow 3xx redirects. Apex pacopeptide.com 307s to www. Webhook endpoint MUST target canonical host (www). This caused 100% failure rate on first attempt.

### Content Pipeline (Fully Automated)
| Cron | Schedule | What it does |
|---|---|---|
| scrape-pubmed | 0 6 * * * (6am UTC) | Pulls 10 peptide papers from PubMed → peptide_research_raw |
| draft-articles | 0 7 * * * (7am UTC) | AI drafts ES+EN articles from raw research → article_drafts (status: pending_review) |
| publish-drafts | 0 14 * * * (2pm UTC) | Commits approved drafts to GitHub via Git Data API → deploys automatically |

**LESSON:** Vercel Hobby tier only allows daily crons. `0 */4 * * *` (every 4h) caused silent deploy failures — every push after that commit was rejected. Root cause took hours to find. Always check Vercel tier limits before setting cron schedules.

**LESSON:** Auto-deploy broke because the cron schedule was invalid for Hobby tier, NOT because the GitHub webhook was broken. Red herring consumed significant debugging time.

### AI Coach (Bukowski)
| Feature | Detail |
|---|---|
| Model | claude-sonnet-4-5-20250929 via Anthropic SDK |
| System prompt | 3-tier compound architecture |
| Tier 1 | Full coaching: semaglutide, tirzepatide, liraglutide |
| Tier 2 | Educational only: retatrutide, cagrilintide, survodutide, CagriSema |
| Tier 3 | On-demand: BPC-157, TB-500, KPV, GHK-Cu, MOTS-c, Epitalon, NAD+, etc. |
| Scope | Strictly peptides + surrounding topics. Off-topic → redirect |
| Posture | Lead with value, disclaimers at end. Never gatekeep responses. |
| Hard rules | No 503A/503B recommendations, no vendor names, no reconstitution for non-prescribed, no personal dosing for Tier 2/3 |
| Rate limit | 30/hr free, unlimited Pro |
| PDF export | Pro only, jsPDF via CDN, Bukowski voice in PDF |
| Cost | ~$0.02/message (Sonnet 4.5) |

**LESSON:** Hit Anthropic $50/mo org spend cap — coach returned 400 "usage limits reached" but the error was displayed as generic "Algo no salió." Always add specific error handling for API spend caps vs real outages. Raised to $100/mo.

### Dashboard
| Feature | Status |
|---|---|
| Greeting | Serif italic, time-of-day aware |
| Stat cards | Last Dose, Weight, Streak — dark surface, brass accents |
| Action tiles | Log dose, Log weight, Log symptom, Talk to Bukowski (brass-filled CTA) |
| Weight chart | Recharts, 30-day view, themed tooltip (dark + brass) |
| Locale switcher | ES/EN toggle |
| Style | Full dark warm theme (--pp-* tokens) |

### Content Live
| Article | Language | Source |
|---|---|---|
| bienvenida / welcome | ES + EN | Manual (Day 1) |
| lo-que-sabemos-de-retatrutide / what-we-know-about-retatrutide | ES + EN | Manual |
| el-terreno-esta-cambiando / the-ground-is-shifting | ES + EN | Manual (Day 12) |
| 2 tirzepatide articles (from PubMed pipeline) | ES + EN each | Automated (Day 11) |
| 4 additional articles (from PubMed pipeline) | ES + EN each | Automated (Day 12) |
| **Total: ~9 articles, 18 files** | | |

### SEO & Social
| Item | Status |
|---|---|
| OG image | 1200×630 PNG, dark espresso + brass, "Bukowski sin censura" |
| Sitemap | Auto-generated via sitemap.ts |
| robots.txt | Live |
| RSS feeds | /es/feed.xml + /en/feed.xml, auto-discovery in head |
| hreflang | Alternates on all pages |
| Social | @pacopeptide on X, Instagram, TikTok (claimed Day 12) |
| Newsletter | Email capture on homepage, server-validated insert into newsletter_signups |

### Admin
| Feature | Detail |
|---|---|
| Route | /[locale]/admin/drafts |
| Auth | Database-backed admin allowlist (`public.admin_users`) with optional env break-glass fallback |
| Actions | Approve / Reject pending_review drafts |
| Defensive | Status filter prevents double-actioning (409 if already actioned) |

### Database Tables (7 migrations applied)
1. init (profiles, doses, weight_entries, side_effects, medications, coach_messages, coach_threads)
2. (various intermediate)
3. coach_referrals (empty, manual population)
4. (various)
5. peptide_research_raw
6. article_drafts
7. newsletter_signups

---

## 2. WHAT'S NOT BUILT YET

### Day 13 — Feature Builds (Prioritized)
1. **Peptide reconstitution calculator** — standalone free page at /es/calculadora, /en/calculator. Pure client-side math, no API cost. SEO magnet. Visual syringe SVG. Pre-filled examples (sema 5mg, BPC-157, reta). Bukowski voice labels. CC prompt written and ready.
2. **Health dashboard visualizations** — dose timeline chart, weight trend graph (30/60/90 day), symptom tracker with severity over time, sleep hours logging + chart, coach conversation history with search/frequency. All with date/time stamps and interactive Recharts.
3. **COA report card series** — journalism content reviewing vendors like RealPeptides.co. Leverage "no vendemos" positioning for credibility. Grade vendors on transparency, testing standards, red flags.
4. **Verified user reviews section** — review submission form (stars, text, receipt upload), verification system, public display with "verified purchase" badge, moderation queue.

### Backlog (Not Blocking)
- Coach referrals table population (waiting for practitioners)
- Homepage copy tightening (pricing section layout)
- WeightChart Recharts tooltip on hover (styled but needs testing)
- Admin page for coaches/referrals management
- PostHog/Plausible analytics (privacy policy pre-wired but code not added)
- Email sending via Resend (capture exists, no send pipeline)
- Rate limiting on newsletter endpoint (spam prevention)
- CRON_SECRET rotation schedule (exposed once, rotated same day)

---

## 3. LESSONS LEARNED & REUSABLE PATTERNS

### Architecture Patterns
1. **Model-agnostic AI integrations** — Abstract provider behind shared interface. Swapping Anthropic→xAI→OpenAI should be config change, not rewrite. NOT yet done on PACO Peptide (hardcoded Anthropic SDK) but mandated for all future projects.
2. **One row per locale** — article_drafts has one row per language (ES row + EN row sharing same source_pubmed_id), NOT bilingual columns (content_es/content_en). This is cleaner for querying and extending.
3. **Git as CMS** — Articles are markdown files committed to the repo via GitHub Git Data API. No external CMS. Vercel auto-deploys on commit. Simple, fast, free.
4. **Human-in-the-loop for AI content** — Drafter generates, admin approves, publisher commits. Never auto-publish AI-generated content without review gate.
5. **Stripe webhook on canonical host** — Always target www (or whichever host doesn't redirect). Webhooks don't follow 3xx.

### Development Workflow
1. **New CC session per feature** — Max 20 turns. Context window fills at ~67% and CC gets sluggish. Exit, restart, fresh prompt.
2. **Paste text not screenshots** — Screenshots cost 1500+ tokens AND get re-read every turn. Paste terminal output as text.
3. **Read actual files before writing prompts** — Don't invent column names or file paths from memory. Have CC read the migration/schema first, or verify in Supabase.
4. **Verify deploy before testing** — Check Vercel dashboard for the correct commit SHA on production. "It's green" doesn't mean your commit is deployed — it might be redeploying an old commit.
5. **CLAUDE.md at repo root** — CC reads it on startup. Put principles, locked decisions, and project context there.
6. **One fix per commit, surgical only** — No refactors mixed with features. No touching what works.

### Cost Management
1. **Anthropic org spend cap** — Set it, but set it high enough ($100/mo minimum for a product with an AI coach). Monitor weekly. The cap locks out ALL API access, not just the feature that burned through it.
2. **Vercel Hobby tier limits** — Daily crons only. No sub-daily schedules. Upgrade to Pro ($20/mo) if you need more frequent crons.
3. **Supabase Pro** — $25/mo eliminates auto-pause risk. Worth it for any production app.
4. **Sonnet 4.5 at ~$0.02/message** — 5,000 messages/month = $100. Acceptable for early stage. Consider Haiku ($0.003/message) for lower-tier users if costs grow.

### Mistakes That Cost Time
1. **Inventing schema columns in CC prompts** — Wrote `content_es, content_en, title_es, title_en, excerpt` when actual columns were `language, title, slug, summary, body`. CC caught it. Always verify schema first.
2. **Assuming deploy status** — Said "it's green" without checking which commit was deployed. Led to 404 on production and hours of debugging.
3. **CRON_SECRET set as empty string** — Vercel Sensitive vars are write-only. Couldn't verify the value was actually saved. Cost a full debugging session. Fix: set Sensitive OFF for development, rotate when going to real production.
4. **Not checking Vercel tier before setting cron** — Every-4h cron (`0 */4 * * *`) silently broke all deploys on Hobby tier. No error in the dashboard, no error in the push. Just silent failure.
5. **Relaying between Claude.ai and CC** — Wastes tokens and time. CC should execute directly. Claude.ai is for strategy decisions only.

---

## 4. ENV VARS (Vercel Production)

| Key | Purpose | Sensitive |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase connection | No |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key | No |
| SUPABASE_SERVICE_ROLE_KEY | Service-role for admin ops | Yes |
| STRIPE_SECRET_KEY | Stripe API | Yes |
| STRIPE_WEBHOOK_SECRET | Webhook signature verification | Yes |
| STRIPE_PRICE_ID_VIA_PRO | Monthly price ID | Yes |
| STRIPE_PRICE_ID_VIA_PRO_ANNUAL | Annual price ID | Yes |
| ANTHROPIC_API_KEY | Coach AI | Yes |
| CRON_SECRET | Auth for cron routes | No (was Sensitive, rotated) |
| GITHUB_PAT | Git Data API for publisher | Yes |
| UPSTASH_REDIS_REST_URL | Rate limiting | Yes |
| UPSTASH_REDIS_REST_TOKEN | Rate limiting | Yes |

---

## 5. COMMIT HISTORY (Key Milestones)

| SHA | Message | Day |
|---|---|---|
| 6cbed57 | Legal pages (Privacy + Terms ES/EN) | 6 |
| 42595f9 | feat(seo): metadata, OG, sitemap | 9 |
| 1996583 | feat(scraper): PubMed foundation | 10 |
| ec046fb | feat(drafter): Anthropic-powered article drafts | 11 |
| 1d4760e | feat(publisher): GitHub-API publish cron | 11 |
| 793a105 | fix(cron): publish-drafts daily 14:00 UTC for Hobby compat | 12 |
| 6b5a710 | feat(seo): add OG social preview image | 12 |
| d04c2b2 | feat(diario): article #3 — compounding pharmacy landscape | 12 |
| 2cebaa6 | (publisher cron) published 4 articles | 12 |
| e8e6c18 | feat(coach): 3-tier compound architecture | 12 |
| bf3f82e | fix(coach): remove vendor names from referrals | 12 |
| 7fa9249 | feat(coach): PDF export of chat history | 12 |
| 0e5574f | fix(coach): lead with value, no gatekeeping | 12 |
| f20a05b | feat(coach): strict scope boundary | 12 |
| 1ca3ee8 | fix(legal): AI disclosure, PubMed pipeline, Upstash, retention | 12 |
| ee26fc9 | feat(growth): newsletter email signup | 12 |
| 9940a84 | feat(seo): RSS feed | 12 |
| 601b6ad | feat(admin): draft approval page | 12 |
| 2e6bced | fix(design): dashboard dark theme + coach input visibility | 12 |
| e2184d1 | fix(design): chart tooltip, Bukowski CTA, homepage nav | 12 |

---

## 6. REPLICABLE PLAYBOOK FOR NEXT PROJECT

### Day 1-2: Foundation
- Domain + Vercel + Supabase Pro + repo + CLAUDE.md
- Auth (magic link)
- Basic pages with locale routing (ES/EN or whatever the target)
- Legal pages (Privacy + Terms) — ship early, update as features add
- CSS tokens defined once (--pp-* pattern), used everywhere

### Day 3-4: Core Feature
- The thing that makes the product worth paying for
- AI integration if applicable (abstract the provider from day one)
- Stripe integration (test mode first, live by day 4)

### Day 5-6: Content + SEO
- Sitemap, robots.txt, OG images, metadata
- Content pipeline if applicable
- RSS feed

### Day 7-8: Polish + Legal + Launch Prep
- Design pass (dark theme, mobile responsive, input visibility)
- Legal review against actual features
- Newsletter capture
- Social handles claimed

### Day 9-10: Growth Features
- Admin tools (no more manual Supabase edits)
- Analytics
- First acquisition channel

### Standing Rules (Every Project)
1. CLAUDE.md at repo root, always
2. Model-agnostic AI integrations
3. New CC session per feature, max 20 turns
4. Verify deploys by commit SHA, not "it's green"
5. One fix per commit, surgical only
6. Read full files before editing
7. No screenshots in Claude.ai — paste text
8. Set spend caps on all paid APIs before launch
9. Stripe webhooks on canonical host only
10. Legal pages updated every time a new processor or AI feature ships

---

## 7. COMPETITIVE LANDSCAPE (from prior research)

### Peptide App Market
- ~15-20 iOS apps, mostly solo devs
- Combined market ~$50-100K/month revenue
- PepCalc leads with ~$3,500-7,000/month (not the inflated $78K AppFigures number)
- PeptIQ is feature leader (35+ peptide profiles, AI chat, claim auditor)
- Peptide Log is most technically sophisticated (concentration curves, three-phase protocols)

### Three Gaps No App Fills
1. **Visual before/after intelligence** — no app does consistent angle/lighting/pose enforcement with AI quantification
2. **Supply chain/vendor integration** — no COA verification, batch authenticity, reorder automation
3. **Scan-based assessment** — no face/body scanning for progress tracking with AI quantification

### PACO Peptide's Positioning
- NOT an app (web-first)
- NOT selling peptides ("no vendemos nada")
- Journalism brand + AI coach + research aggregator
- Trust through independence and transparency
- Revenue from subscriptions, not product sales
- Future commerce (COA-verified peptides) = separate domain/LLC/processor, Day 15+ project
