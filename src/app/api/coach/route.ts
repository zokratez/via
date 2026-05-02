import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSystemPrompt } from "@/lib/coach/system-prompt";
import {
  checkUserMessage,
  type GuardrailHit,
} from "@/lib/coach/guardrails";
import { findReferrals, buildReferralInjection } from "@/lib/coach/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 1024;
const FREE_TIER_DAILY_LIMIT = 3;

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

function todayInMexicoCity(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function isChatMessage(v: unknown): v is ChatMessage {
  if (!v || typeof v !== "object") return false;
  const r = (v as { role?: unknown }).role;
  const c = (v as { content?: unknown }).content;
  return (r === "user" || r === "assistant") && typeof c === "string";
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const { messages, threadId, locale } = (body ?? {}) as {
    messages?: unknown;
    threadId?: unknown;
    locale?: unknown;
  };

  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(400, { error: "invalid_messages" });
  }
  const chatMessages: ChatMessage[] = [];
  for (const m of messages) {
    if (!isChatMessage(m)) {
      return jsonResponse(400, { error: "invalid_messages" });
    }
    chatMessages.push(m);
  }
  const latestUser = [...chatMessages].reverse().find((m) => m.role === "user");
  if (!latestUser) {
    return jsonResponse(400, { error: "invalid_messages" });
  }
  const incomingThreadId =
    typeof threadId === "string" && threadId.length > 0 ? threadId : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_price_id")
    .eq("id", user.id)
    .maybeSingle();

  const isPro = profile?.stripe_price_id != null;
  const today = todayInMexicoCity();

  let usedToday = 0;
  if (!isPro) {
    const { data: counter } = await supabase
      .from("usage_counters")
      .select("coach_queries")
      .eq("user_id", user.id)
      .eq("day", today)
      .maybeSingle();

    usedToday = counter?.coach_queries ?? 0;
    if (usedToday >= FREE_TIER_DAILY_LIMIT) {
      return jsonResponse(429, { error: "quota_exhausted" });
    }
  }

  // Resolve or create thread
  let threadIdToUse: string | null = null;
  if (incomingThreadId) {
    const { data: existing } = await supabase
      .from("coach_threads")
      .select("id")
      .eq("id", incomingThreadId)
      .maybeSingle();
    if (existing) threadIdToUse = existing.id;
  }
  if (!threadIdToUse) {
    const title = latestUser.content.slice(0, 60);
    const { data: created, error: createErr } = await supabase
      .from("coach_threads")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (createErr || !created) {
      return jsonResponse(500, { error: "generic" });
    }
    threadIdToUse = created.id;
  }
  const finalThreadId = threadIdToUse;

  // Persist the user message
  {
    const { error: userMsgErr } = await supabase
      .from("coach_messages")
      .insert({
        thread_id: finalThreadId,
        user_id: user.id,
        role: "user",
        content: latestUser.content,
      });
    if (userMsgErr) {
      return jsonResponse(500, { error: "generic" });
    }
  }

  const guardrail: GuardrailHit | null = checkUserMessage(
    latestUser.content,
    locale,
  );

  const tCoach = await getTranslations({ locale, namespace: "coach" });

  // Referral path: augment the system prompt with vetted providers (or
  // a directory-fallback instruction when the table is empty / no fit)
  // and fall through to the streaming Anthropic path. Quota counts.
  // profiles.country / profiles.state do not exist yet; default to US.
  let referralInjection = "";
  if (guardrail?.category === "referral_request") {
    const referrals = await findReferrals({
      locale,
      country: "US",
      limit: 3,
    });
    referralInjection = buildReferralInjection(locale, referrals);
  }

  // Canned guardrail path: send canned response, do NOT increment quota.
  // referral_request is excluded — it streams from the model above.
  if (guardrail && guardrail.category !== "referral_request") {
    const cannedKey = `canned.${guardrail.category}` as const;
    const cannedText = tCoach(cannedKey);

    await supabase.from("coach_messages").insert({
      thread_id: finalThreadId,
      user_id: user.id,
      role: "assistant",
      content: cannedText,
    });
    await supabase
      .from("coach_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", finalThreadId);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "meta",
              threadId: finalThreadId,
              guardrail: guardrail.category,
            }),
          ),
        );
        controller.enqueue(
          encoder.encode(sseEvent({ type: "text", content: cannedText })),
        );
        controller.enqueue(encoder.encode(sseEvent({ type: "done" })));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Anthropic path
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "generic" });
  }
  const client = new Anthropic({ apiKey });

  const anthropicMessages = chatMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";
      try {
        controller.enqueue(
          encoder.encode(
            sseEvent({ type: "meta", threadId: finalThreadId }),
          ),
        );

        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: getSystemPrompt(locale) + referralInjection,
          messages: anthropicMessages,
        });

        anthropicStream.on("text", (delta) => {
          fullContent += delta;
          controller.enqueue(
            encoder.encode(sseEvent({ type: "text", content: delta })),
          );
        });

        await anthropicStream.finalMessage();

        // Persist + increment quota
        await supabase.from("coach_messages").insert({
          thread_id: finalThreadId,
          user_id: user.id,
          role: "assistant",
          content: fullContent,
        });
        await supabase
          .from("coach_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", finalThreadId);

        if (!isPro) {
          await supabase.from("usage_counters").upsert(
            {
              user_id: user.id,
              day: today,
              coach_queries: usedToday + 1,
            },
            { onConflict: "user_id,day" },
          );
        }

        controller.enqueue(encoder.encode(sseEvent({ type: "done" })));
        controller.close();
      } catch (err: unknown) {
        console.error("[coach]", err);
        Sentry.captureException(err);
        const status =
          err && typeof err === "object" && "status" in err
            ? (err as { status?: number }).status
            : undefined;
        const key = status === 429 ? "rate_limit" : "generic";
        controller.enqueue(
          encoder.encode(sseEvent({ type: "error", key })),
        );
        controller.enqueue(encoder.encode(sseEvent({ type: "done" })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
