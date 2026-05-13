import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

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

  const { email, locale } = (body ?? {}) as {
    email?: unknown;
    locale?: unknown;
  };

  if (
    typeof email !== "string" ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_RE.test(email)
  ) {
    return jsonResponse(400, { error: "invalid_email" });
  }
  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" });
  }

  const normalized = email.trim().toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_signups")
    .insert({ email: normalized, locale });

  if (error && error.code !== "23505") {
    console.error("[newsletter]", error);
    return jsonResponse(500, { error: "generic" });
  }
  return jsonResponse(200, { ok: true });
}
