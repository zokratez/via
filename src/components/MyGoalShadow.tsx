"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const HIDDEN_PATH_RE =
  /^\/(es|en)\/(auth|admin|privacy|terms|reviews\/submit)(\/.*)?$/;

const SANS = "var(--pp-font-sans)";
const SERIF = "var(--pp-font-serif)";
const HAS_NEW_GOAL_ALERT = false;

function GoalIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s7-4.4 7-11.2A7 7 0 0 0 5 9.8C5 16.6 12 21 12 21z" />
      <path d="M9.5 10.5 11.4 12.4 15 8.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function MyGoalShadow() {
  const t = useTranslations("my_goal");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldHide = !pathname.startsWith(`/${locale}`) || HIDDEN_PATH_RE.test(pathname);

  useEffect(() => {
    function onScroll() {
      setScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        setScrolling(false);
      }, 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const closeOverlay = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOverlay]);

  if (shouldHide) return null;

  const actions = [
    { href: "/dashboard", title: t("action_dashboard"), body: t("action_dashboard_body") },
    { href: "/food", title: t("action_food"), body: t("action_food_body") },
    { href: "/check-in", title: t("action_checkin"), body: t("action_checkin_body") },
    { href: "/coach", title: t("action_coach"), body: t("action_coach_body") },
  ];

  return (
    <>
      <div
        className="pp-my-goal-anchor"
        style={{
          opacity: scrolling ? 0.42 : 1,
          transition: "opacity 0.2s ease-out",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("open_label")}
          className="pp-global-search-pill pp-my-goal-pill"
        >
          {HAS_NEW_GOAL_ALERT && (
            <span className="pp-my-goal-status" aria-hidden="true">
              ✓
            </span>
          )}
          <GoalIcon />
          <span>{t("pill")}</span>
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("dialog_label")}
          onClick={closeOverlay}
          className="pp-my-goal-overlay"
        >
          <section
            onClick={(e) => e.stopPropagation()}
            className="pp-my-goal-sheet"
          >
            <div className="pp-my-goal-sheet-scroll">
              <div className="pp-my-goal-sheet-top">
                <div>
                  <p className="pp-my-goal-kicker">{t("kicker")}</p>
                  <h2>{t("title")}</h2>
                  <p>{t("body")}</p>
                </div>
                <button
                  type="button"
                  onClick={closeOverlay}
                  aria-label={t("close_label")}
                  className="pp-my-goal-close"
                >
                  <CloseIcon />
                </button>
              </div>

              {HAS_NEW_GOAL_ALERT && (
                <div className="pp-my-goal-alert">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>{t("alert_title")}</strong>
                    <p>{t("alert_body")}</p>
                  </div>
                </div>
              )}

              <div className="pp-my-goal-grid">
                {actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={closeOverlay}
                    className="pp-my-goal-card"
                  >
                    <span>{action.title}</span>
                    <small>{action.body}</small>
                  </Link>
                ))}
              </div>

              <p
                style={{
                  margin: "1rem 0 0",
                  color: "var(--pp-text-tertiary)",
                  fontFamily: SERIF,
                  fontSize: "0.92rem",
                  fontStyle: "italic",
                  lineHeight: 1.55,
                }}
              >
                {t("disclaimer")}
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
