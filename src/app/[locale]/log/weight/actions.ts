"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

const LOCALES = ["es", "en"] as const;

const optionalNumber = z
  .union([z.literal(""), z.coerce.number().positive()])
  .optional();

const weightSchema = z.object({
  weight_kg: z.coerce.number().positive().max(500),
  waist_cm: optionalNumber.refine(
    (v) => v === undefined || v === "" || (typeof v === "number" && v <= 500),
    { message: "out_of_range" },
  ),
  body_fat_pct: optionalNumber.refine(
    (v) => v === undefined || v === "" || (typeof v === "number" && v <= 80),
    { message: "out_of_range" },
  ),
  measured_at: z.string().min(1),
  locale: z.enum(LOCALES),
});

export async function logWeightAction(formData: FormData) {
  const raw = {
    weight_kg: formData.get("weight_kg"),
    waist_cm: formData.get("waist_cm") ?? undefined,
    body_fat_pct: formData.get("body_fat_pct") ?? undefined,
    measured_at: formData.get("measured_at"),
    locale: formData.get("locale"),
  };
  const parsed = weightSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const measuredAt = new Date(parsed.data.measured_at);
  if (Number.isNaN(measuredAt.getTime())) {
    return { error: "validation_failed" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const waist =
    typeof parsed.data.waist_cm === "number" ? parsed.data.waist_cm : null;
  const bodyFat =
    typeof parsed.data.body_fat_pct === "number"
      ? parsed.data.body_fat_pct
      : null;

  const { error } = await supabase.from("weight_entries").insert({
    user_id: user.id,
    measured_at: measuredAt.toISOString(),
    weight_kg: parsed.data.weight_kg,
    waist_cm: waist,
    body_fat_pct: bodyFat,
  });

  if (error) return { error: "db_failed" as const };

  redirect({ href: "/dashboard?ok=weight", locale: parsed.data.locale });
}
