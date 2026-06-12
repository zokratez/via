import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { isActiveSubscriber } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const VOICE_ID = "leo";
const LANGUAGE = "es-MX";
const MAX_TEXT_CHARS = 1200;
const FANTASMA_TRIAL_MESSAGE_LIMIT = 3;

type AuthenticatedUser = {
  id: string;
};

type FantasmaProfile = {
  subscription_tier: string | null;
  fantasma_trial_started_at: string | null;
  fantasma_trial_messages_used: number | null;
};

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_supabase_service_role_env");

  return createSupabaseJsClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getBearerUser(authHeader: string | null): Promise<AuthenticatedUser | null> {
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("missing_supabase_env");

  const supabase = createSupabaseJsClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id };
}

function safeTrialMessagesUsed(value: number | null | undefined) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

function trialMessagesRemaining(used: number) {
  return Math.max(0, FANTASMA_TRIAL_MESSAGE_LIMIT - used);
}

function trialHeaders(remaining: number | null): Record<string, string> {
  if (remaining === null) return {};
  return {
    "X-Fantasma-Trial-Remaining": String(remaining),
  };
}

async function loadProfile(userId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("subscription_tier, fantasma_trial_started_at, fantasma_trial_messages_used")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return { profile: data as FantasmaProfile | null, admin };
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const text = normalizeText((body as { text?: unknown } | null)?.text);
  if (!text) return jsonResponse(400, { error: "invalid_text" });

  let user: AuthenticatedUser | null;
  try {
    user = await getBearerUser(req.headers.get("authorization"));
  } catch (error) {
    console.error("[fantasma-tts] auth", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "auth_failed" });
  }
  if (!user) return jsonResponse(401, { error: "unauthorized" });

  let trialRemaining: number | null = null;
  try {
    const { profile, admin } = await loadProfile(user.id);
    if (!profile) throw new Error("profile_missing");

    const isPro = isActiveSubscriber(profile.subscription_tier);
    const used = safeTrialMessagesUsed(profile.fantasma_trial_messages_used);
    trialRemaining = isPro ? null : trialMessagesRemaining(used);

    if (!isPro && used >= FANTASMA_TRIAL_MESSAGE_LIMIT) {
      return jsonResponse(
        403,
        { error: "trial_expired", trial_messages_remaining: 0 },
        trialHeaders(0),
      );
    }

    if (!profile.fantasma_trial_started_at) {
      await admin
        .from("profiles")
        .update({ fantasma_trial_started_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  } catch (error) {
    console.error("[fantasma-tts] profile", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "profile_failed" });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return jsonResponse(500, { error: "missing_xai_key" });

  try {
    const response = await fetch(XAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: VOICE_ID,
        language: LANGUAGE,
        output_format: {
          codec: "mp3",
          sample_rate: 24000,
          bit_rate: 96000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[fantasma-tts] xai", response.status, errorText.slice(0, 500));
      return jsonResponse(
        response.status >= 400 && response.status < 600 ? response.status : 502,
        { error: "tts_failed", provider_status: response.status },
        trialHeaders(trialRemaining),
      );
    }

    const audioBase64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    return jsonResponse(
      200,
      {
        audio_base64: audioBase64,
        mime_type: "audio/mpeg",
        voice_id: VOICE_ID,
        trial_messages_remaining: trialRemaining,
      },
      trialHeaders(trialRemaining),
    );
  } catch (error) {
    console.error("[fantasma-tts]", error);
    Sentry.captureException(error);
    return jsonResponse(502, { error: "tts_failed" }, trialHeaders(trialRemaining));
  }
}
