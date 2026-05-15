/**
 * GET/POST /api/cron/send-reminders
 *
 * Triggered by Vercel cron daily at 12:00 UTC (see vercel.json).
 *
 * For each user with an active subscription and at least one logged
 * dose, calculates when their next dose is due based on the most
 * recent dose + the medication's compound schedule:
 *   - weekly (7d) for sema/tirz/lira/reta/cagri/survod
 *   - daily   (1d) for BPC-157, TB-500
 *   - weekly  (7d) default
 *
 * If the next dose lands on today or tomorrow (server time, UTC),
 * sends a Bukowski-voiced reminder via Resend. Idempotency: writes to
 * email_log and checks for an existing same-type entry for the same
 * user on the same calendar day before sending.
 *
 * Auth: requires Authorization: Bearer <CRON_SECRET>, the same shape
 * as the other cron routes.
 */

import { NextRequest } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ACTIVE_TIERS } from "@/lib/subscription";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEEKLY_GENERICS = new Set([
  "semaglutide",
  "tirzepatide",
  "liraglutide",
  "retatrutide",
  "cagrilintide",
  "survodutide",
]);
const DAILY_GENERICS = new Set(["bpc-157", "tb-500", "bpc157", "tb500"]);

const EMAIL_TYPE_TOMORROW = "injection_reminder_tomorrow";
const EMAIL_TYPE_TODAY = "injection_reminder_today";

type Locale = "es" | "en";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/send-reminders] CRON_SECRET not set");
    return false;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

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

