import { NextRequest } from "next/server";
import {
  getMiMetaSignalState,
  type NutritionTargets,
} from "@/lib/mimeta/signals";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isLocale(value: unknown): value is "es" | "en" {
  return value === "es" || value === "en";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const localeInput = (body as { locale?: unknown })?.locale;
  const locale = isLocale(localeInput) ? localeInput : "es";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const { data: profileTargets } = await supabase
    .from("profiles")
    .select(
      "daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, nutrition_goal_type",
    )
    .eq("id", user.id)
    .maybeSingle();
  const nutritionTargets: NutritionTargets = {
    dailyCalories: profileTargets?.daily_calorie_target,
    proteinG: profileTargets?.protein_target_g,
    carbsG: profileTargets?.carbs_target_g,
    fatG: profileTargets?.fat_target_g,
    goalType: profileTargets?.nutrition_goal_type,
  };
  const signal = await getMiMetaSignalState({
    supabase,
    userId: user.id,
    locale,
    nutritionTargets,
  });

  return jsonResponse(200, { signal });
}
