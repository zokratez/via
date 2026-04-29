import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

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
  const { locale } = (body ?? {}) as { locale?: unknown };
  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const stripeCustomerId = profile?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    return jsonResponse(400, { error: "no_subscription" });
  }

  const origin = req.nextUrl.origin;

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/${locale}/dashboard`,
    });
    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return jsonResponse(500, { error: "generic" });
  }
}
