/**
 * POST/GET /api/cron/scrape-pubmed
 *
 * Triggered by Vercel cron daily at 06:00 UTC (see vercel.json).
 *
 * Both GET and POST are exported. Vercel cron defaults to GET; POST
 * stays available for manual triggers (e.g. curl with auth header
 * during smoke tests).
 *
 * Auth: requires Authorization: Bearer <CRON_SECRET>. Vercel cron
 * auto-injects this header when CRON_SECRET is set as a project env
 * var. Manual callers must supply the same header.
 */

import { NextRequest } from "next/server";
import { scrapePubMed } from "@/lib/scrapers/pubmed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PubMed work routinely takes 30-120 seconds. Bump function timeout
// past the Vercel default (10s Hobby / 60s Pro) when running on Pro.
export const maxDuration = 300;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/scrape-pubmed] CRON_SECRET not set");
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
    const result = await scrapePubMed();
    const duration_ms = Date.now() - startedAt;
    console.log("[cron/scrape-pubmed] done", { ...result, duration_ms });
    return jsonResponse(200, {
      ok: true,
      inserted: result.inserted,
      skipped: result.skipped,
      duration_ms,
    });
  } catch (err) {
    const duration_ms = Date.now() - startedAt;
    console.error("[cron/scrape-pubmed] failed", err);
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
