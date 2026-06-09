import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const ENERGY_NUTRIENT_ID = 1008;
const PROTEIN_NUTRIENT_ID = 1003;
const FAT_NUTRIENT_ID = 1004;
const CARB_NUTRIENT_ID = 1005;

type UsdaSearchFood = {
  fdcId: number;
  description: string;
  brandName?: string;
  gtinUpc?: string;
  dataType?: string;
};

type UsdaFoodDetail = UsdaSearchFood & {
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{
    amount?: number;
    nutrient?: {
      id?: number;
      number?: string;
      unitName?: string;
    };
  }>;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function roundMacro(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

function nutrientAmount(food: UsdaFoodDetail, nutrientId: number) {
  const nutrient = food.foodNutrients?.find(
    (entry) =>
      entry.nutrient?.id === nutrientId ||
      entry.nutrient?.number === String(nutrientId),
  );
  return Number(nutrient?.amount ?? 0);
}

function macrosPer100g(food: UsdaFoodDetail) {
  return {
    calories: roundMacro(nutrientAmount(food, ENERGY_NUTRIENT_ID)),
    protein: roundMacro(nutrientAmount(food, PROTEIN_NUTRIENT_ID)),
    carbs: roundMacro(nutrientAmount(food, CARB_NUTRIENT_ID)),
    fat: roundMacro(nutrientAmount(food, FAT_NUTRIENT_ID)),
  };
}

function scaleMacros(
  macros: ReturnType<typeof macrosPer100g>,
  servingSize?: number,
  servingSizeUnit?: string,
) {
  const grams =
    servingSize && servingSize > 0 && servingSizeUnit?.toLowerCase() === "g"
      ? servingSize
      : 100;
  const scale = grams / 100;
  return {
    calories: roundMacro(macros.calories * scale),
    protein: roundMacro(macros.protein * scale),
    carbs: roundMacro(macros.carbs * scale),
    fat: roundMacro(macros.fat * scale),
  };
}

async function getBearerUser(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("missing_supabase_env");

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function usdaSearchBarcode(barcode: string, apiKey: string) {
  const response = await fetch(`${USDA_BASE_URL}/foods/search?api_key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: barcode,
      dataType: ["Branded"],
      pageSize: 20,
    }),
  });

  if (!response.ok) {
    throw new Error(`USDA barcode search failed (${response.status})`);
  }

  const payload = (await response.json()) as { foods?: UsdaSearchFood[] };
  const foods = payload.foods ?? [];
  const normalized = barcode.replace(/\D/g, "");
  return (
    foods.find((food) => food.gtinUpc?.replace(/\D/g, "") === normalized) ??
    foods[0] ??
    null
  );
}

async function usdaFoodDetail(foodId: number, apiKey: string) {
  const response = await fetch(`${USDA_BASE_URL}/food/${foodId}?api_key=${apiKey}`);
  if (!response.ok) {
    throw new Error(`USDA food detail failed (${response.status})`);
  }
  return (await response.json()) as UsdaFoodDetail;
}

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof getBearerUser>>;
  try {
    user = await getBearerUser(req.headers.get("authorization"));
  } catch (error) {
    console.error("[food/nutrition/barcode] auth", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "auth_failed" });
  }
  if (!user) return jsonResponse(401, { error: "unauthorized" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const barcode =
    typeof (body as { barcode?: unknown })?.barcode === "string"
      ? (body as { barcode: string }).barcode.replace(/\D/g, "")
      : "";
  if (!/^\d{6,18}$/.test(barcode)) {
    return jsonResponse(400, { error: "invalid_barcode" });
  }

  const apiKey = process.env.USDA_FDC_API_KEY || "DEMO_KEY";

  try {
    const match = await usdaSearchBarcode(barcode, apiKey);
    if (!match) return jsonResponse(404, { error: "not_found" });

    const detail = await usdaFoodDetail(match.fdcId, apiKey);
    const per100 = macrosPer100g(detail);
    const serving = scaleMacros(
      per100,
      detail.servingSize,
      detail.servingSizeUnit,
    );

    return jsonResponse(200, {
      food: {
        fdcId: detail.fdcId,
        description: detail.description,
        brandName: detail.brandName,
        gtinUpc: detail.gtinUpc,
        dataType: detail.dataType,
        servingSize: detail.servingSize,
        servingSizeUnit: detail.servingSizeUnit,
        macrosPer100g: per100,
        ...serving,
        source: "USDA FoodData Central",
        sourceType: "verified",
      },
    });
  } catch (error) {
    console.error("[food/nutrition/barcode]", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "lookup_failed" });
  }
}
