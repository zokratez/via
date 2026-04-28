"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

const SITES = [
  "abdomen_left",
  "abdomen_right",
  "thigh_left",
  "thigh_right",
  "arm_left",
  "arm_right",
] as const;

const GENERICS = ["semaglutide", "tirzepatide", "liraglutide"] as const;
const LOCALES = ["es", "en"] as const;

const doseSchema = z.object({
  medication_id: z.string().uuid(),
  dose_mg: z.coerce.number().positive().max(100),
  taken_at: z.string().min(1),
  injection_site: z.enum(SITES).optional(),
  notes: z.string().trim().max(2000).optional(),
  locale: z.enum(LOCALES),
});

export async function logDoseAction(formData: FormData) {
  const raw = {
    medication_id: formData.get("medication_id"),
    dose_mg: formData.get("dose_mg"),
    taken_at: formData.get("taken_at"),
    injection_site: formData.get("injection_site") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    locale: formData.get("locale"),
  };
  const parsed = doseSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const takenAt = new Date(parsed.data.taken_at);
  if (Number.isNaN(takenAt.getTime())) {
    return { error: "validation_failed" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const notes =
    parsed.data.notes && parsed.data.notes.length > 0
      ? parsed.data.notes
      : null;

  const { error } = await supabase.from("doses").insert({
    user_id: user.id,
    medication_id: parsed.data.medication_id,
    taken_at: takenAt.toISOString(),
    dose_mg: parsed.data.dose_mg,
    injection_site: parsed.data.injection_site ?? null,
    notes,
  });

  if (error) return { error: "db_failed" as const };

  redirect({ href: "/dashboard?ok=dose", locale: parsed.data.locale });
}

const medSchema = z.object({
  name: z.string().trim().min(1).max(100),
  generic_name: z.enum(GENERICS),
  concentration_mg_per_ml: z
    .union([z.literal(""), z.coerce.number().positive().max(1000)])
    .optional(),
});

type AddMedResult =
  | {
      ok: true;
      medication: {
        id: string;
        name: string;
        generic_name: string;
        concentration_mg_per_ml: number | null;
      };
    }
  | { ok: false; error: "validation_failed" | "unauthenticated" | "db_failed" };

export async function addMedicationAction(
  formData: FormData,
): Promise<AddMedResult> {
  const raw = {
    name: formData.get("name"),
    generic_name: formData.get("generic_name"),
    concentration_mg_per_ml:
      formData.get("concentration_mg_per_ml") ?? undefined,
  };
  const parsed = medSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation_failed" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const concentration =
    typeof parsed.data.concentration_mg_per_ml === "number"
      ? parsed.data.concentration_mg_per_ml
      : null;

  const { data, error } = await supabase
    .from("medications")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      generic_name: parsed.data.generic_name,
      concentration_mg_per_ml: concentration,
    })
    .select("id,name,generic_name,concentration_mg_per_ml")
    .single();

  if (error || !data) return { ok: false, error: "db_failed" };

  return {
    ok: true,
    medication: {
      id: data.id as string,
      name: data.name as string,
      generic_name: data.generic_name as string,
      concentration_mg_per_ml:
        data.concentration_mg_per_ml === null
          ? null
          : Number(data.concentration_mg_per_ml),
    },
  };
}
