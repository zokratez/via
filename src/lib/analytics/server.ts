import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  DEDUPED_ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsLocale,
  type AnalyticsProps,
  sanitizeAnalyticsProps,
} from "./events";

function getAnalyticsAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function trackServerEvent(input: {
  eventName: AnalyticsEventName;
  locale: AnalyticsLocale;
  userId?: string | null;
  anonId?: string | null;
  props?: AnalyticsProps;
  dedupe?: boolean;
}): Promise<void> {
  const userId = input.userId ?? null;
  const anonId = input.anonId?.trim() || null;
  if (!userId && !anonId) return;

  try {
    const admin = getAnalyticsAdminClient();
    const shouldDedupe =
      input.dedupe ?? DEDUPED_ANALYTICS_EVENTS.has(input.eventName);

    if (shouldDedupe && userId) {
      const { data: existing } = await admin
        .from("analytics_events")
        .select("id")
        .eq("event_name", input.eventName)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (existing) return;
    }

    await admin.from("analytics_events").insert({
      event_name: input.eventName,
      user_id: userId,
      anon_id: anonId,
      locale: input.locale,
      props: sanitizeAnalyticsProps(input.eventName, input.props ?? {}),
    });
  } catch (err) {
    console.warn("[analytics] track failed", err);
  }
}
