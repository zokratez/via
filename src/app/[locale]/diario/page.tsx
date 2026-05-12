/**
 * Journal index — ES locale serves /es/diario.
 * EN locale requesting /en/diario is redirected to /en/journal.
 */

import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { loadArticles, type Locale } from "@/lib/journal/articles";
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

const mastStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "clamp(40px, 7vw, 56px)",
  lineHeight: 1.0,
  letterSpacing: "-0.01em",
  fontWeight: 400,
  color: "var(--pp-text)",
  margin: "0 0 3rem",
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
  fontSize: "clamp(24px, 3.2vw, 30px)",
  lineHeight: 1.2,
  fontWeight: 400,
  color: "var(--pp-text)",
  margin: "0.5rem 0 0.75rem",
  textDecoration: "none",
  display: "block",
};

const summaryStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: "17px",
  lineHeight: 1.75,
  color: "#e8ddc8",
  margin: 0,
};

const readMoreStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-accent)",
  textDecoration: "none",
  marginTop: "1rem",
  display: "inline-block",
};

const emptyStateStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "clamp(20px, 2.4vw, 24px)",
  lineHeight: 1.4,
  color: "var(--pp-text-secondary)",
  margin: "4rem 0 0",
  textAlign: "center",
};

const dividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: "0.5px solid var(--pp-border)",
  margin: "3rem 0",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "es") {
    return { alternates: { canonical: `${SITE_URL}/en/journal` } };
  }
  const t = await getTranslations({ locale, namespace: "home" });
  return buildMetadata({
    locale: "es",
    title: t("seo_diario_title"),
    description: t("seo_diario_description"),
    pathname: "/es/diario",
    type: "website",
    languages: { es: `${SITE_URL}/es/diario`, en: `${SITE_URL}/en/journal` },
  });
}

export default async function DiarioIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
  // EN should use /journal, not /diario. Forward to canonical EN URL.
  if (locale === "en") {
    redirect({ href: "/journal", locale: "en" });
  }
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tAuth = await getTranslations("auth");

  const articles = await loadArticles(locale as Locale);

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
        <h1 style={mastStyle}>{t("nav_diario")}</h1>

        {articles.length === 0 ? (
          <p style={emptyStateStyle}>{t("diario_empty_state")}</p>
        ) : (
          articles.map((article, i) => (
            <article key={article.slug}>
              {i > 0 && <hr style={dividerStyle} />}
              <p style={dateStyle}>{article.date}</p>
              <Link
                href={`/diario/${article.slug}`}
                style={titleStyle}
              >
                {article.title}
              </Link>
              <p style={summaryStyle}>{article.summary}</p>
              <Link
                href={`/diario/${article.slug}`}
                style={readMoreStyle}
              >
                {t("diario_read_more")}
              </Link>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
