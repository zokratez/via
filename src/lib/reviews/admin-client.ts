/**
 * Service-role Supabase client for the user_reviews surface.
 *
 * user_reviews has RLS with INSERT-only public policies; SELECT/
 * UPDATE/DELETE are blocked from anon and authenticated. This
 * module provides the service-role client used by:
 *  - The homepage display section (filters approved+verified)
 *  - The /admin/reviews moderation page (full CRUD)
 *
 * Same pattern as coach/referrals.ts and admin/drafts-admin-client.ts.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export type ReviewRow = {
  id: string;
  user_id: string | null;
  display_name: string;
  rating: number;
  review_text: string;
  receipt_image_url: string | null;
  verified: boolean;
  status: "pending" | "approved" | "rejected";
  locale: "es" | "en";
  created_at: string;
};

export function getReviewsAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
