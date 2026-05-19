import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildMetadata, SITE_URL, type SeoLocale } from "@/lib/seo";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { HomepageReviews } from "@/components/HomepageReviews";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const seoLocale = (locale === "en" ? "en" : "es") as SeoLocale;
  return buildMetadata({
    locale: seoLocale,
    title: t("seo_home_title"),
    description: t("seo_home_description"),
    pathname: `/${seoLocale}`,
    type: "website",
    keywords: t("seo_home_keywords").split(",").map((k) => k.trim()),
    languages: { es: `${SITE_URL}/es`, en: `${SITE_URL}/en` },
  });
}

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const eyebrowStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "13px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  fontWeight: 500,
};

const navLinkStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
};

const footerLinkStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
};

const dividerStyle: React.CSSProperties = {
  maxWidth: "720px",
  margin: "5rem auto",
  border: "none",
  borderTop: "0.5px solid var(--pp-border)",
};

const ctaButtonStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 500,
  background: "var(--pp-accent)",
  color: "var(--pp-bg)",
  padding: "14px 28px",
  borderRadius: "4px",
  display: "inline-block",
  textDecoration: "none",
};

const ctaAsideStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: "15px",
  color: "var(--pp-text-secondary)",
};

const trustPillStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  border: "0.5px solid var(--pp-border)",
  borderRadius: "999px",
  padding: "8px 12px",
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const journalHref = locale === "es" ? "/diario" : "/journal";
  const calculatorHref = locale === "es" ? "/calculadora" : "/calculator";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
      }}
    >
      {/* Top nav */}
      <nav
        style={{
          maxWidth: "880px",
          margin: "0 auto",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={navLinkStyle}>{t("nav_brand")}</span>
        <span style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href={journalHref} style={navLinkStyle}>
            {t("nav_diario")}
          </Link>
          <Link href={calculatorHref} style={navLinkStyle}>
            {t("nav_calculator")}
          </Link>
          <LocaleSwitcher variant="dark" />
          <Link
            href="/auth/sign-in"
            style={{ ...navLinkStyle, color: "var(--pp-accent)" }}
          >
            {t("nav_signin")}
          </Link>
        </span>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: "720px",
          margin: "4rem auto 0",
          padding: "0 2rem",
        }}
      >
        <p style={{ ...eyebrowStyle, marginBottom: "1.25rem" }}>
          {t("hero_eyebrow")}
        </p>
        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(56px, 11vw, 84px)",
            lineHeight: 0.95,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: 0,
          }}
        >
          <span style={{ display: "block" }}>{t("hero_mast_line1")}</span>
          <span style={{ display: "block" }}>{t("hero_mast_line2")}</span>
        </h1>
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(22px, 3.5vw, 30px)",
            lineHeight: 1.25,
            color: "var(--pp-accent)",
            margin: "1.5rem 0 0",
          }}
        >
          {t("hero_subtitle")}
        </p>
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(40px, 6.5vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: "1.5rem 0 0",
          }}
        >
          {t("hero_tagline")}
        </p>
        {(["hero_body_p1", "hero_body_p2", "hero_body_p3"] as const).map(
          (key, i) => (
            <p
              key={key}
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(17px, 2.2vw, 19px)",
                lineHeight: 1.75,
                color: "#e8ddc8",
                marginTop: i === 0 ? "2rem" : "1.5rem",
                marginBottom: 0,
              }}
            >
              {t(key)}
            </p>
          ),
        )}
        <div
          style={{
            marginTop: "3rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <Link href="/auth/sign-up?plan=annual" style={ctaButtonStyle}>
            {t("hero_cta_primary")}
          </Link>
          <span style={ctaAsideStyle}>{t("hero_cta_aside")}</span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          {(
            [
              "hero_trust_trial",
              "hero_trust_cancel",
              "hero_trust_no_sales",
            ] as const
          ).map((key) => (
            <span key={key} style={trustPillStyle}>
              {t(key)}
            </span>
          ))}
        </div>
      </section>

      <hr style={dividerStyle} />

      {/* Demo */}
      <section style={{ maxWidth: "720px", margin: "0 auto", padding: "0 2rem" }}>
        <p style={{ ...eyebrowStyle, marginBottom: "1.5rem" }}>
          {t("demo_eyebrow")}
        </p>
        <span
          style={{
            display: "inline-block",
            background: "var(--pp-user-bubble-bg)",
            color: "var(--pp-user-bubble-text)",
            padding: "11px 18px",
            borderRadius: "20px",
            fontFamily: SANS,
            fontSize: "14px",
            lineHeight: 1.5,
            marginBottom: "2rem",
          }}
        >
          {t("demo_question")}
        </span>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(17px, 2.2vw, 19px)",
            lineHeight: 1.75,
            color: "#e8ddc8",
            margin: 0,
          }}
        >
          <span
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "28px",
              color: "var(--pp-accent)",
              verticalAlign: "-6px",
              marginRight: "8px",
            }}
            aria-hidden="true"
          >
            ¶
          </span>
          {t("demo_answer")}
        </p>
        <div style={{ marginTop: "2rem" }}>
          <Link href="/auth/sign-up?plan=annual" style={ctaButtonStyle}>
            {t("demo_cta")}
          </Link>
        </div>
      </section>

      <hr style={dividerStyle} />

      {/* What it does */}
      <section style={{ maxWidth: "720px", margin: "0 auto", padding: "0 2rem" }}>
        <p style={{ ...eyebrowStyle, marginBottom: "1.5rem" }}>
          {t("what_eyebrow")}
        </p>
        {(
          [
            ["what_p1_lead", "what_p1_strong", "what_p1_rest"],
            ["what_p2_lead", "what_p2_strong", "what_p2_rest"],
            ["what_p3_lead", "what_p3_strong", "what_p3_rest"],
          ] as const
        ).map(([leadKey, strongKey, restKey]) => (
          <p
            key={leadKey}
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(16px, 2vw, 18px)",
              lineHeight: 1.75,
              color: "#e8ddc8",
              marginTop: 0,
              marginBottom: "1.5rem",
            }}
          >
            {t(leadKey)}
            <span style={{ color: "var(--pp-accent)", fontStyle: "italic" }}>
              {t(strongKey)}
            </span>
            {t(restKey)}
          </p>
        ))}
      </section>

      <hr style={dividerStyle} />

      {/* What it isn't */}
      <section style={{ maxWidth: "720px", margin: "0 auto", padding: "0 2rem" }}>
        <p style={{ ...eyebrowStyle, marginBottom: "1.5rem" }}>
          {t("isnt_eyebrow")}
        </p>
        {(["isnt_line1", "isnt_line2", "isnt_line3"] as const).map((key) => (
          <p
            key={key}
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "17px",
              lineHeight: 1.7,
              color: "var(--pp-text-secondary)",
              marginTop: 0,
              marginBottom: "1rem",
            }}
          >
            {t(key)}
          </p>
        ))}
      </section>

      <hr style={dividerStyle} />

      {/* Pro value */}
      <section style={{ maxWidth: "720px", margin: "0 auto", padding: "0 2rem" }}>
        <p style={{ ...eyebrowStyle, marginBottom: "1.5rem" }}>
          {t("pro_eyebrow")}
        </p>
        <h2
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(34px, 6vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: "0 0 2rem",
          }}
        >
          {t("pro_title")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
          }}
        >
          {(["pro_feature_1", "pro_feature_2", "pro_feature_3", "pro_feature_4"] as const).map(
            (key) => (
              <div
                key={key}
                style={{
                  background: "var(--pp-surface)",
                  border: "0.5px solid var(--pp-border)",
                  borderRadius: "8px",
                  padding: "1.25rem",
                }}
              >
                <p
                  style={{
                    fontFamily: SERIF,
                    fontSize: "16px",
                    lineHeight: 1.65,
                    color: "#e8ddc8",
                    margin: 0,
                  }}
                >
                  {t(key)}
                </p>
              </div>
            ),
          )}
        </div>
        <div style={{ marginTop: "2rem" }}>
          <Link href="/auth/sign-up?plan=annual" style={ctaButtonStyle}>
            {t("pro_cta")}
          </Link>
        </div>
      </section>

      {/* Verified reviews — only renders if there are approved+verified rows */}
      <HomepageReviews locale={locale as "es" | "en"} />

      <hr style={dividerStyle} />

      {/* Pricing — annual primary + monthly alt */}
      <section
        style={{
          maxWidth: "540px",
          margin: "5rem auto 0",
          padding: "0 2rem",
          textAlign: "center",
        }}
      >
        {/* Annual block */}
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(52px, 9vw, 64px)",
            lineHeight: 1,
            color: "var(--pp-text)",
            margin: 0,
          }}
        >
          {t("pricing_annual_amount")}
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: "14px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--pp-text-secondary)",
            fontWeight: 500,
            marginTop: "12px",
            marginBottom: 0,
          }}
        >
          {t("pricing_annual_period")}
        </p>
        <p
          style={{
            display: "inline-block",
            fontFamily: SANS,
            fontSize: "12px",
            letterSpacing: "0.24em",
            fontWeight: 500,
            color: "var(--pp-accent)",
            border: "0.5px solid var(--pp-accent)",
            borderRadius: "4px",
            padding: "6px 12px",
            marginTop: "1.25rem",
            marginBottom: 0,
          }}
        >
          {t("pricing_annual_badge")}
        </p>
        <div style={{ marginTop: "2rem" }}>
          <Link href="/auth/sign-up?plan=annual" style={ctaButtonStyle}>
            {t("pricing_annual_cta")}
          </Link>
        </div>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "16px",
            lineHeight: 1.6,
            color: "var(--pp-text-secondary)",
            margin: "1.25rem 0 0",
          }}
        >
          {t("pricing_detail")}
        </p>

        {/* Monthly alt — quieter, separated by hairline */}
        <div
          style={{
            marginTop: "3rem",
            paddingTop: "2rem",
            borderTop: "0.5px solid var(--pp-border)",
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--pp-text-tertiary)",
              fontWeight: 500,
              margin: 0,
            }}
          >
            {t("pricing_monthly_eyebrow")}
          </p>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: "20px",
              color: "var(--pp-text-secondary)",
              margin: "0.5rem 0 0.75rem",
            }}
          >
            {t("pricing_monthly_amount")}{" "}
            <span style={{ fontStyle: "italic", fontSize: "16px" }}>
              {t("pricing_monthly_period")}
            </span>
          </p>
          <Link
            href="/auth/sign-up?plan=monthly"
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "15px",
              color: "var(--pp-text-secondary)",
              textDecoration: "none",
              display: "inline-block",
              padding: "8px",
            }}
          >
            {t("pricing_monthly_cta")}
          </Link>
        </div>
      </section>

      <hr style={dividerStyle} />

      {/* Newsletter */}
      <NewsletterSignup locale={locale as "es" | "en"} />

      {/* Footer */}
      <footer
        style={{
          maxWidth: "880px",
          margin: "6rem auto 0",
          padding: "2rem 2rem 2rem",
          borderTop: "0.5px solid var(--pp-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <span style={footerLinkStyle}>{t("footer_copyright")}</span>
        <span style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href={journalHref} style={footerLinkStyle}>
            {t("footer_diario")}
          </Link>
          <Link href={calculatorHref} style={footerLinkStyle}>
            {t("footer_calculator")}
          </Link>
          <Link href="/privacy" style={footerLinkStyle}>
            {t("footer_privacy")}
          </Link>
          <Link href="/terms" style={footerLinkStyle}>
            {t("footer_terms")}
          </Link>
        </span>
      </footer>
    </div>
  );
}
