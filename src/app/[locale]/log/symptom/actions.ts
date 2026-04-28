"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = [
  "nausea",
  "fatigue",
  "constipation",
  "headache",
  "injection_site",
  "other",
] as const;

const LOCALES = ["es", "en"] as const;

const symptomSchema = z.object({
  category: z.enum(CATEGORIES),
  severity: z.coerce.number().int().min(1).max(5),
  occurred_at: z.string().min(1),
  notes: z.string().trim().max(2000).optional(),
  locale: z.enum(LOCALES),
});

export async function logSymptomAction(formData: FormData) {
  const raw = {
    category: formData.get("category"),
    severity: formData.get("severity"),
    occurred_at: formData.get("occurred_at"),
    notes: formData.get("notes") ?? undefined,
    locale: formData.get("locale"),
  };
  const parsed = symptomSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const occurredAt = new Date(parsed.data.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) {
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

  const { error } = await supabase.from("side_effects").insert({
    user_id: user.id,
    occurred_at: occurredAt.toISOString(),
    category: parsed.data.category,
    severity: parsed.data.severity,
    notes,
  });

  if (error) return { error: "db_failed" as const };

  redirect({ href: "/dashboard?ok=symptom", locale: parsed.data.locale });
}
