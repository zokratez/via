/**
 * Article drafter — turns peptide_research_raw rows into article_drafts
 * via Anthropic Claude Sonnet 4.5 using the two shipped diario articles
 * as few-shot voice examples.
 *
 * Run lifecycle (per cron invocation):
 *   1. Lazy-load voice examples (4 .md bodies) on first call. Cached
 *      in module scope for subsequent calls in the same process.
 *   2. Pull up to 3 newest peptide_research_raw rows not yet drafted.
 *   3. For each paper, call Anthropic twice (ES then EN). Both calls
 *      share a stable system prompt — cache_control: ephemeral on the
 *      voice-examples block so we only pay token cost once per locale
 *      per cache TTL (~5 min).
 *   4. Force-call submit_article tool for structured output. Parse and
 *      validate (title/slug/summary/body shape and length).
 *   5. Insert ES + EN rows as status='pending_review'.
 *
 * HARD CAP: 10 drafts per invocation (5 papers × 2 langs). Defense-in-
 * depth above the N=3 query limit. Per-paper Anthropic failures are
 * logged and the run continues — one bad paper does not kill the batch.
 *
 * Rate limit: 1 second between Anthropic calls (Anthropic tier limits
 * are far higher; this is courtesy + cost smoothing, not strict need).
 *
 * Bukowski voice: defined entirely by the few-shot examples. The system
 * prompt does NOT redescribe voice rules — examples carry that signal
 * better than meta-instructions.
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 2048;
const PAPERS_PER_RUN = 3;
const HARD_CAP_DRAFTS = 10;
const RATE_LIMIT_MS = 1000;

type Locale = "es" | "en";

type ResearchPaper = {
  pubmed_id: string;
  title: string;
  abstract: string | null;
  authors: string[] | null;
  journal: string | null;
  published_date: string | null;
  peptides_matched: string[];
  url: string;
};

type DraftedArticle = {
  title: string;
  slug: string;
  summary: string;
  body: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------
// Voice examples — lazy-loaded once, cached in module scope.
// ---------------------------------------------------------------

const ARTICLES_ROOT = path.join(process.cwd(), "src/content/articles");

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : raw.trim();
}

let voiceExamplesCache: Record<Locale, string> | null = null;

function loadVoiceExamples(): Record<Locale, string> {
  if (voiceExamplesCache) return voiceExamplesCache;
  const exampleFiles: Record<Locale, string[]> = {
    es: ["bienvenida.md", "lo-que-sabemos-de-retatrutide.md"],
    en: ["welcome.md", "what-we-know-about-retatrutide.md"],
  };
  const result: Record<Locale, string> = { es: "", en: "" };
  for (const locale of ["es", "en"] as const) {
    const bodies = exampleFiles[locale].map((file) => {
      const p = path.join(ARTICLES_ROOT, locale, file);
      const raw = fs.readFileSync(p, "utf8");
      return stripFrontmatter(raw);
    });
    result[locale] = bodies
      .map((b, i) => `# Example ${i + 1}\n\n${b}`)
      .join("\n\n---\n\n");
  }
  voiceExamplesCache = result;
  return result;
}

// ---------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------

function systemPromptBlocks(
  locale: Locale,
): Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> {
  const examples = loadVoiceExamples()[locale];
  const langName = locale === "es" ? "Spanish" : "English";

  // Block 1: stable role + task framing (cached).
  // Block 2: voice examples (cached, large).
  // The two-block split lets Anthropic cache the entire system payload
  // since cache_control on the last block caches everything before it.
  return [
    {
      type: "text",
      text:
        `You are Bukowski. You write short journalism for PACO Peptide's diario, ` +
        `translating peptide research papers for an informed lay reader in ${langName}. ` +
        `Voice and structure must mirror the example articles below exactly: ` +
        `direct, no jargon, bold lead phrases like "**Lo que se sabe.**" / "**What we know.**", ` +
        `250-400 words. You are not a doctor; do not invent dosing advice; cite the paper, ` +
        `say what's missing, end with a Bukowski-style closer that signals editorial ` +
        `stance without disclaimers.`,
    },
    {
      type: "text",
      text: `VOICE EXAMPLES (study these — voice + structure + length):\n\n${examples}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function userPromptFor(paper: ResearchPaper, locale: Locale): string {
  const langInstr =
    locale === "es"
      ? `Write the article in Spanish.`
      : `Write the article in English.`;
  const lines: string[] = [
    `Draft a diario article about the following peptide research paper.`,
    ``,
    `Paper title: ${paper.title}`,
    `Journal: ${paper.journal ?? "unknown"}`,
    `Published: ${paper.published_date ?? "unknown"}`,
    `Authors: ${(paper.authors ?? []).slice(0, 6).join(", ") || "unknown"}`,
    `Peptides matched: ${paper.peptides_matched.join(", ")}`,
    `PubMed URL: ${paper.url}`,
    ``,
    `Abstract:`,
    paper.abstract ?? "(no abstract available)",
    ``,
    langInstr,
    `Call the submit_article tool with the finished draft. Do not write the article in your reply.`,
  ];
  return lines.join("\n");
}

const SUBMIT_ARTICLE_TOOL = {
  name: "submit_article",
  description:
    "Submit the finished article draft. All four fields are required.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string" as const,
        description: "Article headline. Short, declarative. About 5-12 words.",
      },
      slug: {
        type: "string" as const,
        description:
          "Kebab-case URL slug derived from the title, in the article language. Lowercase letters, digits, and hyphens only.",
      },
      summary: {
        type: "string" as const,
        description: "One-sentence summary. 15-30 words.",
      },
      body: {
        type: "string" as const,
        description:
          "Article body in markdown. 250-400 words. Bold lead phrases like '**Lo que se sabe.**' / '**What we know.**' for section breaks. No frontmatter, no title heading (those are stored separately).",
      },
    },
    required: ["title", "slug", "summary", "body"],
  },
};

// ---------------------------------------------------------------
// Anthropic call + validation
// ---------------------------------------------------------------

function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length >= 4 && s.length <= 120;
}

function validateDraft(input: unknown): DraftedArticle | null {
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  const { title, slug, summary, body } = i;
  if (typeof title !== "string" || title.trim().length < 4 || title.length > 200) {
    return null;
  }
  if (typeof slug !== "string" || !isValidSlug(slug)) return null;
  if (typeof summary !== "string" || summary.trim().length < 10 || summary.length > 500) {
    return null;
  }
  if (typeof body !== "string" || body.trim().length < 200 || body.length > 8000) {
    return null;
  }
  return {
    title: title.trim(),
    slug: slug.trim(),
    summary: summary.trim(),
    body: body.trim(),
  };
}

async function callAnthropicForDraft(
  anthropic: Anthropic,
  paper: ResearchPaper,
  locale: Locale,
): Promise<DraftedArticle | null> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPromptBlocks(locale),
    messages: [{ role: "user", content: userPromptFor(paper, locale) }],
    tools: [SUBMIT_ARTICLE_TOOL],
    tool_choice: { type: "tool", name: "submit_article" },
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock =>
      c.type === "tool_use" && c.name === "submit_article",
  );
  if (!toolUse) {
    console.warn(
      `[drafter] no tool_use block in response for pmid=${paper.pubmed_id} locale=${locale}`,
    );
    return null;
  }

  return validateDraft(toolUse.input);
}

// ---------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------

export async function draftArticlesFromResearch(): Promise<{
  drafted: number;
  skipped: number;
  errors: number;
}> {
  const admin = getAdminClient();
  const anthropic = getAnthropic();

  // Pull already-drafted source pubmed_ids.
  const { data: draftedRows, error: draftedErr } = await admin
    .from("article_drafts")
    .select("source_pubmed_id")
    .not("source_pubmed_id", "is", null);
  if (draftedErr) {
    throw new Error(`drafted lookup failed: ${draftedErr.message}`);
  }
  const draftedIds = new Set(
    (draftedRows ?? [])
      .map((r) => (r as { source_pubmed_id: string | null }).source_pubmed_id)
      .filter((id): id is string => id !== null),
  );

  // Pull recent research. Overfetch to allow filtering.
  const { data: paperRows, error: paperErr } = await admin
    .from("peptide_research_raw")
    .select(
      "pubmed_id,title,abstract,authors,journal,published_date,peptides_matched,url",
    )
    .order("published_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (paperErr) {
    throw new Error(`research fetch failed: ${paperErr.message}`);
  }
  const candidates: ResearchPaper[] = (paperRows ?? [])
    .filter((p) => !draftedIds.has((p as ResearchPaper).pubmed_id))
    .slice(0, PAPERS_PER_RUN) as ResearchPaper[];

  if (candidates.length === 0) {
    return { drafted: 0, skipped: 0, errors: 0 };
  }

  let drafted = 0;
  let skipped = 0;
  let errors = 0;

  for (const paper of candidates) {
    if (drafted >= HARD_CAP_DRAFTS) {
      console.warn(`[drafter] hard cap ${HARD_CAP_DRAFTS} reached, stopping early`);
      break;
    }

    const pairResults: { locale: Locale; draft: DraftedArticle | null }[] = [];
    for (const locale of ["es", "en"] as const) {
      try {
        const draftedRes = await callAnthropicForDraft(anthropic, paper, locale);
        pairResults.push({ locale, draft: draftedRes });
      } catch (err) {
        console.error(
          `[drafter] Anthropic call failed for pmid=${paper.pubmed_id} locale=${locale}`,
          err,
        );
        pairResults.push({ locale, draft: null });
        errors += 1;
      }
      await sleep(RATE_LIMIT_MS);
    }

    // Only insert if BOTH locales succeeded — keeps the paper available
    // for retry on the next run if one locale failed mid-pair.
    const both = pairResults.every((p) => p.draft !== null);
    if (!both) {
      skipped += 1;
      console.warn(
        `[drafter] partial pair for pmid=${paper.pubmed_id}, skipping insert`,
      );
      continue;
    }

    const rows = pairResults.map((p) => ({
      source_pubmed_id: paper.pubmed_id,
      language: p.locale,
      status: "pending_review",
      title: p.draft!.title,
      slug: p.draft!.slug,
      summary: p.draft!.summary,
      body: p.draft!.body,
      model_used: MODEL,
    }));

    const { error: insertErr, count } = await admin
      .from("article_drafts")
      .insert(rows, { count: "exact" });
    if (insertErr) {
      console.error(
        `[drafter] insert failed for pmid=${paper.pubmed_id}`,
        insertErr,
      );
      errors += 1;
      continue;
    }
    drafted += count ?? rows.length;
  }

  return { drafted, skipped, errors };
}
