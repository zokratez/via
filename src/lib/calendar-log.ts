/**
 * Mirror an activity log entry (dose, weight, symptom, sleep) into
 * calendar_events so the planner shows a unified day-by-day view.
 *
 * Failures here must not break the primary log — the user's data is
 * already saved by the time this runs. We swallow errors and continue.
 */

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type Locale = "es" | "en";
type EventType = "injection" | "appointment" | "reminder" | "note";

export type CalendarLogParams = {
  userId: string;
  locale: Locale;
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventType: EventType;
  relatedMedicationId?: string | null;
};

export async function safeLogCalendarEvent(
  supabase: SupabaseServerClient,
  params: CalendarLogParams,
): Promise<void> {
  try {
    await supabase.from("calendar_events").insert({
      user_id: params.userId,
      title: params.title,
      event_date: params.eventDate,
      event_type: params.eventType,
      related_medication_id: params.relatedMedicationId ?? null,
      locale: params.locale,
    });
  } catch {
    // Intentional: never block the primary log on calendar mirror failure.
  }
}

export function toDateOnly(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
