import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { isActiveSubscriber } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5-20250929";

type ProgressAnalysis = {
  summary: string;
  visible_changes: string[];
  consistency_notes: string[];
  questions_for_clinician: string[];
  confidence: "low" | "medium" | "high";
};

type ProgressPhotoRow = {
  id: string;
  storage_path: string;
  angle: string;
  captured_at: string;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.slice(0, 240))
    .slice(0, 5);
}

function parseAnalysis(text: string): ProgressAnalysis | null {
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped) as Partial<ProgressAnalysis>;
    const confidence =
      parsed.confidence === "high" ||
      parsed.confidence === "medium" ||
      parsed.confidence === "low"
        ? parsed.confidence
        : "low";
    return {
      summary:
        typeof parsed.summary === "string" ? parsed.summary.slice(0, 700) : "",
      visible_changes: parseList(parsed.visible_changes),
      consistency_notes: parseList(parsed.consistency_notes),
      questions_for_clinician: parseList(parsed.questions_for_clinician),
      confidence,
    };
  } catch {
    return null;
  }
}

async function downloadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<{
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
} | null> {
  const { data, error } = await supabase.storage
    .from("progress-photos")
    .download(storagePath);
  if (error || !data) return null;

  const arrayBuffer = await data.arrayBuffer();
  const mediaType =
    data.type === "image/png" || data.type === "image/webp"
      ? data.type
      : "image/jpeg";

  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mediaType,
  };
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

  let body: { previousId?: unknown; latestId?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }

  const previousId = typeof body.previousId === "string" ? body.previousId : "";
  const latestId = typeof body.latestId === "string" ? body.latestId : "";
  const locale = body.locale;
  if (!previousId || !latestId || previousId === latestId) {
    return jsonResponse(400, { error: "invalid_photos" });
  }
  if (locale !== "es" && locale !== "en") {
    return jsonResponse(400, { error: "invalid_locale" });
  }

  const { data: rows, error } = await supabase
    .from("progress_photos")
    .select("id,storage_path,angle,captured_at")
    .eq("user_id", user.id)
    .in("id", [previousId, latestId]);

  if (error) {
    Sentry.captureException(error);
    return jsonResponse(500, { error: "photo_lookup_failed" });
  }

  const photos = (rows ?? []) as ProgressPhotoRow[];
  const previous = photos.find((photo) => photo.id === previousId);
  const latest = photos.find((photo) => photo.id === latestId);
  if (!previous || !latest) {
    return jsonResponse(404, { error: "photos_not_found" });
  }
  if (previous.angle !== latest.angle) {
    return jsonResponse(400, { error: "angle_mismatch" });
  }

  try {
    const [previousImage, latestImage] = await Promise.all([
      downloadPhoto(supabase, previous.storage_path),
      downloadPhoto(supabase, latest.storage_path),
    ]);
    if (!previousImage || !latestImage) {
      return jsonResponse(500, { error: "download_failed" });
    }

    const client = new Anthropic({ apiKey });
    const language =
      locale === "es"
        ? "Spanish, concise and direct"
        : "English, concise and direct";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      temperature: 0,
      system:
        "You compare two user-provided progress photos. You are not a doctor and must not diagnose, estimate body-fat percentage, infer health status, infer sensitive traits, or identify the person. Describe only visible, non-sensitive differences and image consistency limits. Return only valid JSON with no markdown.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Compare these two same-angle private progress photos for a personal tracking app. Photo 1 is previous (${previous.captured_at}); Photo 2 is latest (${latest.captured_at}); angle is ${previous.angle}. Return only this JSON shape in ${language}:
{
  "summary": "brief non-medical summary of visible differences",
  "visible_changes": ["visible non-sensitive observation", "..."],
  "consistency_notes": ["lighting/pose/clothing/camera caveat", "..."],
  "questions_for_clinician": ["optional neutral question user may ask a clinician if concerned", "..."],
  "confidence": "low" | "medium" | "high"
}
Do not estimate body fat, diagnose swelling, disease, pregnancy, age, attractiveness, identity, ethnicity, mental state, or health status. If photos are inconsistent, emphasize that limits confidence.`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: previousImage.mediaType,
                data: previousImage.data,
              },
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: latestImage.mediaType,
                data: latestImage.data,
              },
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const analysis = parseAnalysis(text);
    if (!analysis) {
      return jsonResponse(502, { error: "bad_ai_response" });
    }

    const { data: saved, error: saveError } = await supabase
      .from("progress_analyses")
      .insert({
        user_id: user.id,
        previous_photo_id: previous.id,
        latest_photo_id: latest.id,
        angle: previous.angle,
        summary: analysis.summary,
        visible_changes: analysis.visible_changes,
        consistency_notes: analysis.consistency_notes,
        questions_for_clinician: analysis.questions_for_clinician,
        confidence: analysis.confidence,
      })
      .select("id,created_at")
      .single();

    if (saveError) {
      Sentry.captureException(saveError);
      return jsonResponse(500, { error: "analysis_save_failed" });
    }

    return jsonResponse(200, {
      analysis: {
        ...analysis,
        id: saved.id,
        created_at: saved.created_at,
        previous_photo_id: previous.id,
        latest_photo_id: latest.id,
        angle: previous.angle,
      },
    });
  } catch (err) {
    console.error("[progress/analyze]", err);
    Sentry.captureException(err);
    return jsonResponse(500, { error: "analysis_failed" });
  }
}
