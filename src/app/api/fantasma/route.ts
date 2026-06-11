import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { fantasmaRateLimit } from "@/lib/rate-limit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 1800;

type Locale = "es" | "en";
type FantasmaRole = "user" | "assistant";
type FantasmaMessage = { role: FantasmaRole; content: string };

type UserContextSnapshot = {
  caloriesIn?: unknown;
  proteinG?: unknown;
  carbsG?: unknown;
  fatG?: unknown;
  waterMl?: unknown;
  doseCountToday?: unknown;
  symptomCountToday?: unknown;
  latestWeightKg?: unknown;
  latestDoseName?: unknown;
  doseTodayName?: unknown;
  sleepAvgHours?: unknown;
  streaks?: unknown;
  windows?: unknown;
  targets?: unknown;
};

type AuthenticatedUser = {
  id: string;
};

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function isFantasmaMessage(value: unknown): value is FantasmaMessage {
  if (!value || typeof value !== "object") return false;
  const role = (value as { role?: unknown }).role;
  const content = (value as { content?: unknown }).content;
  return (role === "user" || role === "assistant") && typeof content === "string";
}

function sanitizeMessages(messages: FantasmaMessage[]) {
  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  if (firstUserIndex < 0) return [];

  return messages.slice(firstUserIndex).slice(-MAX_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content.slice(0, MAX_MESSAGE_CHARS),
  }));
}

