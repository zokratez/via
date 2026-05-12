import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { loadArticles } from "@/lib/journal/articles";

const STATIC_PATHS: { es: string; en: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { es: "/es", en: "/en", changeFrequency: "weekly", priority: 1.0 },
  { es: "/es/diario", en: "/en/journal", changeFrequency: "daily", priority: 0.9 },
  { es: "/es/privacy", en: "/en/privacy", changeFrequency: "yearly", priority: 0.3 },
  { es: "/es/terms", en: "/en/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Static localized pages.
  for (const p of STATIC_PATHS) {
    entries.push({
      url: `${SITE_URL}${p.es}`,
      lastModified: now,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    });
    entries.push({
      url: `${SITE_URL}${p.en}`,
      lastModified: now,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    });
  }

  // Article detail pages, both locales.
  const [esArticles, enArticles] = await Promise.all([
    loadArticles("es"),
    loadArticles("en"),
  ]);
  for (const a of esArticles) {
    entries.push({
      url: `${SITE_URL}/es/diario/${a.slug}`,
      lastModified: new Date(a.date),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  for (const a of enArticles) {
    entries.push({
      url: `${SITE_URL}/en/journal/${a.slug}`,
      lastModified: new Date(a.date),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
