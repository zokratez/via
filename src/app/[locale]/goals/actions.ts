"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LOCALES = ["es", "en"] as const;

const nullableInteger = (max: number, min = 1) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      return value;
    },
    z.coerce.number().int().min(min).max(max).nullable(),
  );

const goalsSchema = z.object({
  daily_calorie_target: nullableInteger(10000),
  protein_target_g: nullableInteger(1000),
  carbs_target_g: nullableInteger(1000, 0),
  fat_target_g: nullableInteger(1000),
  nutrition_goal_type: z.enum(["lose", "maintain", "gain"]),
  nutrition_targets_source: z.enum(["computed", "manual"]),
  locale: z.enum(LOCALES),
});

export async function saveNutritionGoalsAction(formData: FormData) {
  const parsed = goalsSchema.safeParse({
    daily_calorie_target: formData.get("daily_calorie_target"),
    protein_target_g: formData.get("protein_target_g"),
    carbs_target_g: formData.get("carbs_target_g"),
    fat_target_g: formData.get("fat_target_g"),
    nutrition_goal_type: formData.get("nutrition_goal_type"),
    nutrition_targets_source: formData.get("nutrition_targets_source"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    console.error("Nutrition goals validation failed", parsed.error.flatten());
    return { error: "validation_failed" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const { error } = await supabase
    .from("profiles")
    .update({
      daily_calorie_target: parsed.data.daily_calorie_target,
      protein_target_g: parsed.data.protein_target_g,
      carbs_target_g: parsed.data.carbs_target_g,
      fat_target_g: parsed.data.fat_target_g,
      nutrition_goal_type: parsed.data.nutrition_goal_type,
      nutrition_targets_source: parsed.data.nutrition_targets_source,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Nutrition goals profile update failed", error);
    return { error: "db_failed" as const };
  }

  return { ok: true as const };
}
