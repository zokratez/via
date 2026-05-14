import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { getDraftsAdminClient } from "@/lib/admin/drafts-admin-client";

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
  if (action !== "approve" && action !== "reject") {
    return jsonResponse(400, { error: "invalid_action" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse(401, { error: "unauthorized" });
  }
  if (!isAdmin(user.email)) {
    return jsonResponse(403, { error: "forbidden" });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const admin = getDraftsAdminClient();
  const { error, count } = await admin
    .from("article_drafts")
    .update({ status, reviewed_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("status", "pending_review");

  if (error) {
    console.error("[admin/drafts]", error);
    return jsonResponse(500, { error: "generic" });
  }
  if (!count) {
    return jsonResponse(409, { error: "not_pending" });
  }
  return jsonResponse(200, { ok: true, status });
}
