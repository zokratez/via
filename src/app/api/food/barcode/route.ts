import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isActiveSubscriber } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  barcode: z.string().trim().regex(/^\d{6,18}$/),
  locale: z.enum(["es", "en"]),
});

type OpenFoodFactsProduct = {
  product_name?: string;
  product_name_es?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * 10) / 10);
}

function kcalValue(nutriments: Record<string, unknown>): number | null {
  const serving = numberOrNull(nutriments["energy-kcal_serving"]);
  if (serving !== null) return Math.round(serving);
  const hundred = numberOrNull(nutriments["energy-kcal_100g"]);
  return hundred === null ? null : Math.round(hundred);
}

function macroValue(
  nutriments: Record<string, unknown>,
  key: "proteins" | "carbohydrates" | "fat",
): number | null {
  return (
    numberOrNull(nutriments[`${key}_serving`]) ??
    numberOrNull(nutriments[`${key}_100g`])
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (!isActiveSubscriber(profile?.subscription_tier)) {
    return jsonResponse(403, { error: "pro_required" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(400, { error: "invalid_barcode" });
  }

  const { barcode, locale } = parsed.data;

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        barcode,
      )}.json?fields=code,status,product_name,product_name_es,product_name_en,brands,serving_size,nutriments`,
      {
        headers: {
          "User-Agent":
            "PACO Peptide/1.0 (https://www.pacopeptide.com; contact: admin@pacopeptide.com)",
          Accept: "application/json",
        },
        next: { revalidate: 60 * 60 * 24 },
      },
    );

    if (!res.ok) {
      return jsonResponse(502, { error: "lookup_failed" });
    }

    const payload = (await res.json()) as {
      status?: number;
      product?: OpenFoodFactsProduct;
    };

    if (payload.status !== 1 || !payload.product) {
      return jsonResponse(404, { error: "not_found" });
    }

    const product = payload.product;
    const nutriments = product.nutriments ?? {};
    const localizedName =
      locale === "es" ? product.product_name_es : product.product_name_en;
    const name = localizedName || product.product_name || barcode;
    const brand = product.brands?.split(",")[0]?.trim() ?? "";
    const serving = product.serving_size?.trim() ?? "";
    const description = [brand, name, serving ? `(${serving})` : ""]
      .filter(Boolean)
      .join(" ");

    return jsonResponse(200, {
      product: {
        barcode,
        description,
        calories: kcalValue(nutriments),
        protein_g: macroValue(nutriments, "proteins"),
        carbs_g: macroValue(nutriments, "carbohydrates"),
        fat_g: macroValue(nutriments, "fat"),
        source: "Open Food Facts",
        serving_size: serving || null,
      },
    });
  } catch (err) {
    console.error("[food/barcode]", err);
    Sentry.captureException(err);
    return jsonResponse(500, { error: "lookup_failed" });
  }
}
