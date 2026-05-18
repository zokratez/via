import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const linkStyle: React.CSSProperties = {
  fontFamily: "var(--pp-font-sans)",
  fontSize: "12px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--pp-text-secondary)",
  textDecoration: "none",
};

export async function Footer({ locale }: { locale?: "es" | "en" } = {}) {
  const t = await getTranslations("footer");
  const calculatorHref = locale === "en" ? "/calculator" : "/calculadora";
  return (
    <footer
      style={{
        borderTop: "0.5px solid var(--pp-border)",
        background: "var(--pp-bg)",
        color: "var(--pp-text-secondary)",
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "880px",
          padding: "2rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <span style={linkStyle}>{t("copyright")}</span>
        <span
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <Link href={calculatorHref} style={linkStyle}>
            {t("calculator")}
          </Link>
          <Link href="/reviews/submit" style={linkStyle}>
            {t("reviews")}
          </Link>
          <Link href="/privacy" style={linkStyle}>
            {t("privacy")}
          </Link>
          <Link href="/terms" style={linkStyle}>
            {t("terms")}
          </Link>
        </span>
      </div>
    </footer>
  );
}
