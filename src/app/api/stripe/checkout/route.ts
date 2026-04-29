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

  const priceId = process.env.STRIPE_PRICE_ID_VIA_PRO;
  if (!priceId) {
    return jsonResponse(500, { error: "generic" });
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

  const stripe = getStripe();
  let stripeCustomerId = profile?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", user.id);
    if (updateErr) {
      console.error("[stripe/checkout] persist customer", updateErr);
      return jsonResponse(500, { error: "generic" });
    }
  }

  const origin = req.nextUrl.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: stripeCustomerId,
      success_url: `${origin}/${locale}/dashboard?upgraded=true`,
      cancel_url: `${origin}/${locale}/coach`,
      locale: locale === "es" ? "es" : "en",
      metadata: { supabase_user_id: user.id },
    });
    if (!session.url) {
      return jsonResponse(500, { error: "generic" });
    }
    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return jsonResponse(500, { error: "generic" });
  }
}
