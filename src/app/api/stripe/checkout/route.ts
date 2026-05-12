import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createCheckoutSession,
  isCheckoutLocale,
  isCheckoutPlan,
} from "@/lib/stripe/checkout-session";

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

  const { locale, plan: planInput } = (body ?? {}) as {
    locale?: unknown;
    plan?: unknown;
  };
  if (!isCheckoutLocale(locale)) {
    return jsonResponse(400, { error: "invalid_locale" });
  }
  // Plan defaults to annual when caller omits it (the in-coach upgrade
  // button at CoachChat.tsx:307 sends only { locale }). Sam-approved.
  const plan =
    planInput === undefined
      ? "annual"
      : isCheckoutPlan(planInput)
        ? planInput
        : null;
  if (plan === null) {
    return jsonResponse(400, { error: "invalid_plan" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const result = await createCheckoutSession({
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    plan,
    locale,
    origin: req.nextUrl.origin,
  });

  if (!result.ok) {
    return jsonResponse(500, { error: "generic" });
  }
  return jsonResponse(200, { url: result.url });
}
