"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";

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
  ...navLinkStyle,
  display: "inline-block",
  marginBottom: "1.5rem",
  transition: "color 0.15s",
};

export function LogShell({
  backLabel,
  title,
  children,
}: {
  backLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
        minHeight: "100vh",
      }}
    >
      <header
        className="mx-auto w-full"
        style={{
          maxWidth: "880px",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/dashboard" style={navLinkStyle}>
          {tApp("name")}
        </Link>
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{
          maxWidth: "540px",
          padding: "2rem 1.5rem 5rem",
        }}
      >
        <Link
          href="/dashboard"
          style={backLinkStyle}
          className="hover:text-[var(--pp-accent)]"
        >
          ← {backLabel}
        </Link>

        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(36px, 6vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: "0 0 2rem",
          }}
        >
          {title}
        </h1>

        {children}
      </main>
    </div>
  );
}