function scheduleDays(generic: string | null): number {
  if (!generic) return 7;
  const g = generic.toLowerCase().trim();
  if (DAILY_GENERICS.has(g)) return 1;
  if (WEEKLY_GENERICS.has(g)) return 7;
  return 7;
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(d: Date, locale: Locale): string {
  return d.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

type ReminderKind = "tomorrow" | "today";

function buildSubject(kind: ReminderKind, locale: Locale): string {
  if (kind === "tomorrow") {
    return locale === "es"
      ? "Mañana es día de inyección"
      : "Tomorrow is injection day";
  }
  return locale === "es" ? "Hoy es día de inyección" : "Injection day today";
}

function buildHtml(opts: {
  kind: ReminderKind;
  locale: Locale;
  medicationName: string;
  lastDose: Date;
  nextDose: Date;
  doseUrl: string;
}): string {
  const { kind, locale, medicationName, lastDose, nextDose, doseUrl } = opts;
  const headline = buildSubject(kind, locale);
  const lastLabel = locale === "es" ? "Última dosis" : "Last dose";
  const nextLabel = locale === "es" ? "Siguiente" : "Next";
  const cta = locale === "es" ? "Registrar dosis" : "Log dose";
  const tagline =
    kind === "tomorrow"
      ? locale === "es"
        ? "Saca el vial. Prepárate sin prisa."
        : "Pull the vial out. No need to rush — just be ready."
      : locale === "es"
        ? "Hoy toca. Sin drama, solo el ritmo."
        : "Today's the day. No drama, just the rhythm.";

  return `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#1a1614;color:#f4ede0;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1614;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#221c19;border:0.5px solid #3d342e;border-radius:8px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 6px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9966b;font-weight:600;">
                PACO Peptide
              </p>
              <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-style:italic;font-size:28px;line-height:1.15;font-weight:normal;color:#f4ede0;">
                ${headline}
              </h1>
              <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:15px;line-height:1.55;color:#a89788;">
                ${tagline}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1614;border:0.5px solid #3d342e;border-radius:6px;padding:16px 18px;margin:0 0 24px;">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-family:Georgia,serif;font-style:italic;font-size:18px;color:#f4ede0;">
                      ${medicationName}
                    </p>
                    <p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#a89788;">
                      ${lastLabel}: ${formatDate(lastDose, locale)} · ${nextLabel}: ${formatDate(nextDose, locale)}
                    </p>
                  </td>
                </tr>
              </table>
              <a href="${doseUrl}" style="display:inline-block;background:#c9966b;color:#1a1614;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;font-weight:600;padding:14px 24px;border-radius:6px;text-decoration:none;">
                ${cta} →
              </a>
              <p style="margin:32px 0 0;font-family:Georgia,serif;font-size:12px;color:#6b5d52;line-height:1.55;">
                ${
                  locale === "es"
                    ? "Bukowski no es médico. Cualquier cambio de dosis lo decides con tu prescriptor."
                    : "Bukowski isn't a doctor. Dose changes are decisions for you and your prescriber."
                }
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

type ProfileRow = {
  id: string;
  locale: string | null;
  subscription_tier: string | null;
};
type AuthUserRow = { id: string; email: string | null };
type DoseRow = {
  user_id: string;
  taken_at: string;
  medication_id: string | null;
  medications:
    | { name: string | null; generic_name: string | null }
    | { name: string | null; generic_name: string | null }[]
    | null;
};

type SendResult = {
  scanned: number;
  sent: number;
  skipped_idempotent: number;
  skipped_no_email: number;
  skipped_not_due: number;
  errors: number;
};

async function runReminders(): Promise<SendResult> {
  const supabase = getAdminClient();
  const result: SendResult = {
    scanned: 0,
    sent: 0,
    skipped_idempotent: 0,
    skipped_no_email: 0,
    skipped_not_due: 0,
    errors: 0,
  };

  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, locale, subscription_tier")
    .in("subscription_tier", [...ACTIVE_TIERS]);
  if (profilesErr) throw profilesErr;

  const candidates = (profiles ?? []) as ProfileRow[];
  if (candidates.length === 0) return result;

  // Fetch most-recent dose per candidate user. One query with a join
  // to medications, ordered desc — we'll keep the first row per user.
  const userIds = candidates.map((p) => p.id);
  const { data: doseRows, error: dosesErr } = await supabase
    .from("doses")
    .select(
      "user_id, taken_at, medication_id, medications(name, generic_name)",
    )
    .in("user_id", userIds)
    .order("taken_at", { ascending: false });
  if (dosesErr) throw dosesErr;

  const lastDoseByUser = new Map<string, DoseRow>();
  for (const r of (doseRows ?? []) as DoseRow[]) {
    if (!lastDoseByUser.has(r.user_id)) lastDoseByUser.set(r.user_id, r);
  }

  const now = new Date();
  const todayKey = dayKey(now);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.pacopeptide.com";

  for (const profile of candidates) {
    result.scanned += 1;
    const dose = lastDoseByUser.get(profile.id);
    if (!dose) {
      result.skipped_not_due += 1;
      continue;
    }

    const lastDose = new Date(dose.taken_at);
    if (Number.isNaN(lastDose.getTime())) {
      result.skipped_not_due += 1;
      continue;
    }
    const med = Array.isArray(dose.medications)
      ? dose.medications[0] ?? null
      : dose.medications;
    const cycle = scheduleDays(med?.generic_name ?? null);
    const nextDose = new Date(lastDose);
    nextDose.setUTCDate(nextDose.getUTCDate() + cycle);

    const deltaDays = Math.round(
      (Date.UTC(
        nextDose.getUTCFullYear(),
        nextDose.getUTCMonth(),
        nextDose.getUTCDate(),
      ) -
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
        )) /
        86_400_000,
    );

    let kind: ReminderKind;
    let emailType: string;
    if (deltaDays === 1) {
      kind = "tomorrow";
      emailType = EMAIL_TYPE_TOMORROW;
    } else if (deltaDays === 0) {
      kind = "today";
      emailType = EMAIL_TYPE_TODAY;
    } else {
      result.skipped_not_due += 1;
      continue;
    }

    // Idempotency: skip if we already sent this email_type today.
    const todayStart = `${todayKey}T00:00:00.000Z`;
    const { data: priorLog, error: logQueryErr } = await supabase
      .from("email_log")
      .select("id")
      .eq("user_id", profile.id)
      .eq("email_type", emailType)
      .gte("sent_at", todayStart)
      .limit(1)
      .maybeSingle();
    if (logQueryErr) {
      result.errors += 1;
      continue;
    }
    if (priorLog) {
      result.skipped_idempotent += 1;
      continue;
    }

    // Fetch email via auth admin API.
    const { data: userResp, error: userErr } =
      await supabase.auth.admin.getUserById(profile.id);
    if (userErr || !userResp?.user?.email) {
      result.skipped_no_email += 1;
      continue;
    }
    const recipient = (userResp.user as AuthUserRow).email!;
    const locale: Locale = profile.locale === "en" ? "en" : "es";
    const medicationName =
      med?.name ?? med?.generic_name ?? (locale === "es" ? "tu medicamento" : "your medication");
    const doseUrl = `${baseUrl}/${locale}/log/dose`;
    const subject = buildSubject(kind, locale);
    const html = buildHtml({
      kind,
      locale,
      medicationName,
      lastDose,
      nextDose,
      doseUrl,
    });

    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject,
        html,
      });
      await supabase
        .from("email_log")
        .insert({ user_id: profile.id, email_type: emailType });
      result.sent += 1;
    } catch (err) {
      console.error("[cron/send-reminders] send failed", {
        user_id: profile.id,
        err: err instanceof Error ? err.message : "unknown",
      });
      result.errors += 1;
    }
  }

  return result;
}

async function handle(req: NextRequest): Promise<Response> {
  if (!authorized(req)) {
    return jsonResponse(401, { error: "unauthorized" });
  }
  const startedAt = Date.now();
  try {
    const result = await runReminders();
    const duration_ms = Date.now() - startedAt;
    console.log("[cron/send-reminders] done", { ...result, duration_ms });
    return jsonResponse(200, { ok: true, ...result, duration_ms });
  } catch (err) {
    const duration_ms = Date.now() - startedAt;
    console.error("[cron/send-reminders] failed", err);
    return jsonResponse(500, {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
      duration_ms,
    });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
