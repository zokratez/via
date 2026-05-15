"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

type Locale = "es" | "en";

function detectLocale(pathname: string | null): Locale {
  if (pathname && pathname.startsWith("/en")) return "en";
  return "es";
}

const COPY: Record<Locale, {
  code: string;
  title: string;
  body: string;
  tagline: string;
  home: string;
  homeHref: string;
}> = {
  es: {
    code: "404",
    title: "Esta página no existe",
    body: "Lo que buscas no está aquí. Tal vez nunca estuvo, o tal vez ya se fue.",
    tagline: "Ni yo encuentro lo que no existe.",
    home: "Volver al inicio",
    homeHref: "/es",
  },
  en: {
    code: "404",
    title: "This page doesn't exist",
    body: "What you're looking for isn't here. Maybe it never was, maybe it left.",
    tagline: "Even I can't find what's not here.",
    home: "Back to home",
    homeHref: "/en",
  },
};

export default function NotFound() {
  const pathname = usePathname();
  const locale = detectLocale(pathname);
  const copy = COPY[locale];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: "440px", textAlign: "center" }}>
        <p
          style={{
            fontFamily: SANS,
            fontSize: "11px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "var(--pp-accent)",
            fontWeight: 600,
            margin: 0,
          }}
        >
          {copy.code}
        </p>
        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(40px, 7vw, 56px)",
            lineHeight: 1.05,
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: "1rem 0 1.25rem",
          }}
        >
          {copy.title}
        </h1>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "16px",
            lineHeight: 1.6,
            color: "var(--pp-text-secondary)",
            margin: "0 0 1rem",
          }}
        >
          {copy.body}
        </p>
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "15px",
            color: "var(--pp-text-tertiary)",
            margin: "0 0 2rem",
          }}
        >
          — {copy.tagline}
        </p>
        <Link
          href={copy.homeHref}
          style={{
            fontFamily: SANS,
            fontSize: "12px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 600,
            background: "var(--pp-accent)",
            color: "var(--pp-bg)",
            padding: "14px 28px",
            borderRadius: "6px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          {copy.home} →
        </Link>
      </div>
    </main>
  );
}
