"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LOCALES = ["es", "en"] as const;

const onboardingGoalSchema = z.object({
  focus: z.enum(["dose", "weight", "protein"]),
  protein_target_g: z.coerce.number().int().min(90).max(180),
  nutrition_goal_type: z.enum(["lose", "maintain", "gain"]),
  locale: z.enum(LOCALES),
});

export async function saveOnboardingGoalAction(formData: FormData) {
  const parsed = onboardingGoalSchema.safeParse({
    focus: formData.get("focus"),
    protein_target_g: formData.get("protein_target_g"),
    nutrition_goal_type: formData.get("nutrition_goal_type"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    console.error("[onboarding/goal] validation", parsed.error.flatten());
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
      protein_target_g: parsed.data.protein_target_g,
      nutrition_goal_type: parsed.data.nutrition_goal_type,
      nutrition_targets_source: "manual",
    })
    .eq("id", user.id);

  if (error) {
    console.error("[onboarding/goal] profile update", error);
    return { error: "db_failed" as const };
  }

  return { ok: true as const, focus: parsed.data.focus };
}
