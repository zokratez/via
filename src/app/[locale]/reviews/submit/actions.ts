"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getReviewsAdminClient } from "@/lib/reviews/admin-client";

const LOCALES = ["es", "en"] as const;
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

const reviewSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  review_text: z.string().trim().min(10).max(4000),
  locale: z.enum(LOCALES),
});

export type SubmitReviewResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "validation_failed"
        | "file_too_large"
        | "invalid_file_type"
        | "upload_failed"
        | "db_failed";
    };

export async function submitReviewAction(
  formData: FormData,
): Promise<SubmitReviewResult> {
  const raw = {
    display_name: formData.get("display_name"),
    rating: formData.get("rating"),
    review_text: formData.get("review_text"),
    locale: formData.get("locale"),
  };
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation_failed" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = getReviewsAdminClient();

  let receiptUrl: string | null = null;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_RECEIPT_SIZE) {
      return { ok: false, error: "file_too_large" };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "invalid_file_type" };
    }
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
    const path = `${crypto.randomUUID()}.${safeExt}`;
    const { error: uploadErr } = await admin.storage
      .from("receipts")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadErr) {
      console.error("[reviews/upload]", uploadErr);
      return { ok: false, error: "upload_failed" };
    }
    const { data: pub } = supabase.storage
      .from("receipts")
      .getPublicUrl(path);
    receiptUrl = pub.publicUrl;
  }

  const { error } = await admin.from("user_reviews").insert({
    user_id: user?.id ?? null,
    display_name: parsed.data.display_name,
    rating: parsed.data.rating,
    review_text: parsed.data.review_text,
    receipt_image_url: receiptUrl,
    status: "pending",
    verified: false,
    locale: parsed.data.locale,
  });

  if (error) {
    console.error("[reviews/insert]", error);
    return { ok: false, error: "db_failed" };
  }

  return { ok: true };
}
