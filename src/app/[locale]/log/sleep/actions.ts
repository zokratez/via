"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

const LOCALES = ["es", "en"] as const;

const sleepSchema = z.object({
  hours: z.coerce.number().min(0).max(24),
  quality: z.coerce.number().int().min(1).max(5),
  slept_at: z.string().min(1),
  notes: z.string().trim().max(2000).optional(),
  locale: z.enum(LOCALES),
});

export async function logSleepAction(formData: FormData) {
  const raw = {
    hours: formData.get("hours"),
    quality: formData.get("quality"),
    slept_at: formData.get("slept_at"),
    notes: formData.get("notes") ?? undefined,
    locale: formData.get("locale"),
  };
  const parsed = sleepSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const sleptAtDate = new Date(`${parsed.data.slept_at}T00:00:00`);
  if (Number.isNaN(sleptAtDate.getTime())) {
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

  const { error } = await supabase.from("sleep_entries").insert({
    user_id: user.id,
    slept_at: parsed.data.slept_at,
    hours: parsed.data.hours,
    quality: parsed.data.quality,
    notes,
  });

  if (error) return { error: "db_failed" as const };

  redirect({ href: "/dashboard?ok=sleep", locale: parsed.data.locale });
}
