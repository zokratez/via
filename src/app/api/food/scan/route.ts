import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { isActiveSubscriber } from "@/lib/subscription";
import { foodScanRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4.1-mini";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type DetectedFood = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  quantity?: number;
  unit?: string;
  servingDescription?: string;
  fdcId?: number;
};

type FoodVisionResult = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  detectedFoods: DetectedFood[];
  provider: "openai";
  model: string;
};

const FOOD_SCAN_JSON_SCHEMA = {
  name: "food_scan",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["calories", "protein", "carbs", "fat", "confidence", "detectedFoods"],
    properties: {
      calories: { type: "number" },
      protein: { type: "number" },
      carbs: { type: "number" },
      fat: { type: "number" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      detectedFoods: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "calories",
            "protein",
            "carbs",
            "fat",
            "confidence",
            "quantity",
            "unit",
            "servingDescription",
            "fdcId",
          ],
          properties: {
            name: { type: "string" },
            calories: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            servingDescription: { type: ["string", "null"] },
            fdcId: { type: ["number", "null"] },
          },
        },
      },
    },
  },
  strict: true,
} as const;

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function roundMacro(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round(number * 10) / 10)
    : 0;
}

function clampConfidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function normalizeFood(value: unknown): DetectedFood {
  const food = (value ?? {}) as Partial<DetectedFood>;
  return {
    name: typeof food.name === "string" ? food.name.slice(0, 120) : "food",
    calories: roundMacro(food.calories),
    protein: roundMacro(food.protein),
    carbs: roundMacro(food.carbs),
    fat: roundMacro(food.fat),
    confidence: clampConfidence(food.confidence),
    quantity: typeof food.quantity === "number" ? food.quantity : undefined,
    unit: typeof food.unit === "string" ? food.unit.slice(0, 40) : undefined,
    servingDescription:
      typeof food.servingDescription === "string"
        ? food.servingDescription.slice(0, 180)
        : undefined,
    fdcId: typeof food.fdcId === "number" ? food.fdcId : undefined,
  };
}

function normalizeResult(value: unknown): FoodVisionResult {
  const parsed = (value ?? {}) as Partial<FoodVisionResult>;
  const detectedFoods = Array.isArray(parsed.detectedFoods)
    ? parsed.detectedFoods.map(normalizeFood)
    : [];
  return {
    calories: roundMacro(parsed.calories),
    protein: roundMacro(parsed.protein),
    carbs: roundMacro(parsed.carbs),
    fat: roundMacro(parsed.fat),
    confidence: clampConfidence(parsed.confidence),
    detectedFoods,
    provider: "openai",
    model: MODEL,
  };
}

function outputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}) {
  return (
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((content) => content.text)
      ?.text ??
    ""
  );
}

function parseOpenAiError(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        code?: unknown;
        message?: unknown;
        param?: unknown;
        type?: unknown;
      };
    };
    const error = parsed.error;
    if (!error) return null;
    return {
      code: typeof error.code === "string" ? error.code : "openai_error",
      message:
        typeof error.message === "string"
          ? error.message.slice(0, 500)
          : "OpenAI request failed.",
      param: typeof error.param === "string" ? error.param : undefined,
      type: typeof error.type === "string" ? error.type : undefined,
    };
  } catch {
    return null;
  }
}

async function getBearerUser(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("missing_supabase_env");

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  return {
    id: user.id,
    subscriptionTier: profile?.subscription_tier ?? "free",
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "missing_openai_key" });
  }

  let user: Awaited<ReturnType<typeof getBearerUser>>;
  try {
    user = await getBearerUser(req.headers.get("authorization"));
  } catch (error) {
    console.error("[food/scan] auth", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "auth_failed" });
  }
  if (!user) return jsonResponse(401, { error: "unauthorized" });

  const isPro = isActiveSubscriber(user.subscriptionTier);
  let rateHeaders: HeadersInit | undefined;
  if (!isPro) {
    const limit = await foodScanRateLimit.limit(user.id);
    rateHeaders = {
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.reset),
    };
    if (!limit.success) {
      return jsonResponse(429, { error: "quota_exhausted" }, rateHeaders);
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonResponse(400, { error: "invalid_body" }, rateHeaders);
  }

  const file = formData.get("file");
  const locale = formData.get("locale");
  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" }, rateHeaders);
  }
  if (!(file instanceof File)) {
    return jsonResponse(400, { error: "missing_file" }, rateHeaders);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return jsonResponse(400, { error: "invalid_type" }, rateHeaders);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return jsonResponse(413, { error: "file_too_large" }, rateHeaders);
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const language = locale === "es" ? "Spanish" : "English";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "system",
            content:
              "You estimate food macros from meal photos for a nutrition journal. Return careful estimates, not medical advice.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Identify visible foods and estimate calories, protein, carbs, and fat. Use ${language} food names when obvious. If uncertain, lower confidence instead of inventing precision.`,
              },
              {
                type: "input_image",
                image_url: `data:${file.type};base64,${bytes.toString("base64")}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            ...FOOD_SCAN_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const upstream = parseOpenAiError(body);
      console.error("[food/scan] openai", response.status, upstream ?? body.slice(0, 1200));
      return jsonResponse(
        502,
        {
          error: "analysis_failed",
          upstream: upstream ?? {
            code: "openai_error",
            message: body.slice(0, 500) || "OpenAI request failed.",
          },
        },
        rateHeaders,
      );
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const text = outputText(payload);
    if (!text) return jsonResponse(502, { error: "bad_ai_response" }, rateHeaders);

    const result = normalizeResult(JSON.parse(text));
    return jsonResponse(200, { result }, rateHeaders);
  } catch (error) {
    console.error("[food/scan]", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "analysis_failed" }, rateHeaders);
  }
}
