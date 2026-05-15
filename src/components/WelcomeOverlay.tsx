"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const SKIP_KEY = "pp-onboarding-skipped";
const JOURNAL_KEY = "pp-onboarding-journal";

type Step = {
  key: "dose" | "weight" | "coach" | "journal";
  href: string;
  done: boolean;
  onClick?: () => void;
};

function CheckMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "9999px",
        border: `1px solid ${done ? "var(--pp-accent)" : "var(--pp-border)"}`,
        background: done ? "var(--pp-accent)" : "transparent",
        color: "var(--pp-bg)",
        fontSize: "12px",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {done ? "✓" : ""}
    </span>
  );
}

export function WelcomeOverlay({
  hasDose,
  hasWeight,
  hasCoach,
  journalHref,
}: {
  hasDose: boolean;
  hasWeight: boolean;
  hasCoach: boolean;
  journalHref: string;
}) {
  const t = useTranslations("onboarding");
  const [hydrated, setHydrated] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [journalVisited, setJournalVisited] = useState(false);

  useEffect(() => {
    try {
      setSkipped(window.localStorage.getItem(SKIP_KEY) === "1");
      setJournalVisited(window.localStorage.getItem(JOURNAL_KEY) === "1");
    } catch {
      // Private mode / disabled storage — treat as fresh.
    }
    setHydrated(true);
  }, []);

  if (!hydrated || skipped) return null;

  const steps: Step[] = [
    { key: "dose", href: "/log/dose", done: hasDose },
    { key: "weight", href: "/log/weight", done: hasWeight },
    { key: "coach", href: "/coach", done: hasCoach },
    {
      key: "journal",
      href: journalHref,
      done: journalVisited,
      onClick: () => {
        try {
          window.localStorage.setItem(JOURNAL_KEY, "1");
        } catch {
          /* ignore */
        }
      },
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  function handleSkip() {
    try {
      window.localStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    setSkipped(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        WebkitBackdropFilter: "blur(8px)",
        backdropFilter: "blur(8px)",
        zIndex: 950,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          background: "var(--pp-surface)",
          border: "0.5px solid var(--pp-border)",
          borderRadius: "12px",
          padding: "2rem 1.75rem",
          width: "100%",
          maxWidth: "440px",
          fontFamily: SERIF,
          color: "var(--pp-text)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <h2
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(26px, 4vw, 32px)",
            lineHeight: 1.1,
            fontWeight: 400,
            margin: "0 0 0.5rem",
            color: "var(--pp-text)",
          }}
        >
          {t("title")}
        </h2>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "15px",
            lineHeight: 1.5,
            color: "var(--pp-text-secondary)",
            margin: "0 0 1.5rem",
          }}
        >
          {t("subtitle")}
        </p>

        <ul
          style={{
            listStyle: "none",
            margin: "0 0 1.5rem",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                href={step.href}
                onClick={step.onClick}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 0.875rem",
                  borderRadius: "6px",
                  border: "0.5px solid var(--pp-border)",
                  background: "var(--pp-bg)",
                  textDecoration: "none",
                  color: step.done
                    ? "var(--pp-text-secondary)"
                    : "var(--pp-text)",
                }}
                className="hover:border-[var(--pp-accent)] transition-colors"
              >
                <CheckMark done={step.done} />
                <span
                  style={{
                    fontFamily: SERIF,
                    fontSize: "15px",
                    textDecoration: step.done ? "line-through" : "none",
                  }}
                >
                  {t(`step_${step.key}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleSkip}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--pp-text-tertiary)",
            fontFamily: SANS,
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: "0.5rem 0",
            width: "100%",
            textAlign: "center",
          }}
          className="hover:text-[var(--pp-text-secondary)] transition-colors"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
