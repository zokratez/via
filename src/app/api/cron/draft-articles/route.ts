/**
 * POST/GET /api/cron/draft-articles
 *
 * Triggered by Vercel cron daily at 07:00 UTC (see vercel.json), one
 * hour after the PubMed scraper has populated peptide_research_raw.
 *
 * Both GET and POST are exported. Vercel cron sends GET; POST stays
 * available for manual smoke tests (curl with the Bearer header).
 *
 * Auth: requires Authorization: Bearer <CRON_SECRET>. Vercel cron
 * auto-injects this header when CRON_SECRET is set as a project env
 * var. Manual callers must supply the same header.
 */

import { NextRequest } from "next/server";
import { draftArticlesFromResearch } from "@/lib/drafters/article-drafter";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Drafting up to 3 papers × 2 locales = 6 Anthropic calls plus ~6
// 1-sec rate-limit sleeps. Realistic run: 30-90s. The 5-min ceiling
// (Pro tier max) absorbs slow Anthropic responses.
export const maxDuration = 300;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorized(req: NextRequest): boolean {
  return isAuthorizedCronRequest(req, "[cron/draft-articles]");
}

async function handle(req: NextRequest): Promise<Response> {
  if (!authorized(req)) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const startedAt = Date.now();
  try {
    const result = await draftArticlesFromResearch();
    const duration_ms = Date.now() - startedAt;
    console.log("[cron/draft-articles] done", { ...result, duration_ms });
    return jsonResponse(200, {
      ok: true,
      drafted: result.drafted,
      skipped: result.skipped,
      errors: result.errors,
      duration_ms,
    });
  } catch (err) {
    const duration_ms = Date.now() - startedAt;
    console.error("[cron/draft-articles] failed", err);
    return jsonResponse(500, {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
      duration_ms,
    });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