function numberOrDash(value: unknown, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${Math.round(number * 10) / 10}${suffix}`;
}

function textOrDash(value: unknown) {
  return typeof value === "string" && value.trim() ? value.slice(0, 120) : "—";
}

function contextBlock(context: UserContextSnapshot) {
  const streaks =
    context.streaks && typeof context.streaks === "object"
      ? (context.streaks as Record<string, unknown>)
      : {};
  const targets =
    context.targets && typeof context.targets === "object"
      ? (context.targets as Record<string, unknown>)
      : {};
  const windows =
    context.windows && typeof context.windows === "object"
      ? (context.windows as Record<string, unknown>)
      : {};
  const sevenDay =
    windows.sevenDay && typeof windows.sevenDay === "object"
      ? (windows.sevenDay as Record<string, unknown>)
      : {};
  const thirtyDay =
    windows.thirtyDay && typeof windows.thirtyDay === "object"
      ? (windows.thirtyDay as Record<string, unknown>)
      : {};

  return [
    "USER CONTEXT SNAPSHOT",
    `Today calories in: ${numberOrDash(context.caloriesIn, " kcal")}`,
    `Today protein: ${numberOrDash(context.proteinG, " g")}`,
    `Today carbs: ${numberOrDash(context.carbsG, " g")}`,
    `Today fat: ${numberOrDash(context.fatG, " g")}`,
    `Today water: ${numberOrDash(context.waterMl, " ml")}`,
    `Doses today: ${numberOrDash(context.doseCountToday)}`,
    `Symptoms today: ${numberOrDash(context.symptomCountToday)}`,
    `Latest weight: ${numberOrDash(context.latestWeightKg, " kg")}`,
    `Latest dose name: ${textOrDash(context.latestDoseName)}`,
    `Dose today name: ${textOrDash(context.doseTodayName)}`,
    `7d sleep avg: ${numberOrDash(context.sleepAvgHours, " h")}`,
    `7d food days: ${numberOrDash(streaks.foodDays7)}`,
    `7d water days: ${numberOrDash(streaks.waterDays7)}`,
    `7d dose days: ${numberOrDash(streaks.doseDays7)}`,
    `7d logging days: ${numberOrDash(streaks.loggingDays7)}`,
    `30d logging days: ${numberOrDash(streaks.loggingDays30)}`,
    `7d protein avg: ${numberOrDash(sevenDay.proteinAvgG, " g")}`,
    `7d water avg: ${numberOrDash(sevenDay.waterAvgMl, " ml")}`,
    `7d dose adherence: ${numberOrDash(sevenDay.doseAdherencePct, "%")}`,
    `7d weight delta: ${numberOrDash(sevenDay.weightDeltaKg, " kg")}`,
    `30d protein avg: ${numberOrDash(thirtyDay.proteinAvgG, " g")}`,
    `30d water avg: ${numberOrDash(thirtyDay.waterAvgMl, " ml")}`,
    `30d dose adherence: ${numberOrDash(thirtyDay.doseAdherencePct, "%")}`,
    `30d weight delta: ${numberOrDash(thirtyDay.weightDeltaKg, " kg")}`,
    `Targets calories: ${numberOrDash(targets.calories, " kcal")}`,
    `Targets protein: ${numberOrDash(targets.proteinG, " g")}`,
    `Targets carbs: ${numberOrDash(targets.carbsG, " g")}`,
    `Targets fat: ${numberOrDash(targets.fatG, " g")}`,
    `Goal type: ${textOrDash(targets.goalType)}`,
    `Targets source: ${textOrDash(targets.source)}`,
  ].join("\n");
}

function systemPrompt(locale: Locale, context: UserContextSnapshot) {
  const languageLine =
    locale === "en"
      ? "Answer in English unless the user switches language."
      : "Responde en español mexicano-neutral por defecto, salvo que el usuario cambie de idioma.";

  return [
    "You are El Fantasma, PACO's inner voice: a calm observer of the user's health map.",
    "Persona: librarian, witness, conscience, and practical assistant. You observe patterns and cite what la literatura reports. You are not a clinician.",
    languageLine,
    "Sé breve. 2-4 frases por defecto. Una sola pregunta máximo, y solo si hace falta. Nada de relleno corporativo ni presentaciones largas.",
    "Registro: directo, seco, cálido. Como un viejo amigo que lee bien y no desperdicia palabras. Di la verdad simple del mapa primero.",
    "",
    "Hard rules:",
    "- Never recommend, change, or adjust medication, peptide, vitamin, or supplement doses.",
    "- Never diagnose disease, side effects, or medical conditions.",
    "- Never say you are the user's doctor or that you are treating them.",
    "- Redirect medical decisions to: verifícalo con tu médico.",
    "- You may explain general literature patterns, help prepare questions, and suggest non-medical tracking actions like logging water, food, sleep, symptoms, or weight.",
    "- Keep answers short, concrete, and warm. No theatrics. No vendor recommendations.",
    "- Responde en texto plano, sin markdown, sin asteriscos, sin encabezados.",
    "",
    contextBlock(context),
  ].join("\n");
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

async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const bearerUser = await getBearerUser(req.headers.get("authorization"));
  if (bearerUser) return bearerUser;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

function rateHeaders(input: { limit: number; remaining: number; reset: number }) {
  return {
    "X-RateLimit-Limit": String(input.limit),
    "X-RateLimit-Remaining": String(input.remaining),
    "X-RateLimit-Reset": String(input.reset),
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const { messages, locale = "es", context } = (body ?? {}) as {
    messages?: unknown;
    locale?: unknown;
    context?: unknown;
  };

  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(400, { error: "invalid_messages" });
  }
  if (!context || typeof context !== "object") {
    return jsonResponse(400, { error: "invalid_context" });
  }

  const chatMessages: FantasmaMessage[] = [];
  for (const message of messages) {
    if (!isFantasmaMessage(message)) {
      return jsonResponse(400, { error: "invalid_messages" });
    }
    chatMessages.push(message);
  }

  const latestUser = [...chatMessages].reverse().find((message) => message.role === "user");
  if (!latestUser) return jsonResponse(400, { error: "invalid_messages" });

  let user: AuthenticatedUser | null;
  try {
    user = await getAuthenticatedUser(req);
  } catch (error) {
    console.error("[fantasma] auth", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "auth_failed" });
  }
  if (!user) return jsonResponse(401, { error: "unauthorized" });

  const remaining = await fantasmaRateLimit.getRemaining(user.id);
  if (remaining.remaining <= 0) {
    return jsonResponse(
      429,
      { error: "quota_exhausted", retry_after: remaining.reset },
      {
        ...rateHeaders({ ...remaining, remaining: 0 }),
        "Retry-After": String(Math.max(1, Math.ceil((remaining.reset - Date.now()) / 1000))),
      },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse(500, { error: "missing_anthropic_key" });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(locale, context as UserContextSnapshot),
      messages: sanitizeMessages(chatMessages),
    });

    const text = response.content
      .map((part) => ("text" in part ? part.text : ""))
      .join("")
      .trim();
    if (!text) return jsonResponse(502, { error: "empty_model_response" }, rateHeaders(remaining));

    // SAM-82: quota is consumed only after a successful model call.
    const committed = await fantasmaRateLimit.limit(user.id);

    return jsonResponse(
      200,
      {
        message: {
          role: "assistant",
          content: text,
        },
        model: MODEL,
      },
      rateHeaders(committed),
    );
  } catch (error: unknown) {
    console.error("[fantasma]", error);
    Sentry.captureException(error);
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : undefined;
    const code = status === 429 ? "provider_rate_limited" : "model_failed";
    return jsonResponse(502, { error: code }, rateHeaders(remaining));
  }
}
