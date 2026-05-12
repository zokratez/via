import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { buildMetadata, SITE_URL, type SeoLocale } from "@/lib/seo";

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

const h1Style: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "clamp(40px, 7vw, 56px)",
  lineHeight: 1.0,
  letterSpacing: "-0.01em",
  fontWeight: 400,
  color: "var(--pp-text)",
  margin: "0 0 0.5rem",
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const seoLocale = (locale === "en" ? "en" : "es") as SeoLocale;
  const tHome = await getTranslations({ locale: seoLocale, namespace: "home" });
  return buildMetadata({
    locale: seoLocale,
    title: tHome("seo_terms_title"),
    description: tHome("seo_terms_description"),
    pathname: `/${seoLocale}/terms`,
    type: "website",
    languages: {
      es: `${SITE_URL}/es/terms`,
      en: `${SITE_URL}/en/terms`,
    },
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  const t = await getTranslations("auth");

  const filepath = path.join(
    process.cwd(),
    "src/content/legal",
    `terms-${locale}.md`,
  );
  const markdown = await fs.readFile(filepath, "utf8");

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
          {t("nav_brand")}
        </Link>
        <LocaleSwitcher variant="dark" />
      </nav>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "680px",
          margin: "0 auto",
          padding: "2rem 2rem 5rem",
        }}
      >
        <ReactMarkdown
          components={{
            h1: (props) => <h1 style={h1Style} {...props} />,
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
          {markdown}
        </ReactMarkdown>
      </main>
    </div>
  );
}
