/**
 * Publish approved article drafts to git via GitHub Contents/Data API.
 *
 * Flow:
 *   1. Pull all article_drafts where status='approved', oldest first.
 *   2. Build .md content for each (frontmatter + body).
 *   3. Atomic multi-file commit via Git Data API:
 *        create blob (per file) → create tree → create commit → update ref
 *      One commit covers all files in this run, not N commits.
 *   4. After successful ref update, mark drafts as published with the
 *      new commit SHA.
 *
 * Why Git Data API (and not Contents API PUT-per-file):
 *   Contents PUT creates one commit per file. Two approved drafts =
 *   two commits + two CI runs. The atomic-commit pattern keeps the
 *   ES+EN pair in a single commit, matching how Sam ships articles
 *   manually today.
 *
 * Concurrency: PATCH /git/refs uses force=false. If main moved between
 * our parent-read and ref-update, GitHub returns 422 and we fail loudly.
 * The next run picks up the same still-'approved' drafts and retries.
 * No force push, no rebase, no rewrite (per spec).
 *
 * Failure modes:
 *   • Format error per draft → skip that draft, continue with others.
 *   • Git side fails before commit lands → no DB update, drafts stay
 *     'approved' for retry.
 *   • Git side succeeds but DB update fails → loud log; cron will
 *     attempt to republish next run. The DB partial unique index on
 *     (language, slug) where status='published' is empty (because the
 *     update never landed), so the next run is allowed; the resulting
 *     commit will rewrite the same content (idempotent on file bytes).
 *
 * HARD CAP: 20 drafts per invocation.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const GITHUB_API = "https://api.github.com";
const REPO_OWNER = "zokratez";
const REPO_NAME = "via";
const REPO_BRANCH = "main";
const HARD_CAP = 20;
const ARTICLE_PATH_PREFIX = "src/content/articles";

type Draft = {
  id: string;
  source_pubmed_id: string | null;
  language: "es" | "en";
  status: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  reviewed_at: string | null;
  generated_at: string;
};

type FileSpec = {
  path: string;
  content: string;
  draftId: string;
};

type BlobSpec = FileSpec & { blobSha: string };

// ---------------------------------------------------------------
// Clients
// ---------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getGitHubPat(): string {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    throw new Error("GITHUB_PAT missing");
  }
  return pat;
}

async function ghFetch(
  pat: string,
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${GITHUB_API}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${pat}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${init.method ?? "GET"} ${url} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

// ---------------------------------------------------------------
// Markdown file construction
// ---------------------------------------------------------------

function yamlString(s: string): string {
  // Double-quoted YAML string: escape backslash, then double quote.
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function stripNewlines(s: string): string {
  return s.replace(/\s*\n+\s*/g, " ").trim();
}

