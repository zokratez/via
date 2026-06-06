import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isAnalyticsEventName,
  isAnalyticsLocale,
  sanitizeAnalyticsProps,
} from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const { eventName, locale, anonId, props } = (body ?? {}) as {
    eventName?: unknown;
    locale?: unknown;
    anonId?: unknown;
    props?: unknown;
  };

  if (!isAnalyticsEventName(eventName)) {
    return jsonResponse(400, { error: "invalid_event" });
  }
  if (!isAnalyticsLocale(locale)) {
    return jsonResponse(400, { error: "invalid_locale" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const safeAnonId = typeof anonId === "string" ? anonId : null;

  if (!user && !safeAnonId) {
    return jsonResponse(400, { error: "missing_actor" });
  }

  await trackServerEvent({
    eventName,
    locale,
    userId: user?.id ?? null,
    anonId: safeAnonId,
    props: sanitizeAnalyticsProps(eventName, props ?? {}),
  });

  return jsonResponse(200, { ok: true });
}
