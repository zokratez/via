"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

type Locale = "es" | "en";
type Status = "idle" | "submitting" | "success" | "error";

export function NewsletterSignup({ locale }: { locale: Locale }) {
  const t = useTranslations("home");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting" || status === "success") return;
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, locale }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      style={{
        maxWidth: "540px",
        margin: "5rem auto 0",
        padding: "0 2rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: SANS,
          fontSize: "13px",
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "var(--pp-text-secondary)",
          fontWeight: 500,
          marginBottom: "1rem",
        }}
      >
        {t("newsletter_eyebrow")}
      </p>
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "clamp(22px, 3.4vw, 28px)",
          lineHeight: 1.3,
          color: "var(--pp-text)",
          margin: "0 0 1.75rem",
        }}
      >
        {t("newsletter_pitch")}
      </p>

      {status === "success" ? (
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "17px",
            color: "var(--pp-accent)",
            margin: 0,
          }}
        >
          {t("newsletter_success")}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "center",
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder={t("newsletter_email_placeholder")}
            aria-label={t("newsletter_email_placeholder")}
            disabled={status === "submitting"}
            style={{
              flex: "1 1 240px",
              minWidth: 0,
              fontFamily: SERIF,
              fontSize: "16px",
              color: "var(--pp-text)",
              background: "transparent",
              border: "0.5px solid var(--pp-border)",
              borderRadius: "4px",
              padding: "12px 14px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            style={{
              fontFamily: SANS,
              fontSize: "12px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
              background: "var(--pp-accent)",
              color: "var(--pp-bg)",
              border: "none",
              padding: "12px 24px",
              borderRadius: "4px",
              cursor: status === "submitting" ? "default" : "pointer",
              opacity: status === "submitting" ? 0.6 : 1,
            }}
          >
            {status === "submitting"
              ? t("newsletter_button_loading")
              : t("newsletter_button")}
          </button>
        </form>
      )}

      {status === "error" && (
        <p
          style={{
            fontFamily: SANS,
            fontSize: "13px",
            color: "var(--pp-accent)",
            marginTop: "1rem",
            marginBottom: 0,
          }}
        >
          {t("newsletter_error")}
        </p>
      )}
    </section>
  );
}
