import { getTranslations } from "next-intl/server";
import { loadArticles } from "@/lib/journal/articles";
import { SITE_URL } from "@/lib/seo";
import { routing } from "@/i18n/routing";

export const revalidate = 600;
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (locale !== "es" && locale !== "en") {
    return new Response("not found", { status: 404 });
  }

  const t = await getTranslations({ locale, namespace: "home" });
  const channelTitle = t("seo_diario_title");
  const channelDescription = t("seo_diario_description");
  const journalSegment = locale === "es" ? "diario" : "journal";
  const channelLink = `${SITE_URL}/${locale}/${journalSegment}`;
  const feedUrl = `${SITE_URL}/${locale}/feed.xml`;
  const lastBuildDate = new Date().toUTCString();

  const articles = await loadArticles(locale);

  const items = articles
    .map((a) => {
      const url = `${SITE_URL}/${locale}/${journalSegment}/${a.slug}`;
      const pubDate = new Date(`${a.date}T00:00:00Z`).toUTCString();
      return [
        "    <item>",
        `      <title>${xmlEscape(a.title)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <description>${cdata(a.summary)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(channelTitle)}</title>
    <link>${xmlEscape(channelLink)}</link>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(channelDescription)}</description>
    <language>${locale}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
