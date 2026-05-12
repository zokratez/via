import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

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

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

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
        <Link
          href="/auth/sign-in"
          style={{ ...navLinkStyle, color: "var(--pp-accent)" }}
        >
          {t("nav_signin")}
        </Link>
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
            fontSize: "clamp(40px, 6.5vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: 0,
          }}
        >
          {t("hero_tagline")}
        </h1>
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
        <div style={{ marginTop: "3rem" }}>
          <Link href="/auth/sign-up?plan=annual" style={ctaButtonStyle}>
            {t("hero_cta_primary")}
          </Link>
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
