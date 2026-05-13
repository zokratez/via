/**
 * POST/GET /api/cron/publish-drafts
 *
 * Triggered by Vercel cron every 4 hours (see vercel.json). Picks up
 * article_drafts where status='approved' (manually approved by Sam in
 * Supabase SQL editor) and publishes them to the repo via GitHub Git
 * Data API in a single atomic commit.
 *
 * Both GET and POST are exported. Vercel cron sends GET; POST stays
 * available for manual smoke tests.
 *
 * Auth: Bearer CRON_SECRET (same secret used by scrape-pubmed and
 * draft-articles crons).
 */

import { NextRequest } from "next/server";
import { publishApprovedDrafts } from "@/lib/publishers/git-publisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// GitHub Git Data API requests are fast (sub-second each); 60s is
// plenty even for the 20-draft hard cap.
export const maxDuration = 60;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/publish-drafts] CRON_SECRET not set");
    return false;
  }
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(req: NextRequest): Promise<Response> {
  if (!authorized(req)) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const startedAt = Date.now();
  try {
    const result = await publishApprovedDrafts();
    const duration_ms = Date.now() - startedAt;
    console.log("[cron/publish-drafts] done", { ...result, duration_ms });
    return jsonResponse(200, {
      ok: true,
      published: result.published,
      skipped: result.skipped,
      errors: result.errors,
      commit_sha: result.commit_sha,
      duration_ms,
    });
  } catch (err) {
    const duration_ms = Date.now() - startedAt;
    console.error("[cron/publish-drafts] failed", err);
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
