/**
 * Today feature gate.
 *
 * The durable allowlist lives in public.today_users and is read only
 * through the service-role key from server-side Today gates. A global
 * app_flags kill-switch can open Today to all authenticated users without
 * removing the allowlist fallback. No browser client should be able to
 * enumerate or resolve these flags.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

function normalizeUserId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  const trimmed = userId.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export async function isTodayEnabled(
  userId: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeUserId(userId);
  if (!normalized) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const admin = createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: globalFlag, error: globalFlagError } = await admin
    .from("app_flags")
    .select("enabled")
    .eq("key", "today_global_enabled")
    .maybeSingle();

  if (globalFlagError) {
    console.error("[today/flag:global]", globalFlagError);
  } else if (globalFlag?.enabled === true) {
    return true;
  }

  const { data, error } = await admin
    .from("today_users")
    .select("user_id")
    .eq("user_id", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("[today/flag]", error);
    return false;
  }

  return data !== null;
}
