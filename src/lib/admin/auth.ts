/**
 * Admin gate.
 *
 * The durable allowlist lives in public.admin_users and is read only
 * through the service-role key from server-side admin gates. The static
 * fallback keeps the operator from being locked out during migrations or
 * env outages; remove it after domain admin accounts are verified.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const FALLBACK_ADMIN_EMAILS: readonly string[] = [
  "tortillabarllc@gmail.com",
];

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function isFallbackAdmin(email: string): boolean {
  return FALLBACK_ADMIN_EMAILS.includes(email);
}

export async function isAdmin(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return isFallbackAdmin(normalized);

  const admin = createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("admin_users")
    .select("email")
    .eq("email", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("[admin/auth]", error);
    return isFallbackAdmin(normalized);
  }

  return data !== null;
}
