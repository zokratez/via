import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export type Referral = {
  name: string;
  credentials: string;
  specialty: string;
  scope_notes: string | null;
  url: string | null;
  languages: string[];
};

type FindOpts = {
  locale: "es" | "en";
  country?: string;
  state?: string;
  limit?: number;
};

type ReferralRow = Referral & { telehealth_states: string[] | null };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function findReferrals(opts: FindOpts): Promise<Referral[]> {
  const { locale, country = "US", state, limit = 3 } = opts;
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("coach_referrals")
      .select(
        "name, credentials, specialty, scope_notes, url, languages, telehealth_states",
      )
      .eq("active", true)
      .eq("consent_documented", true)
      .contains("languages", [locale])
      .contains("countries", [country])
      .order("vetted_at", { ascending: false, nullsFirst: false });

    if (error || !data) return [];

    const rows = data as ReferralRow[];
    let pool = rows;
    if (country === "US" && state) {
      pool = rows.filter(
        (r) =>
          !r.telehealth_states ||
          r.telehealth_states.length === 0 ||
          r.telehealth_states.includes(state),
      );
    }
    return pool.slice(0, limit).map((r) => ({
      name: r.name,
      credentials: r.credentials,
      specialty: r.specialty,
      scope_notes: r.scope_notes,
      url: r.url,
      languages: r.languages,
    }));
  } catch (err) {
    console.error("[referrals]", err);
    return [];
  }
}

export function buildReferralInjection(
  locale: "es" | "en",
  referrals: Referral[],
): string {
  if (referrals.length === 0) {
    return [
      "",
      "[REFERRAL CONTEXT FOR THIS TURN]",
      "The user is asking for a referral but Vía has no matching vetted providers yet. Give directory-level guidance: ABOM directory (abom.org) for obesity medicine, endocrinologist via insurance, telehealth platforms like Ro/Hims/Henry Meds for approved compounds (sema/tirz). Do NOT name individual physicians. Stay in voice.",
    ].join("\n");
  }

  const disclosure =
    locale === "es"
      ? '"Vía no ha verificado resultados clínicos; tú decides."'
      : '"Vía has not verified clinical outcomes; you decide."';

  return [
    "",
    "[REFERRAL CONTEXT FOR THIS TURN]",
    `The user is asking for a referral. Vía has the following vetted providers matching their locale and location: ${JSON.stringify(referrals)}. Surface them in Bukowski's voice with the one-line scope disclosure for each. Add: ${disclosure} Then offer to keep talking.`,
  ].join("\n");
}
