import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { getReviewsAdminClient } from "@/lib/reviews/admin-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return jsonResponse(400, { error: "invalid_id" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_body" });
  }
  const { action } = (body ?? {}) as { action?: unknown };
  if (
    action !== "approve" &&
    action !== "reject" &&
    action !== "toggle_verified"
  ) {
    return jsonResponse(400, { error: "invalid_action" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonResponse(401, { error: "unauthorized" });
  if (!(await isAdmin(user.email))) {
    return jsonResponse(403, { error: "forbidden" });
  }

  const admin = getReviewsAdminClient();

  if (action === "toggle_verified") {
    const { data: current, error: readErr } = await admin
      .from("user_reviews")
      .select("verified")
      .eq("id", id)
      .maybeSingle();
    if (readErr || !current) {
      console.error("[admin/reviews] read", readErr);
      return jsonResponse(500, { error: "generic" });
    }
    const next = !(current as { verified: boolean }).verified;
    const { error: updateErr } = await admin
      .from("user_reviews")
      .update({ verified: next })
      .eq("id", id);
    if (updateErr) {
      console.error("[admin/reviews] toggle", updateErr);
      return jsonResponse(500, { error: "generic" });
    }
    return jsonResponse(200, { ok: true, verified: next });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const { error } = await admin
    .from("user_reviews")
    .update({ status })
    .eq("id", id);
  if (error) {
    console.error("[admin/reviews] status", error);
    return jsonResponse(500, { error: "generic" });
  }
  return jsonResponse(200, { ok: true, status });
}
