"use client";

import { useEffect } from "react";
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
  retry: string;
  home: string;
  homeHref: string;
}> = {
  es: {
    code: "500",
    title: "Algo se rompió",
    body: "Algo del lado del servidor falló. Intenta de nuevo o vuelve al inicio.",
    retry: "Intentar de nuevo",
    home: "Volver al inicio",
    homeHref: "/es",
  },
  en: {
    code: "500",
    title: "Something broke",
    body: "Something on the server side failed. Try again or go home.",
    retry: "Try again",
    home: "Back to home",
    homeHref: "/en",
  },
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = detectLocale(pathname);
  const copy = COPY[locale];

  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

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
            color: "#c0735c",
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
            margin: "0 0 2rem",
          }}
        >
          {copy.body}
        </p>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              fontFamily: SANS,
              fontSize: "12px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
              background: "var(--pp-accent)",
              color: "var(--pp-bg)",
              border: "none",
              padding: "14px 28px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
          <Link
            href={copy.homeHref}
            style={{
              fontFamily: SANS,
              fontSize: "12px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
              background: "transparent",
              color: "var(--pp-text-secondary)",
              border: "0.5px solid var(--pp-border)",
              padding: "14px 28px",
              borderRadius: "6px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            {copy.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