function formatDate(reviewedAt: string | null, fallbackIso: string): string {
  const iso = reviewedAt ?? fallbackIso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // Fall back to today if Date parsing fails (shouldn't happen for
    // Postgres timestamps but defensive).
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function formatMarkdownFile(draft: Draft): string {
  const date = formatDate(draft.reviewed_at, draft.generated_at);
  const lines: (string | null)[] = [
    "---",
    `title: ${yamlString(draft.title)}`,
    `slug: ${yamlString(draft.slug)}`,
    `date: ${yamlString(date)}`,
    `summary: ${yamlString(stripNewlines(draft.summary))}`,
    draft.source_pubmed_id
      ? `source_pubmed_id: ${yamlString(draft.source_pubmed_id)}`
      : null,
    "---",
    "",
    draft.body.trim(),
    "", // trailing newline
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

function buildCommitMessage(drafts: Draft[]): string {
  const slugs = drafts.map((d) => `${d.language}/${d.slug}`).join(", ");
  const slugPart = slugs.length > 80 ? `${slugs.slice(0, 77)}...` : slugs;
  return `feat(diario): publish ${drafts.length} article(s) — ${slugPart}`;
}

// ---------------------------------------------------------------
// GitHub Git Data API operations
// ---------------------------------------------------------------

async function getCurrentBranchSha(pat: string): Promise<string> {
  const res = await ghFetch(
    pat,
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${REPO_BRANCH}`,
  );
  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

async function getCommitTreeSha(pat: string, commitSha: string): Promise<string> {
  const res = await ghFetch(
    pat,
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${commitSha}`,
  );
  const data = (await res.json()) as { tree: { sha: string } };
  return data.tree.sha;
}

async function createBlob(pat: string, content: string): Promise<string> {
  const res = await ghFetch(
    pat,
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
    {
      method: "POST",
      body: JSON.stringify({ content, encoding: "utf-8" }),
    },
  );
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function createTree(
  pat: string,
  baseTreeSha: string,
  entries: { path: string; sha: string }[],
): Promise<string> {
  const res = await ghFetch(pat, `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: entries.map((e) => ({
        path: e.path,
        mode: "100644",
        type: "blob",
        sha: e.sha,
      })),
    }),
  });
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function createCommit(
  pat: string,
  message: string,
  treeSha: string,
  parentSha: string,
): Promise<string> {
  const res = await ghFetch(pat, `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function updateBranchRef(pat: string, newCommitSha: string): Promise<void> {
  // force=false (default). If main moved between read and update,
  // GitHub returns 422 and we fail. Next cron run retries.
  await ghFetch(
    pat,
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${REPO_BRANCH}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommitSha, force: false }),
    },
  );
}

// ---------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------

export async function publishApprovedDrafts(): Promise<{
  published: number;
  skipped: number;
  errors: number;
  commit_sha?: string;
}> {
  const admin = getAdminClient();

  const { data: rows, error: fetchErr } = await admin
    .from("article_drafts")
    .select(
      "id, source_pubmed_id, language, status, title, slug, summary, body, reviewed_at, generated_at",
    )
    .eq("status", "approved")
    .order("reviewed_at", { ascending: true, nullsFirst: false })
    .limit(HARD_CAP);
  if (fetchErr) {
    throw new Error(`approved-drafts fetch failed: ${fetchErr.message}`);
  }

  const drafts: Draft[] = (rows ?? []) as Draft[];
  if (drafts.length === 0) {
    return { published: 0, skipped: 0, errors: 0 };
  }

  // Build file specs. Per-draft format errors are skipped; the rest
  // still publish.
  const fileSpecs: FileSpec[] = [];
  let skipped = 0;
  for (const draft of drafts) {
    try {
      const path = `${ARTICLE_PATH_PREFIX}/${draft.language}/${draft.slug}.md`;
      const content = formatMarkdownFile(draft);
      fileSpecs.push({ path, content, draftId: draft.id });
    } catch (err) {
      console.error("[publisher] format failed", { draftId: draft.id, err });
      skipped += 1;
    }
  }

  if (fileSpecs.length === 0) {
    return { published: 0, skipped, errors: 0 };
  }

  const pat = getGitHubPat();
  let commitSha: string;
  let publishedDraftIds: string[];

  try {
    const branchSha = await getCurrentBranchSha(pat);
    const baseTreeSha = await getCommitTreeSha(pat, branchSha);

    // Create blobs in parallel — small files, well under any
    // rate-limit pressure (5000 req/hr per PAT).
    const blobs: BlobSpec[] = await Promise.all(
      fileSpecs.map(async (f) => ({
        ...f,
        blobSha: await createBlob(pat, f.content),
      })),
    );

    const treeSha = await createTree(
      pat,
      baseTreeSha,
      blobs.map((b) => ({ path: b.path, sha: b.blobSha })),
    );

    // Build commit message from drafts that actually made it into the tree.
    const publishedDrafts = drafts.filter((d) =>
      blobs.some((b) => b.draftId === d.id),
    );
    const message = buildCommitMessage(publishedDrafts);

    commitSha = await createCommit(pat, message, treeSha, branchSha);
    await updateBranchRef(pat, commitSha);

    publishedDraftIds = publishedDrafts.map((d) => d.id);
  } catch (err) {
    console.error("[publisher] git-side failure, no DB update", err);
    return { published: 0, skipped, errors: 1 };
  }

  // Mark drafts as published. If this fails, we log loudly — the git
  // side already landed, so the file is live but the DB still says
  // 'approved'. Next run would try to re-publish (same content, same
  // bytes, harmless rewrite).
  const { error: updateErr } = await admin
    .from("article_drafts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_commit_sha: commitSha,
    })
    .in("id", publishedDraftIds);

  if (updateErr) {
    console.error("[publisher] DB update FAILED AFTER successful commit", {
      commit_sha: commitSha,
      ids: publishedDraftIds,
      error: updateErr,
    });
    return {
      published: publishedDraftIds.length,
      skipped,
      errors: 1,
      commit_sha: commitSha,
    };
  }

  return {
    published: publishedDraftIds.length,
    skipped,
    errors: 0,
    commit_sha: commitSha,
  };
}
