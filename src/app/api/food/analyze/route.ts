import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { isActiveSubscriber } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type FoodEstimate = {
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: "low" | "medium" | "high";
  uncertainty: string;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampMacro(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1000, Math.max(0, Math.round(value * 10) / 10));
}

function parseEstimate(text: string): FoodEstimate | null {
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped) as Partial<FoodEstimate>;
    const confidence =
      parsed.confidence === "high" ||
      parsed.confidence === "medium" ||
      parsed.confidence === "low"
        ? parsed.confidence
        : "low";
    return {
      description:
        typeof parsed.description === "string"
          ? parsed.description.slice(0, 500)
          : "",
      calories: clampNumber(parsed.calories, 0, 10000),
      protein_g: clampMacro(parsed.protein_g),
      carbs_g: clampMacro(parsed.carbs_g),
      fat_g: clampMacro(parsed.fat_g),
      confidence,
      uncertainty:
        typeof parsed.uncertainty === "string"
          ? parsed.uncertainty.slice(0, 500)
          : "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "missing_ai_key" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (!isActiveSubscriber(profile?.subscription_tier)) {
    return jsonResponse(403, { error: "pro_required" });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const file = formData.get("file");
  const locale = formData.get("locale");
  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" });
  }
  if (!(file instanceof File)) {
    return jsonResponse(400, { error: "missing_file" });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return jsonResponse(400, { error: "invalid_type" });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return jsonResponse(413, { error: "file_too_large" });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const client = new Anthropic({ apiKey });
    const language =
      locale === "es"
        ? "Spanish, concise and direct"
        : "English, concise and direct";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      temperature: 0,
      system:
        "You estimate nutrition from food photos. You are not exact. Return only valid JSON with no markdown. Never claim certainty. If the food is unclear, use nulls and explain uncertainty.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as "image/jpeg" | "image/png" | "image/webp",
                data: bytes.toString("base64"),
              },
            },
            {
              type: "text",
              text: `Estimate the meal nutrition from this photo for a user logging food. Return only this JSON shape:
{
  "description": "short visible meal description in ${language}",
  "calories": number_or_null,
  "protein_g": number_or_null,
  "carbs_g": number_or_null,
  "fat_g": number_or_null,
  "confidence": "low" | "medium" | "high",
  "uncertainty": "what is uncertain, portion assumptions, or what the user should confirm in ${language}"
}
Use realistic portion ranges internally but return a single best estimate. Prefer low confidence when portion size, hidden oil, sauces, or ingredients are unclear.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const estimate = parseEstimate(text);
    if (!estimate) {
      return jsonResponse(502, { error: "bad_ai_response" });
    }
    return jsonResponse(200, { estimate });
  } catch (err) {
    console.error("[food/analyze]", err);
    Sentry.captureException(err);
    return jsonResponse(500, { error: "analysis_failed" });
  }
}
