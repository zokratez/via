import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKETS = ["food-photos", "progress-photos", "receipts"] as const;
const EXPLICIT_DELETE_TABLES = ["today_users", "analytics_events"] as const;
const STORAGE_REMOVE_CHUNK_SIZE = 100;

type AuthenticatedUser = {
  id: string;
};

type StorageEntry = {
  name: string;
  id?: string | null;
  metadata?: unknown;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("missing_supabase_url");
  return url;
}

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("missing_supabase_service_role_env");

  return createSupabaseJsClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getBearerUser(authHeader: string | null): Promise<AuthenticatedUser | null> {
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) throw new Error("missing_supabase_anon_env");

  const supabase = createSupabaseJsClient(getSupabaseUrl(), anon, {
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

function isFolder(entry: StorageEntry) {
  return entry.id === null || entry.metadata === null || entry.metadata === undefined;
}

async function listStoragePaths(
  admin: ReturnType<typeof getAdminClient>,
  bucket: (typeof STORAGE_BUCKETS)[number],
  prefix: string,
) {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, {
        limit: STORAGE_REMOVE_CHUNK_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw new Error(`storage_list_failed:${bucket}:${error.message}`);

    const entries = (data ?? []) as StorageEntry[];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const fullPath = `${prefix}/${entry.name}`;
      if (isFolder(entry)) {
        paths.push(...(await listStoragePaths(admin, bucket, fullPath)));
      } else {
        paths.push(fullPath);
      }
    }

    if (entries.length < STORAGE_REMOVE_CHUNK_SIZE) break;
    offset += entries.length;
  }

  return paths;
}

async function removeStoragePrefix(
  admin: ReturnType<typeof getAdminClient>,
  bucket: (typeof STORAGE_BUCKETS)[number],
  userId: string,
) {
  const paths = await listStoragePaths(admin, bucket, userId);
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK_SIZE) {
    const chunk = paths.slice(i, i + STORAGE_REMOVE_CHUNK_SIZE);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`storage_remove_failed:${bucket}:${error.message}`);
  }
  return paths.length;
}

async function deleteExplicitRows(admin: ReturnType<typeof getAdminClient>, userId: string) {
  for (const table of EXPLICIT_DELETE_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`table_delete_failed:${table}:${error.message}`);
  }
}

function isAlreadyDeletedUserError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;

  return status === 404 || message.includes("not found") || message.includes("user not found");
}

export async function DELETE(req: NextRequest) {
  let user: AuthenticatedUser | null;
  try {
    user = await getBearerUser(req.headers.get("authorization"));
  } catch (error) {
    console.error("[account/delete] auth failed", error);
    Sentry.captureException(error);
    return jsonResponse(500, { error: "auth_failed" });
  }

  if (!user) return jsonResponse(401, { error: "unauthorized" });

  const admin = getAdminClient();
  const storageDeleted: Record<string, number> = {};

  try {
    // Delete user-owned storage before auth deletion; auth cascades cannot clean buckets.
    for (const bucket of STORAGE_BUCKETS) {
      storageDeleted[bucket] = await removeStoragePrefix(admin, bucket, user.id);
    }

    // These tables do not cascade from auth.users in the verified schema.
    await deleteExplicitRows(admin, user.id);
  } catch (error) {
    console.error("[account/delete] purge failed", {
      user_id: user.id,
      error,
    });
    Sentry.captureException(error);
    return jsonResponse(500, {
      error: "purge_failed",
      message: "Account deletion was not completed. No auth user was deleted.",
    });
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error && !isAlreadyDeletedUserError(error)) throw error;
  } catch (error) {
    console.error("[account/delete] auth user delete failed", {
      user_id: user.id,
      error,
    });
    Sentry.captureException(error);
    return jsonResponse(500, { error: "auth_delete_failed" });
  }

  return jsonResponse(200, {
    ok: true,
    deleted: true,
    storage_deleted: storageDeleted,
  });
}
