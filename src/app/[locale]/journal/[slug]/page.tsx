/**
 * Journal article detail — EN locale.
 * Forwards ES traffic to /es/diario/[slug] canonical URL.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { loadArticle, loadArticles, type Locale } from "@/lib/journal/articles";
import { buildMetadata, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const navLinkStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  textDecoration: "none",
};

const backLinkStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "15px",
  color: "var(--pp-text-secondary)",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "2.5rem",
};

const dateStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-text-tertiary)",
  fontWeight: 500,
  margin: 0,
};

const titleStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "clamp(36px, 6vw, 52px)",
  lineHeight: 1.05,
  letterSpacing: "-0.01em",
  fontWeight: 400,
  color: "var(--pp-text)",
  margin: "0.75rem 0 2.5rem",
};

const pStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "17px",
  lineHeight: 1.75,
  color: "var(--pp-text)",
  margin: "0 0 1.25rem",
};

const ulStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "17px",
  lineHeight: 1.75,
  color: "var(--pp-text)",
  margin: "0 0 1.25rem",
  paddingLeft: "1.5rem",
  listStyle: "disc",
};

const liStyle: React.CSSProperties = {
  marginBottom: "0.5rem",
};

const strongStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--pp-text)",
};

const emStyle: React.CSSProperties = {
  fontStyle: "italic",
  color: "var(--pp-text-secondary)",
};

const hrStyle: React.CSSProperties = {
  border: "none",
  borderTop: "0.5px solid var(--pp-border)",
  margin: "3rem 0",
};

const h2Style: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "clamp(22px, 2.8vw, 26px)",
  lineHeight: 1.3,
  fontWeight: 500,
  color: "var(--pp-text)",
  margin: "3rem 0 1rem",
};

const h3Style: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 500,
  color: "var(--pp-text-secondary)",
  margin: "2rem 0 0.75rem",
};

export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  if (params.locale !== "en") return [];
  const articles = await loadArticles("en");
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== "en") {
    return { alternates: { canonical: `${SITE_URL}/es/diario/${slug}` } };
  }
  const article = await loadArticle("en", slug);
  if (!article) return { title: "PACO Peptide" };
  return buildMetadata({
    locale: "en",
    title: `${article.title} — PACO Peptide`,
    description: article.summary,
    pathname: `/en/journal/${slug}`,
    type: "article",
    publishedTime: article.date,
  });
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
  if (locale === "es") {
    redirect({ href: `/diario/${slug}`, locale: "es" });
  }
  setRequestLocale(locale);

  const article = await loadArticle(locale as Locale, slug);
  if (!article) notFound();

  const t = await getTranslations("home");
  const tAuth = await getTranslations("auth");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav
        style={{
          maxWidth: "880px",
          width: "100%",
          margin: "0 auto",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/" style={navLinkStyle}>
          {tAuth("nav_brand")}
        </Link>
        <LocaleSwitcher variant="dark" />
      </nav>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "680px",
          margin: "0 auto",
          padding: "3rem 2rem 5rem",
        }}
      >
        <Link href="/journal" style={backLinkStyle}>
          {t("diario_back")}
        </Link>
        <p style={dateStyle}>{article.date}</p>
        <h1 style={titleStyle}>{article.title}</h1>

        <ReactMarkdown
          components={{
            h2: (props) => <h2 style={h2Style} {...props} />,
            h3: (props) => <h3 style={h3Style} {...props} />,
            p: (props) => <p style={pStyle} {...props} />,
            ul: (props) => <ul style={ulStyle} {...props} />,
            li: (props) => <li style={liStyle} {...props} />,
            a: (props) => (
              <a
                className="pp-link"
                style={{ color: "var(--pp-accent)" }}
                {...props}
              />
            ),
            strong: (props) => <strong style={strongStyle} {...props} />,
            em: (props) => <em style={emStyle} {...props} />,
            hr: (props) => <hr style={hrStyle} {...props} />,
          }}
        >
          {article.body}
        </ReactMarkdown>
      </main>
    </div>
  );
}
