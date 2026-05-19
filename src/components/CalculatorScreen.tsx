import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PeptideCalculator } from "@/components/PeptideCalculator";

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

const ctaButtonStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 500,
  background: "var(--pp-accent)",
  color: "var(--pp-bg)",
  padding: "13px 22px",
  borderRadius: "4px",
  display: "inline-block",
  textDecoration: "none",
};

export async function CalculatorScreen({ locale }: { locale: "es" | "en" }) {
  const t = await getTranslations({ locale, namespace: "calculator" });
  const tHome = await getTranslations({ locale, namespace: "home" });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
      }}
    >
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
        <Link href="/" style={navLinkStyle}>
          {tHome("nav_brand")}
        </Link>
        <span
          style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}
        >
          <LocaleSwitcher variant="dark" />
          <Link
            href="/auth/sign-in"
            style={{ ...navLinkStyle, color: "var(--pp-accent)" }}
          >
            {t("nav_signin")}
          </Link>
        </span>
      </nav>

      <main
        style={{
          maxWidth: "640px",
          margin: "3rem auto 0",
          padding: "0 1.5rem 5rem",
        }}
      >
        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(40px, 8vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: "0 0 0.5rem",
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "18px",
            color: "var(--pp-text-secondary)",
            margin: "0 0 3rem",
            lineHeight: 1.5,
          }}
        >
          {t("subtitle")}
        </p>

        <PeptideCalculator />

        <section
          style={{
            marginTop: "3rem",
            background: "var(--pp-surface)",
            border: "0.5px solid var(--pp-border)",
            borderRadius: "10px",
            padding: "1.5rem",
          }}
        >
          <h2
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "clamp(26px, 5vw, 34px)",
              lineHeight: 1.1,
              fontWeight: 400,
              color: "var(--pp-text)",
              margin: 0,
            }}
          >
            {t("pro_cta_title")}
          </h2>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: "16px",
              lineHeight: 1.65,
              color: "var(--pp-text-secondary)",
              margin: "1rem 0 1.25rem",
            }}
          >
            {t("pro_cta_body")}
          </p>
          <Link href="/auth/sign-up?plan=annual" style={ctaButtonStyle}>
            {t("pro_cta_button")}
          </Link>
        </section>
      </main>
    </div>
  );
}
