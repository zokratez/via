/**
 * Journal article loader.
 *
 * Articles are markdown files in src/content/articles/{locale}/ with
 * YAML-ish frontmatter:
 *
 *   ---
 *   title: "..."
 *   slug: "..."
 *   date: "2026-05-11"
 *   summary: "..."
 *   ---
 *   (body markdown)
 *
 * Frontmatter parser is intentionally tiny — supports quoted string
 * values only. No new dependency added.
 *
 * URL contract: frontmatter `slug` is authoritative for routing. The
 * filename is informational. If they disagree, the slug wins; the
 * filename is just a hint for the human editing the file.
 */

import fs from "node:fs/promises";
import path from "node:path";

export type Locale = "es" | "en";

export type ArticleMeta = {
  title: string;
  slug: string;
  date: string; // ISO yyyy-mm-dd
  summary: string;
};

export type Article = ArticleMeta & {
  body: string;
};

const ARTICLES_ROOT = path.join(process.cwd(), "src/content/articles");

function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const [, frontmatterRaw, body] = match;
  const meta: Record<string, string> = {};
  for (const line of frontmatterRaw.split("\n")) {
    const m = line.match(/^(\w+):\s*"([^"]*)"\s*$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, body };
}

function toArticleMeta(meta: Record<string, string>): ArticleMeta | null {
  const { title, slug, date, summary } = meta;
  if (!title || !slug || !date || !summary) return null;
  return { title, slug, date, summary };
}

export async function loadArticles(locale: Locale): Promise<ArticleMeta[]> {
  const dir = path.join(ARTICLES_ROOT, locale);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const articles: ArticleMeta[] = [];
  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const { meta } = parseFrontmatter(raw);
    const article = toArticleMeta(meta);
    if (article) articles.push(article);
  }
  // Newest first.
  articles.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return articles;
}

export async function loadArticle(
  locale: Locale,
  slug: string,
): Promise<Article | null> {
  const articles = await loadArticles(locale);
  const meta = articles.find((a) => a.slug === slug);
  if (!meta) return null;
  const dir = path.join(ARTICLES_ROOT, locale);
  // Match by slug — if filename != slug, we need to scan. Cheap.
  const entries = await fs.readdir(dir);
  for (const file of entries) {
    if (!file.endsWith(".md")) continue;
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const { meta: fmMeta, body } = parseFrontmatter(raw);
    if (fmMeta.slug === slug) {
      return { ...meta, body: body.trim() };
    }
  }
  return null;
}
