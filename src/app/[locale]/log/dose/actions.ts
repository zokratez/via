"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeLogCalendarEvent, toDateOnly } from "@/lib/calendar-log";
import { KNOWN_PEPTIDES } from "@/lib/peptides/known-peptides";

const SITES = [
  "abdomen_left",
  "abdomen_right",
  "thigh_left",
  "thigh_right",
  "arm_left",
  "arm_right",
] as const;

const LOCALES = ["es", "en"] as const;
const DOSE_UNITS = ["mg", "mcg"] as const;
const DEFAULT_FREQS = [
  "daily",
  "twice-daily",
  "every-other-day",
  "twice-weekly",
  "weekly",
  "cyclic",
  "custom",
] as const;

const doseSchema = z.object({
  medication_id: z.string().uuid().optional(),
  peptide_name: z.string().trim().min(1).max(100),
  dose_amount: z.coerce.number().positive().max(100000),
  dose_unit: z.enum(DOSE_UNITS),
  default_freq: z.enum(DEFAULT_FREQS).optional(),
  taken_at: z.string().min(1),
  injection_site: z.enum(SITES).optional(),
  notes: z.string().trim().max(2000).optional(),
  locale: z.enum(LOCALES),
});

function findKnownPeptide(name: string) {
  const normalized = name.trim().toLowerCase();
  return KNOWN_PEPTIDES.find((peptide) => {
    if (peptide.name.toLowerCase() === normalized) return true;
    return peptide.aliases.some((alias) => alias.toLowerCase() === normalized);
  });
}

function toStoredMg(amount: number, unit: (typeof DOSE_UNITS)[number]) {
  return unit === "mcg" ? amount / 1000 : amount;
}

export async function logDoseAction(formData: FormData) {
  const raw = {
    medication_id: formData.get("medication_id"),
    peptide_name: formData.get("peptide_name"),
    dose_amount: formData.get("dose_amount"),
    dose_unit: formData.get("dose_unit"),
    default_freq: formData.get("default_freq") ?? undefined,
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
  const peptideName = parsed.data.peptide_name.trim();
  const knownPeptide = findKnownPeptide(peptideName);
  const defaultFreq =
    parsed.data.default_freq ?? knownPeptide?.defaultFreq ?? "custom";
  const storedDoseMg = toStoredMg(parsed.data.dose_amount, parsed.data.dose_unit);
  if (storedDoseMg <= 0 || storedDoseMg > 100) {
    return { error: "validation_failed" as const };
  }

  let medication: { id: string; name: string } | null = null;
  if (parsed.data.medication_id) {
    const { data } = await supabase
      .from("medications")
      .select("id, name")
      .eq("id", parsed.data.medication_id)
      .eq("user_id", user.id)
      .maybeSingle();
    medication = data as { id: string; name: string } | null;
  }
  if (!medication) {
    const { data } = await supabase
      .from("medications")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .ilike("name", peptideName)
      .maybeSingle();
    medication = data as { id: string; name: string } | null;
  }
  if (!medication) {
    const { data, error } = await supabase
      .from("medications")
      .insert({
        user_id: user.id,
        name: peptideName,
        generic_name: knownPeptide?.name.toLowerCase() ?? peptideName.toLowerCase(),
        concentration_mg_per_ml: null,
      })
      .select("id, name")
      .single();
    if (error || !data) return { error: "db_failed" as const };
    medication = data as { id: string; name: string };
  }
  if (!medication) return { error: "validation_failed" as const };

  if (!knownPeptide) {
    const { data: existingCustom } = await supabase
      .from("user_peptides")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", peptideName)
      .maybeSingle();
    if (!existingCustom) {
      const { error: customErr } = await supabase.from("user_peptides").insert({
        user_id: user.id,
        name: peptideName,
        default_freq: defaultFreq,
        default_unit: parsed.data.dose_unit,
      });
      if (customErr) return { error: "db_failed" as const };
    }
  }

  const { error } = await supabase.from("doses").insert({
    user_id: user.id,
    medication_id: medication.id,
    taken_at: takenAt.toISOString(),
    dose_mg: storedDoseMg,
    injection_site: parsed.data.injection_site ?? null,
    notes,
  });

  if (error) return { error: "db_failed" as const };

  try {
    const medName = (medication.name as string | undefined) ?? "";
    const t = await getTranslations({
      locale: parsed.data.locale,
      namespace: "calendar",
    });
    await safeLogCalendarEvent(supabase, {
      userId: user.id,
      locale: parsed.data.locale,
      title: t("log_dose_title", {
        name: medName,
        dose: storedDoseMg,
      }),
      eventDate: toDateOnly(takenAt),
      eventType: "injection",
      relatedMedicationId: medication.id,
    });
  } catch {
    // Calendar mirror is best-effort; never block dose log.
  }

  redirect({ href: "/dashboard?ok=dose", locale: parsed.data.locale });
}

const GENERICS = ["semaglutide", "tirzepatide", "liraglutide"] as const;

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
