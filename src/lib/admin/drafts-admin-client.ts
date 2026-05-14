/**
 * Service-role Supabase client for the admin drafts surface.
 *
 * article_drafts has RLS enabled with no public policies — the
 * operator's session token cannot read or write directly. The
 * /admin/drafts page and /api/admin/drafts/[id] route both gate on
 * the operator's email via isAdmin(), then use this service-role
 * client for the actual table access.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export type DraftRow = {
  id: string;
  language: "es" | "en";
  status: "pending_review" | "approved" | "rejected" | "published";
  title: string;
  slug: string;
  summary: string;
  generated_at: string;
  reviewed_at: string | null;
  published_at: string | null;
  source_pubmed_id: string | null;
};

export function getDraftsAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
