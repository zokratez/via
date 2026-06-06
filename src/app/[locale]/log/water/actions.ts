"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeLogCalendarEvent, toDateOnly } from "@/lib/calendar-log";
import { trackServerEvent } from "@/lib/analytics/server";

const LOCALES = ["es", "en"] as const;

const waterSchema = z.object({
  amount_ml: z.coerce.number().positive().max(100000),
  drank_at: z.string().min(1),
  note: z.string().trim().max(2000).optional(),
  locale: z.enum(LOCALES),
});

export async function logWaterAction(formData: FormData) {
  const raw = {
    amount_ml: formData.get("amount_ml"),
    drank_at: formData.get("drank_at"),
    note: formData.get("note") ?? undefined,
    locale: formData.get("locale"),
  };
  const parsed = waterSchema.safeParse(raw);
  if (!parsed.success) return { error: "validation_failed" as const };

  const drankAt = new Date(parsed.data.drank_at);
  if (Number.isNaN(drankAt.getTime())) {
    return { error: "validation_failed" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as const };

  const note =
    parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null;

  const { error } = await supabase.from("water_entries").insert({
    user_id: user.id,
    drank_at: drankAt.toISOString(),
    amount_ml: parsed.data.amount_ml,
    note,
  });

  if (error) return { error: "db_failed" as const };

  try {
    const t = await getTranslations({
      locale: parsed.data.locale,
      namespace: "calendar",
    });
    await safeLogCalendarEvent(supabase, {
      userId: user.id,
      locale: parsed.data.locale,
      title: t("log_water_title", {
        ml: Math.round(parsed.data.amount_ml),
      }),
      eventDate: toDateOnly(drankAt),
      eventType: "note",
    });
  } catch {
    // Calendar mirror is best-effort; never block water log.
  }

  await trackServerEvent({
    eventName: "first_log",
    locale: parsed.data.locale,
    userId: user.id,
    props: { log_type: "water" },
  });

  redirect({ href: "/dashboard?ok=water", locale: parsed.data.locale });
}
